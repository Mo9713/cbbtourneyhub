// src/shared/hooks/useRealtimeSync.ts
import { useEffect, useRef }          from 'react'
import { useQueryClient }             from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase }                   from '../../shared/infra/supabaseClient'
import { tournamentKeys }             from '../../features/tournament'
import { leaderboardKeys }            from '../../features/leaderboard'
import { useAuthContext }             from '../../features/auth'
import { useUIStore }                 from '../../shared/store/uiStore'
import { useInternalBracketLoaders }  from '../../features/bracket'

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

  // ── FIX: Stable refs for BracketContext loader functions ──
  //
  // Problem: `loadPicks` and `loadAllMyPicks` come from a `useMemo`
  // inside BracketContext. That memo produces a new object reference
  // every time BracketProvider remounts — which happens on every
  // view navigation (HomeView ↔ BracketView). This changed the
  // dependency array [profile?.id, qc, loadPicks, loadAllMyPicks],
  // causing the channel effect to run its cleanup (removeChannel)
  // and immediately re-subscribe. During that brief teardown window,
  // any postgres_changes events on `picks` or `games` are silently
  // dropped — pick updates during a live tournament would not trigger
  // cache invalidation until the next reconnection.
  //
  // Fix: mirror the existing pattern for Zustand state — capture the
  // latest function references in refs updated on every render.
  // The channel effect's dependency array shrinks to [profile?.id, qc],
  // both of which are genuinely stable for the lifetime of a session.
  //
  // The "no dependency array" pattern on the sync effect is intentional:
  // it runs after every render to keep the refs current, but it does NOT
  // subscribe/unsubscribe from anything — it has zero side-effects to clean up.
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
        qc.invalidateQueries({ queryKey: tournamentKeys.all })
      })

      // FIX: Was typed as `payload: any`, which made TypeScript blind
      // to any shape changes in the realtime payload. Typed using the
      // Supabase generic so property accesses on .new/.old are guarded.
      // The row generic only needs to declare the field we actually read.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'games',
      }, (payload: RealtimePostgresChangesPayload<GameRow>) => {
        // payload.new is the full row for INSERT/UPDATE, empty for DELETE.
        // payload.old is the full row for DELETE/UPDATE, empty for INSERT.
        const tid    = (payload.new as Partial<GameRow>).tournament_id
                    ?? (payload.old as Partial<GameRow>).tournament_id
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
        if (tid) loadPicksRef.current(tid)    // FIX W-2: via ref, not closure
        loadAllMyPicksRef.current()            // FIX W-2: via ref, not closure

        if (activeViewRef.current === 'leaderboard' || snoopRef.current) {
          qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
        }
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, qc]) // FIX W-2: loadPicks/loadAllMyPicks removed — read via refs above
}