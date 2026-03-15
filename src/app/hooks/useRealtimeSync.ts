// src/app/hooks/useRealtimeSync.ts
//
// ── Realtime Debounce Contract ────────────────────────────────
// safeInvalidate (imported from shared/lib/queryUtils — C-04) defers
// cache invalidation by 150ms when a local mutation is in-flight.
// This prevents Supabase Realtime "echo" events (the DB confirming
// our own write) from reverting in-flight optimistic UI updates.
//
// ── Prefix Invalidation Contract ─────────────────────────────
// invalidateQueries is called with exact: false (the TanStack Query
// default). A key like ['picks', 'mine'] will match ALL compound
// observer keys of the form ['picks', 'mine', tid, gameIds[]].

import { useEffect, useRef }       from 'react'
import { useQueryClient }          from '@tanstack/react-query'
import type {
  RealtimeChannel,
}                                  from '@supabase/supabase-js'

import { supabase }                from '../../shared/infra/supabaseClient'
import { safeInvalidate }          from '../../shared/lib/queryUtils'
import { tournamentKeys }          from '../../entities/tournament/model/queries'
import { pickKeys }                from '../../entities/pick/model/queries'
import { leaderboardKeys }         from '../../entities/leaderboard/model/queries'
import { groupKeys }               from '../../entities/group/model/queries'
// MOD-03 FIX: Import from the public slice API, not the internal model file.
import { useAuth }                 from '../../features/auth'
import { useUIStore }              from '../../shared/store/uiStore'

export function useRealtimeSync(): void {
  const qc          = useQueryClient()
  const { profile } = useAuth()

  // ── Stable refs for Zustand navigation state ─────────────
  // These refs track current UI state without causing the effect
  // to re-subscribe on every navigation change.
  const selectedIdRef = useRef(useUIStore.getState().selectedTournamentId)
  const snoopRef      = useRef(useUIStore.getState().snoopTargetId)

  // ── Stable ref for Realtime channel ──────────────────────
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    return useUIStore.subscribe((s) => {
      selectedIdRef.current = s.selectedTournamentId
      snoopRef.current      = s.snoopTargetId
    })
  }, [])

  // ── Realtime channel ──────────────────────────────────────
  useEffect(() => {
    if (!profile) return

    // Prevent duplicate subscriptions in React Strict Mode.
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel('app-realtime')

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournaments',
      }, () => {
        safeInvalidate(qc, tournamentKeys.all)
      })

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
      }, () => {
        // FIX: Ignore the realtime echo if the user is actively spam-clicking picks
        if (qc.isMutating({ mutationKey: ['makePick'] }) > 0) return

        // FIX: Replaced broken ['games'] key with tournamentKeys.all. 
        // Because TanStack Query keys are arrays (e.g., ['tournaments', 'games', id]), 
        // we must target the root 'tournaments' level to flush them all!
        safeInvalidate(qc, tournamentKeys.all)
        safeInvalidate(qc, leaderboardKeys.raw)
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        // FIX: Ignore the realtime echo if the user is actively spam-clicking
        if (qc.isMutating({ mutationKey: ['makePick'] }) > 0) return

        safeInvalidate(qc, ['picks', 'mine'])
        safeInvalidate(qc, pickKeys.allMine())
        safeInvalidate(qc, leaderboardKeys.raw)
      })

      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [profile?.id, qc])
}