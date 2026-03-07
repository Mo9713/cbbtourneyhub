// src/hooks/useRealtimeSync.ts
import { useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import type { Profile, Tournament, ActiveView } from '../types'

interface UseRealtimeSyncOptions {
  profile:             Profile | null
  selectedTournament:  Tournament | null
  activeView:          ActiveView
  snoopTargetId:       string | null
  loadTournaments:     () => void
  loadGames:           (tid: string) => void
  loadPicks:           (tid: string) => void
  loadAllMyPicks:      () => void
  loadLeaderboard:     () => void
}

/**
 * Subscribes to all three critical Supabase tables over a single
 * channel so every open tab sees changes live:
 *
 *  - tournaments → UPDATE  : publish/lock/rename ripples to all users
 *  - games       → *       : INSERT/UPDATE/DELETE bracket changes
 *  - picks       → *       : any pick mutation refreshes the leaderboard
 */
export function useRealtimeSync({
  profile,
  selectedTournament,
  activeView,
  snoopTargetId,
  loadTournaments,
  loadGames,
  loadPicks,
  loadAllMyPicks,
  loadLeaderboard,
}: UseRealtimeSyncOptions): void {
  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel('app-realtime')

      // ── Tournaments ──────────────────────────────────────────
      // Covers status transitions (draft→open→locked), renames,
      // and config changes (scoring, round names, tiebreaker).
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
      }, () => {
        loadTournaments()
      })

      // ── Games ─────────────────────────────────────────────────
      // Wildcard catches INSERT (new games), UPDATE (winners, team
      // names, sort order), and DELETE (game removed by admin).
      // Uses the tournament_id from the payload so only the affected
      // tournament is re-fetched — not a full reload of everything.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'games',
      }, (payload: any) => {
        const tid = payload.new?.tournament_id ?? payload.old?.tournament_id
        if (tid) {
          loadGames(tid)
        } else if (selectedTournament) {
          loadGames(selectedTournament.id)
        }
        // Keep leaderboard fresh when actual_winner fields change
        if (activeView === 'leaderboard' || snoopTargetId) {
          loadLeaderboard()
        }
      })

      // ── Picks ─────────────────────────────────────────────────
      // Wildcard covers INSERT (new pick), UPDATE (tiebreaker edit),
      // and DELETE (pick removed). Refreshes own picks and leaderboard
      // but only runs the heavy leaderboard query when it's visible.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        if (selectedTournament) loadPicks(selectedTournament.id)
        loadAllMyPicks()
        if (activeView === 'leaderboard' || snoopTargetId) {
          loadLeaderboard()
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }

  }, [profile, selectedTournament, activeView, snoopTargetId])
}