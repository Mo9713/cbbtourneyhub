// src/hooks/useRealtimeSync.ts
// ─────────────────────────────────────────────────────────────
// Subscribes to all three critical Supabase tables on a single
// channel and dispatches to the appropriate context loaders.
//
// DESIGN: the hook accepts zero arguments and reads contexts
// directly. This moves the wiring out of App.tsx entirely and
// makes the dependency graph explicit at the hook boundary.
//
// CHANNEL LIFECYCLE: the channel is created only when `profile`
// exists (authenticated) and torn down on sign-out. Navigation
// events (selectedTournament / activeView / snoopTargetId)
// intentionally do NOT trigger a re-subscription — instead, a
// ref pattern lets handlers always read the latest values
// without the channel being destroyed and rebuilt on every tab
// switch or tournament selection.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { supabase }                from '../services/supabaseClient'
import { useAuthContext }          from '../context/AuthContext'
import { useTournamentContext }    from '../context/TournamentContext'
import { useBracketContext }       from '../context/BracketContext'
import { useLeaderboardContext }   from '../context/LeaderboardContext'

export function useRealtimeSync(): void {
  const { profile } = useAuthContext()

  const {
    selectedTournament,
    activeView,
    loadTournaments,
    loadGames,
  } = useTournamentContext()

  const { loadPicks, loadAllMyPicks } = useBracketContext()
  const { snoopTargetId, loadLeaderboard } = useLeaderboardContext()

  // ── Mutable refs: handlers read the latest nav state ─────────
  // These are updated synchronously on every render so callbacks
  // always see current values without being in the effect's deps.
  const selectedRef = useRef(selectedTournament)
  const activeRef   = useRef(activeView)
  const snoopRef    = useRef(snoopTargetId)
  selectedRef.current = selectedTournament
  activeRef.current   = activeView
  snoopRef.current    = snoopTargetId

  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel('app-realtime')

      // ── tournaments ──────────────────────────────────────────
      // UPDATE only: covers publish / lock / rename / config changes.
      // INSERT is not expected (app creates tournaments via service,
      // not from other clients). DELETE is not real-time visible.
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
      }, () => {
        loadTournaments()
      })

      // ── games ─────────────────────────────────────────────────
      // Wildcard: INSERT (admin adds game), UPDATE (winner set, team
      // name edited, sort_order changed), DELETE (game removed).
      // Reads tournament_id from the payload so only the affected
      // tournament's slice of gamesCache is refreshed.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'games',
      }, (payload: any) => {
        const tid = payload.new?.tournament_id ?? payload.old?.tournament_id
        if (tid) {
          loadGames(tid)
        } else if (selectedRef.current) {
          loadGames(selectedRef.current.id)
        }
        if (activeRef.current === 'leaderboard' || snoopRef.current) {
          loadLeaderboard()
        }
      })

      // ── picks ─────────────────────────────────────────────────
      // Wildcard: INSERT (new pick), UPDATE (tiebreaker score edit),
      // DELETE (pick removed by user or cascade). Refreshes the
      // active tournament's picks and the user's full pick history.
      // Leaderboard query only runs when the tab is visible or a
      // snoop session is active.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        if (selectedRef.current) loadPicks(selectedRef.current.id)
        loadAllMyPicks()
        if (activeRef.current === 'leaderboard' || snoopRef.current) {
          loadLeaderboard()
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }

    // Loaders are stable useCallback refs — safe to include in deps
    // without causing extra re-subscriptions. Channel only rebuilds
    // when the authenticated user changes (sign-in / sign-out).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loadTournaments, loadGames, loadPicks, loadAllMyPicks, loadLeaderboard])
}
