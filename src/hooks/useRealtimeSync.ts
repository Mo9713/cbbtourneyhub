// src/hooks/useRealtimeSync.ts

import { useEffect, useRef } from 'react'
import { supabase }                from '../services/supabaseClient'
import { useAuthContext }          from '../context/AuthContext'
import { useTournamentContext }    from '../context/TournamentContext'
import { useBracketContext }       from '../context/BracketContext'
import { useLeaderboardContext }   from '../context/LeaderboardContext'

export function useRealtimeSync(snoopTargetId: string | null): void {
  const { profile } = useAuthContext()

  const {
    selectedTournament,
    activeView,
    loadTournaments,
    loadGames,
  } = useTournamentContext()

  const { loadPicks, loadAllMyPicks }  = useBracketContext()
  const { loadLeaderboard }            = useLeaderboardContext()

  // ── Mutable refs: handlers always read the latest nav state ──
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
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
      }, () => {
        loadTournaments()
      })

      // ── games ─────────────────────────────────────────────────
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loadTournaments, loadGames, loadPicks, loadAllMyPicks, loadLeaderboard])
}