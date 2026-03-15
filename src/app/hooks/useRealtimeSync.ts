// src/app/hooks/useRealtimeSync.ts
//
// ── Realtime Debounce Contract ────────────────────────────────
// safeInvalidate (imported from shared/lib/queryUtils) defers cache
// invalidation by 150ms when a local mutation is in-flight, preventing
// Supabase Realtime "echo" events from clobbering optimistic UI updates.
//
// ── Echo Suppression Narrowing (this PR) ─────────────────────
// PREVIOUS: Both the `games` and `picks` handlers used an early `return`
// guarded by `qc.isMutating({ mutationKey: ['makePick'] }) > 0`. This
// silently dropped ALL realtime events — including admin score updates
// from other sessions — whenever any pick mutation was in-flight.
//
// FIX for `games` table: The early return is removed entirely. Game rows
// are NEVER written by the `makePick` mutation, so there is no echo
// scenario to suppress. Admin winner declarations now propagate to all
// clients immediately via safeInvalidate's 150ms deferred path.
//
// FIX for `picks` table: The early return is now narrowed to only
// suppress events where the changed row belongs to the current user AND
// a pick mutation is in-flight — the only case where an echo is harmful.
// Picks from other users or admin actions are no longer dropped.
//
// ── Prefix Invalidation Contract ─────────────────────────────
// invalidateQueries is called with exact: false (the TanStack Query
// default). A key like ['picks', 'mine'] will match ALL compound
// observer keys of the form ['picks', 'mine', tid, gameIds[]].

import { useEffect, useRef }    from 'react'
import { useQueryClient }       from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase }             from '../../shared/infra/supabaseClient'
import { safeInvalidate }       from '../../shared/lib/queryUtils'
import { tournamentKeys }       from '../../entities/tournament/model/queries'
import { pickKeys }             from '../../entities/pick/model/queries'
import { leaderboardKeys }      from '../../entities/leaderboard/model/queries'
import { groupKeys }            from '../../entities/group/model/queries'
import { useAuth }              from '../../features/auth'
import { useUIStore }           from '../../shared/store/uiStore'

export function useRealtimeSync(): void {
  const qc          = useQueryClient()
  const { profile } = useAuth()

  // ── Stable refs for Zustand navigation state ─────────────
  // These refs track current UI state without causing the effect
  // to re-subscribe on every navigation change.
  const selectedIdRef = useRef(useUIStore.getState().selectedTournamentId)
  const snoopRef      = useRef(useUIStore.getState().snoopTargetId)

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
        // No early return here. Game rows are written exclusively by admin
        // mutations — there is no pick-echo scenario on this table.
        // safeInvalidate's 150ms deferral handles any coincidental overlap.
        safeInvalidate(qc, tournamentKeys.all)
        safeInvalidate(qc, leaderboardKeys.raw)
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, (payload) => {
        // Narrow the echo guard to the current user's own rows only.
        // Dropping events from OTHER users' pick writes or admin actions
        // was the root cause of standings latency in multi-user sessions.
        const changedUserId =
          (payload.new as { user_id?: string })?.user_id ??
          (payload.old as { user_id?: string })?.user_id

        const isOwnEcho =
          changedUserId === profile.id &&
          qc.isMutating({ mutationKey: ['makePick'] }) > 0

        if (isOwnEcho) return

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