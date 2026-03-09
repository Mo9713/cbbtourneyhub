// src.features.bracket.queries.ts
import {
  useQuery, useMutation, useQueryClient,
} from '@tanstack/react-query'
import { collectDownstreamGameIds } from '../../shared/utils/bracketMath'
import * as api from './api'
import type { Game, Pick } from '../../shared/types'

// ── Query Keys ────────────────────────────────────────────────

export const pickKeys = {
  mine:    (tid: string)  => ['picks', 'mine', tid]  as const,
  allMine: ()             => ['picks', 'all-mine']   as const,
}

// ── Helper ────────────────────────────────────────────────────

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

// ── Queries ───────────────────────────────────────────────────

export function useMyPicks(tournamentId: string | null, games: Game[]) {
  const gameIds = games.map(g => g.id)
  return useQuery({
    queryKey: pickKeys.mine(tournamentId ?? ''),
    queryFn:  () => unwrap(api.fetchMyPicksForTournament(gameIds)),
    enabled:  !!tournamentId && games.length > 0,
    select:   (data) => data ?? ([] as Pick[]),
  })
}

export function useAllMyPicks() {
  return useQuery({
    queryKey: pickKeys.allMine(),
    queryFn:  () => unwrap(api.fetchAllMyPicks()),
    select:   (data) => data ?? ([] as Pick[]),
  })
}

// Derives per-tournament pick counts for the sidebar
export function useMyPickCounts(
  gamesCache: Record<string, Game[]>,
): Record<string, number> {
  const { data: allPicks = [] } = useAllMyPicks()
  const gameToTid = new Map<string, string>()
  Object.entries(gamesCache).forEach(([tid, games]) => {
    games.forEach(g => gameToTid.set(g.id, tid))
  })
  const counts: Record<string, number> = {}
  allPicks.forEach(p => {
    const tid = gameToTid.get(p.game_id)
    if (tid) counts[tid] = (counts[tid] ?? 0) + 1
  })
  return counts
}

// ── Mutations ─────────────────────────────────────────────────

interface MakePickVars {
  game:         Game
  team:         string
  tournamentId: string
  games:        Game[]         // needed for downstream cascade
  existingPick: Pick | undefined
}

export function useMakePick() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ game, team, games, existingPick }: MakePickVars) => {
      const downstreamIds = collectDownstreamGameIds(game, games)

      // Toggle: same team clicked again → delete pick + cascade
      if (existingPick?.predicted_winner === team) {
        await unwrap(api.deletePick(existingPick.id))
        await unwrap(api.deletePicksForGames(downstreamIds))
        return null
      }

      // New.changed pick: cascade first, then save
      await unwrap(api.deletePicksForGames(downstreamIds))
      return unwrap(api.savePick(game.id, team))
    },

    onMutate: async ({ game, team, tournamentId, games, existingPick }) => {
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })
      const prev = qc.getQueryData<Pick[]>(pickKeys.mine(tournamentId))

      const downstreamIds = new Set(collectDownstreamGameIds(game, games))
      const isToggle      = existingPick?.predicted_winner === team

      qc.setQueryData<Pick[]>(pickKeys.mine(tournamentId), (old = []) => {
        const filtered = old.filter(
          p => p.game_id !== game.id && !downstreamIds.has(p.game_id),
        )
        if (isToggle) return filtered

        // Optimistic new pick — real id filled in on settle
        const optimistic: Pick = {
          id:               'optimistic-' + Date.now(),
          user_id:          existingPick?.user_id ?? 'me',
          game_id:          game.id,
          predicted_winner: team,
          tiebreaker_score: null,
        }
        return [...filtered, optimistic]
      })

      return { prev }
    },

    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(pickKeys.mine(vars.tournamentId), ctx.prev)
      }
    },

    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: pickKeys.mine(vars.tournamentId) })
      qc.invalidateQueries({ queryKey: pickKeys.allMine() })
    },
  })
}

export function useSaveTiebreaker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ gameId, predictedWinner, score }: {
      gameId: string; predictedWinner: string; score: number; tournamentId: string
    }) => unwrap(api.saveTiebreakerScore(gameId, predictedWinner, score)),
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: pickKeys.mine(vars.tournamentId) })
    },
  })
}

