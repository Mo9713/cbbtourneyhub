// src/features/bracket/selectors.ts
// Pure functions — no React, no hooks. Safe to call anywhere.
import type { Game, Pick } from '../../types'

/** O(1) pick lookup — build once at the view boundary, pass down. */
export function buildPickMap(picks: Pick[]): Map<string, Pick> {
  return new Map(picks.map(p => [p.game_id, p]))
}

/** Group and sort games into display columns. Optionally filter by region. */
export function sortedRounds(
  games:         Game[],
  regionFilter?: string | null,
): [number, Game[]][] {
  const filtered = regionFilter
    ? games.filter(g => g.region === regionFilter)
    : games

  const map = new Map<number, Game[]>()
  for (const g of filtered) {
    if (!map.has(g.round_num)) map.set(g.round_num, [])
    map.get(g.round_num)!.push(g)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([r, gs]) => [
      r,
      [...gs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    ])
}

/** The championship game — highest round, no outgoing link. */
export function getChampGame(games: Game[]): Game | null {
  if (!games.length) return null
  const maxRound = Math.max(...games.map(g => g.round_num))
  return (
    games.find(g => g.round_num === maxRound && !g.next_game_id) ??
    games.find(g => g.round_num === maxRound) ??
    null
  )
}