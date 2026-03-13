// src/app/hooks/useRealtimeSync.ts

import { useEffect, useRef }         from 'react'
import { useQueryClient }            from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { supabase }                  from '../../shared/infra/supabaseClient'
import { tournamentKeys }            from '../../entities/tournament/model/queries'
import { pickKeys }                  from '../../entities/pick/model/queries'
import { leaderboardKeys }           from '../../entities/leaderboard/model/queries'
import { useAuth }                   from '../../features/auth/model/useAuth'
import { useUIStore }                from '../../shared/store/uiStore'

type GameRow = { tournament_id: string }

export function useRealtimeSync(): void {
  const qc          = useQueryClient()
  const { profile } = useAuth()

  // ── Stable refs for Zustand navigation state ──────────────
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

  // ── Realtime channel ──────────────────────────────────────
  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel('app-realtime')

      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
      }, () => {
        void qc.invalidateQueries({ queryKey: tournamentKeys.all })
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'games',
      }, (payload: RealtimePostgresChangesPayload<GameRow>) => {
        const tid    = (payload.new as Partial<GameRow>).tournament_id
                    ?? (payload.old as Partial<GameRow>).tournament_id
        const target = tid ?? selectedIdRef.current
        if (target) void qc.invalidateQueries({ queryKey: tournamentKeys.games(target) })

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          void qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
        }
      })

      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
      }, () => {
        const tid = selectedIdRef.current
        if (tid) void qc.invalidateQueries({ queryKey: pickKeys.mine(tid) })
        void qc.invalidateQueries({ queryKey: pickKeys.allMine() })

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          void qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, qc])
}