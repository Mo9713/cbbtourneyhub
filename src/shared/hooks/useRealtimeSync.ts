// src.hooks.useRealtimeSync.ts
import { useEffect, useRef }          from 'react'
import { useQueryClient }             from '@tanstack/react-query'
import { supabase }                   from '../../lib/supabaseClient'
import { tournamentKeys }             from '../../features/tournament'
import { pickKeys }                   from '../../features/bracket'
import { leaderboardKeys }            from '../../features/leaderboard'
import { useAuthContext }             from '../../features/auth'
import { useUIStore }                 from '../../store/uiStore'
import { useInternalBracketLoaders }  from '../../features/bracket'

export function useRealtimeSync(): void {
  const qc                            = useQueryClient()
  const { profile }                   = useAuthContext()
  const { loadPicks, loadAllMyPicks } = useInternalBracketLoaders()

  const activeViewRef = useRef(useUIStore.getState().activeView)
  const selectedIdRef = useRef(useUIStore.getState().selectedTournamentId)
  const snoopRef      = useRef(useUIStore.getState().snoopTargetId)

  useEffect(() => {
    return useUIStore.subscribe((s) => {
      activeViewRef.current = s.activeView
      selectedIdRef.current = s.selectedTournamentId
      snoopRef.current      = s.snoopTargetId
    })
  }, [])

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
        const tid    = payload.new?.tournament_id ?? payload.old?.tournament_id
        const target = tid ?? selectedIdRef.current
        if (target) qc.invalidateQueries({ queryKey: tournamentKeys.games(target) })

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
        }
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        const tid = selectedIdRef.current
        if (tid) loadPicks(tid)
        loadAllMyPicks()

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, qc, loadPicks, loadAllMyPicks])
}



