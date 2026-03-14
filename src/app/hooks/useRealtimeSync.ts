// src/app/hooks/useRealtimeSync.ts
//
// ── Realtime Debounce Contract ────────────────────────────────
// safeInvalidate defers cache invalidation by 150ms when a local mutation
// is in flight. This prevents Supabase Realtime "echo" events (the DB
// confirming our own write) from reverting in-flight optimistic UI updates.
// Timer deduplication ensures rapid successive Realtime events for the same
// key reset the clock rather than stacking multiple callbacks.
//
// ── Prefix Invalidation Contract ─────────────────────────────
// TanStack Query's invalidateQueries uses prefix/fuzzy matching by default
// (exact: false). A key like ['picks', 'mine'] will therefore match ALL
// compound observer keys of the form ['picks', 'mine', tid, gameIds[]].
// This is intentional — the Realtime handler must cover every active
// tournament+gameIds variant without knowing which tournaments are mounted.
// The explicit `exact: false` below documents this reliance.

import { useEffect, useRef }         from 'react'
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'

import { supabase }                  from '../../shared/infra/supabaseClient'
import { tournamentKeys }            from '../../entities/tournament/model/queries'
import { pickKeys }                  from '../../entities/pick/model/queries'
import { leaderboardKeys }           from '../../entities/leaderboard/model/queries'
import { groupKeys }                 from '../../entities/group/model/queries'
import { useAuth }                   from '../../features/auth/model/useAuth'
import { useUIStore }                from '../../shared/store/uiStore'

type GameRow = { tournament_id: string }

const REALTIME_DEBOUNCE_MS = 150
const invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Delays cache invalidation when local mutations are in-flight to prevent
 * Supabase Realtime "echo" events from reverting optimistic UI updates.
 *
 * Uses prefix matching (exact: false, the TanStack Query default) so a
 * short key like ['picks', 'mine'] correctly covers compound observer keys
 * like ['picks', 'mine', tournamentId, gameIds[]].
 */
function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  const keyStr = JSON.stringify(queryKey)
  if (qc.isMutating() > 0) {
    // W-10: Clear existing timer before setting a new one (deduplication).
    if (invalidateTimers.has(keyStr)) {
      clearTimeout(invalidateTimers.get(keyStr)!)
    }
    const timer = setTimeout(() => {
      // exact: false — intentional prefix coverage. See file-level comment.
      void qc.invalidateQueries({ queryKey, exact: false })
      invalidateTimers.delete(keyStr)
    }, REALTIME_DEBOUNCE_MS)
    invalidateTimers.set(keyStr, timer)
  } else {
    // exact: false — intentional prefix coverage. See file-level comment.
    void qc.invalidateQueries({ queryKey, exact: false })
  }
}

export function useRealtimeSync(): void {
  const qc          = useQueryClient()
  const { profile } = useAuth()

  // ── Stable refs for Zustand navigation state ──────────────
  const activeViewRef = useRef(useUIStore.getState().activeView)
  const selectedIdRef = useRef(useUIStore.getState().selectedTournamentId)
  const snoopRef      = useRef(useUIStore.getState().snoopTargetId)

  // ── Stable ref for Realtime channel (W-14 FIX) ────────────
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    return useUIStore.subscribe((s) => {
      activeViewRef.current = s.activeView
      selectedIdRef.current = s.selectedTournamentId
      snoopRef.current      = s.snoopTargetId
    })
  }, [])

  // ── Realtime channel ──────────────────────────────────────
  useEffect(() => {
    if (!profile) return

    // Prevent duplicate subscriptions in React Strict Mode (W-14).
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel('app-realtime')

      // W-08 FIX: Catch all events (INSERT, UPDATE, DELETE) for tournaments.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournaments',
      }, () => {
        safeInvalidate(qc, tournamentKeys.all)
      })

      // W-09 FIX: Catch group changes to sync Sidebar/Dashboard instantly.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'groups',
      }, () => {
        safeInvalidate(qc, groupKeys.all)
        safeInvalidate(qc, groupKeys.userGroups())
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_members',
      }, () => {
        safeInvalidate(qc, groupKeys.userGroups())
        safeInvalidate(qc, ['groups', 'members'])
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'games',
      }, (payload: RealtimePostgresChangesPayload<GameRow>) => {
        const tid    = (payload.new as Partial<GameRow>).tournament_id
                    ?? (payload.old as Partial<GameRow>).tournament_id
        const target = tid ?? selectedIdRef.current
        if (target) safeInvalidate(qc, tournamentKeys.games(target))

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          safeInvalidate(qc, leaderboardKeys.raw)
        }
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        // FIX: Gate on selectedTournamentId removed — picks from other
        // tournaments (e.g. group dashboard leaderboard) must also invalidate.
        //
        // ['picks', 'mine'] is a deliberate PREFIX key. With exact: false
        // (set inside safeInvalidate), TanStack Query's prefix matching
        // covers all active compound observer keys of the form:
        //   ['picks', 'mine', tournamentId, gameIds[]]
        // This is the only way to reach dynamic-keyed observers without
        // knowing which tournaments are currently mounted.
        safeInvalidate(qc, ['picks', 'mine'])
        safeInvalidate(qc, pickKeys.allMine())

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          safeInvalidate(qc, leaderboardKeys.raw)
        }
      })

      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [profile?.id, qc])
}