// src/entities/tournament/model/queries.ts
//
// TanStack Query hooks for the tournament entity.
// All server state for tournaments and games lives here.
// Zustand (uiStore) owns selectedTournamentId — never mix them.
//
// ── Realtime Debounce Contract ────────────────────────────────
// `safeInvalidate()` checks `qc.isMutating()` before calling
// `invalidateQueries`. If any mutations are in-flight, the invalidation
// is deferred by REALTIME_DEBOUNCE_MS (150ms) to prevent Supabase
// Realtime "echo" events from clobbering optimistic UI updates.

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'

// FIX: path was '../../shared/store/uiStore' — correct depth from
// src/entities/tournament/model/ is three levels up to src/
import { useUIStore }              from '../../../shared/store/uiStore'
import * as api                    from '../api'
// FIX: TemplateKey removed — it is re-exported by CreateTournamentOptions
// from ../api; importing it here caused an "unused import" tsc error.
import type { Game, Tournament }    from '../../../shared/types'
import type { CreateTournamentOptions } from '../api'

// ── Constants ─────────────────────────────────────────────────

const REALTIME_DEBOUNCE_MS = 150

// ── Query Keys ────────────────────────────────────────────────
// Exported in full so any slice can participate in cross-slice
// cache management without duplicating key shapes.

export const tournamentKeys = {
  /** Root key — invalidating this invalidates every tournament query. */
  all:  ['tournaments']                   as const,

  /** Alias for `all` — use when the intent is "the list of tournaments". */
  list: ['tournaments']                   as const,

  /** Per-tournament game list. */
  games: (tid: string) => ['games', tid]  as const,
} as const

// ── Debounce Utility ──────────────────────────────────────────

/**
 * Invalidates a query key, but defers by REALTIME_DEBOUNCE_MS if any
 * mutations are currently in-flight. Prevents Realtime echoes from
 * clobbering optimistic UI updates mid-flight.
 */
function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  if (qc.isMutating() > 0) {
    setTimeout(() => {
      void qc.invalidateQueries({ queryKey })
    }, REALTIME_DEBOUNCE_MS)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

// ── unwrap helper ─────────────────────────────────────────────

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const result = await p
  if (!result.ok) throw new Error(result.error)
  return result.data
}

// ── Queries ───────────────────────────────────────────────────

export function useTournamentListQuery() {
  return useQuery({
    queryKey: tournamentKeys.list,
    queryFn:  () => unwrap(api.fetchTournaments()),
    select:   (data) => data ?? ([] as Tournament[]),
  })
}

/**
 * Load games for a single tournament on-demand.
 * Prefer this over `useAllTournamentGames` for all new code.
 */
export function useGames(tournamentId: string | null) {
  return useQuery({
    queryKey: tournamentKeys.games(tournamentId ?? ''),
    queryFn:  () => unwrap(api.fetchGames(tournamentId!)),
    enabled:  !!tournamentId,
    select:   (data) => data ?? ([] as Game[]),
  })
}

/**
 * @deprecated — Boot-time N-query fan-out is a performance flaw.
 * Use `useGames(tid)` on demand instead.
 *
 * Kept temporarily for backward compatibility during Phase 1 migration.
 * Will be removed in Phase 2.
 */
export function useAllTournamentGames(tournaments: Tournament[]) {
  return useQueries({
    queries: tournaments.map((t) => ({
      queryKey: tournamentKeys.games(t.id),
      queryFn:  () => unwrap(api.fetchGames(t.id)),
    })),
  })
}

// ── Cache Utilities ───────────────────────────────────────────

/**
 * Returns a stable function that writes directly to the games cache
 * for a given tournament ID via TanStack's `setQueryData`.
 *
 * Decouples `BracketContext` from `TournamentProvider`: consumers no
 * longer need to plumb `patchGamesCache` through context.
 *
 * Usage:
 *   const patchGamesCache = usePatchGamesCache()
 *   patchGamesCache(tid, prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
 */
export function usePatchGamesCache() {
  const qc = useQueryClient()
  return (tid: string, updater: (prev: Game[]) => Game[]) => {
    qc.setQueryData<Game[]>(tournamentKeys.games(tid), (prev) => updater(prev ?? []))
  }
}

// ── Mutations ─────────────────────────────────────────────────

export function useCreateTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts: CreateTournamentOptions) => unwrap(api.createTournament(opts)),
    onSuccess: (tournament) => {
      safeInvalidate(qc, tournamentKeys.all)
      safeInvalidate(qc, tournamentKeys.games(tournament.id))
      // Caller is responsible for navigating to the new tournament via uiStore.
      // Do not call uiStore here — side-effects belong at the call site.
    },
  })
}

/**
 * General-purpose tournament config updater.
 * Accepts `Partial<Tournament>` config fields — use this for all
 * attribute updates: name, scoring_config, round_names, lock times, etc.
 *
 * Exported as both `useUpdateTournamentMutation` and the
 * `updateTournamentConfig` alias to make intent explicit at call sites.
 */
export function useUpdateTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: {
      id:      string
      updates: Partial<Pick<Tournament,
        | 'name'
        | 'unlocks_at'
        | 'locks_at'
        | 'round_names'
        | 'scoring_config'
        | 'requires_tiebreaker'
      >>
    }) => unwrap(api.updateTournament(id, updates)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

/** Alias — use when the intent is updating config fields on a tournament. */
export const updateTournamentConfig = useUpdateTournamentMutation

export function usePublishTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.publishTournament(id)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useLockTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.lockTournament(id)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useDeleteTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, gameIds }: { id: string; gameIds: string[] }) =>
      unwrap(api.deleteTournament(id, gameIds)),
    onSuccess: (_data, { id }) => {
      // Remove the games cache entry immediately — no point keeping stale data.
      qc.removeQueries({ queryKey: tournamentKeys.games(id) })
      safeInvalidate(qc, tournamentKeys.all)
      // Navigate home after deletion. Using getState() avoids adding
      // navigateHome to the mutation's closure deps.
      useUIStore.getState().navigateHome()
    },
  })
}