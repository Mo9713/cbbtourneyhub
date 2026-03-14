// src/app/hooks/useRealtimeSync.ts

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
 */
function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  const keyStr = JSON.stringify(queryKey)
  if (qc.isMutating() > 0) {
    // W-10 FIX: Clear the existing timeout before setting a new one
    if (invalidateTimers.has(keyStr)) {
      clearTimeout(invalidateTimers.get(keyStr)!)
    }
    const timer = setTimeout(() => {
      void qc.invalidateQueries({ queryKey })
      invalidateTimers.delete(keyStr)
    }, REALTIME_DEBOUNCE_MS)
    invalidateTimers.set(keyStr, timer)
  } else {
    void qc.invalidateQueries({ queryKey })
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

    // Prevent duplicate subscriptions in React Strict Mode (W-14)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel('app-realtime')

      // W-08 FIX: Catch all events (INSERT, UPDATE, DELETE) for tournaments
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournaments',
      }, () => {
        safeInvalidate(qc, tournamentKeys.all)
      })

      // W-09 FIX: Catch group changes to sync Sidebar/Dashboard instantly
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
        // W-15 FIX: Removed restrictive selectedTournamentId gate.
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