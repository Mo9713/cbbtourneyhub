// src/app/hooks/useRealtimeSync.ts

import { useEffect, useRef }         from 'react'
import { useQueryClient }            from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { supabase }                  from '../../shared/infra/supabaseClient'
import { tournamentKeys }            from '../../entities/tournament/model/queries'
import { leaderboardKeys }           from '../../features/leaderboard'
import { useAuthContext }            from '../../features/auth'
import { useUIStore }                from '../../shared/store/uiStore'
import { useInternalBracketLoaders } from '../../features/bracket'

// Minimal row shapes used to type the realtime payloads.
// We only access tournament_id from these rows, so we declare only that field.
type GameRow = { tournament_id: string }

export function useRealtimeSync(): void {
  const qc                            = useQueryClient()
  const { profile }                   = useAuthContext()
  const { loadPicks, loadAllMyPicks } = useInternalBracketLoaders()

  // ── Stable refs for Zustand navigation state ──────────────
  //
  // Reading Zustand state via refs (rather than reactive selectors)
  // inside the realtime handlers avoids adding store slice values
  // to the channel effect's dependency array — which would cause a
  // full channel teardown/reconnect on every navigation action.
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

  // ── Stable refs for BracketContext loader functions ───────
  //
  // `loadPicks` and `loadAllMyPicks` come from a `useMemo` inside
  // BracketContext that produces a new object reference every time
  // BracketProvider remounts (on every view navigation). Mirroring
  // them into refs keeps the channel effect's dep array minimal
  // ([profile?.id, qc]) so the Realtime channel is never needlessly
  // torn down and rebuilt mid-session.
  const loadPicksRef      = useRef(loadPicks)
  const loadAllMyPicksRef = useRef(loadAllMyPicks)

  useEffect(() => {
    loadPicksRef.current      = loadPicks
    loadAllMyPicksRef.current = loadAllMyPicks
  }) // intentionally no deps — always keeps refs current

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
        // payload.new is the full row for INSERT/UPDATE, empty for DELETE.
        // payload.old is the full row for DELETE/UPDATE, empty for INSERT.
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
        if (tid) loadPicksRef.current(tid)
        loadAllMyPicksRef.current()

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          void qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, qc])
}