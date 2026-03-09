// src/hooks/useRealtimeSync.ts
import { useEffect, useRef }   from 'react'
import { useQueryClient }      from '@tanstack/react-query'
import { supabase }            from '../services/supabaseClient'
import { tournamentKeys }      from '../features/tournament/queries'
import { useAuthContext }      from '../context/AuthContext'
import { useUIStore }          from '../store/uiStore'
import { useInternalBracketLoaders } from '../context/BracketContext'
import { useLeaderboardContext }      from '../context/LeaderboardContext'

export function useRealtimeSync(snoopTargetId: string | null): void {
  const qc                              = useQueryClient()
  const { profile }                     = useAuthContext()
  const { loadPicks, loadAllMyPicks }   = useInternalBracketLoaders()
  const { loadLeaderboard }             = useLeaderboardContext()

  // Refs so the channel closure always reads the latest values
  const activeViewRef  = useRef(useUIStore.getState().activeView)
  const selectedIdRef  = useRef(useUIStore.getState().selectedTournamentId)
  const snoopRef       = useRef(snoopTargetId)

  // Keep refs fresh without causing re-renders or re-subscribing
  useEffect(() => {
    return useUIStore.subscribe((s) => {
      activeViewRef.current  = s.activeView
      selectedIdRef.current  = s.selectedTournamentId
    })
  }, [])

  useEffect(() => { snoopRef.current = snoopTargetId }, [snoopTargetId])

  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel('app-realtime')

      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
      }, () => {
        qc.invalidateQueries({ queryKey: tournamentKeys.all })
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'games',
      }, (payload: any) => {
        const tid = payload.new?.tournament_id ?? payload.old?.tournament_id
        // Invalidate the specific tournament's games, or fall back to selected
        const target = tid ?? selectedIdRef.current
        if (target) qc.invalidateQueries({ queryKey: tournamentKeys.games(target) })

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          loadLeaderboard()
        }
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        const tid = selectedIdRef.current
        if (tid) loadPicks(tid)
        loadAllMyPicks()

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          loadLeaderboard()
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, qc, loadPicks, loadAllMyPicks, loadLeaderboard])
}