// src/features/bracket/model/queries.ts
import { useAllMyPicks } from '../../../entities/pick/model/queries'
import type { Game } from '../../../shared/types'

// Re-export entity hooks to act as a feature facade for existing views
export {
  useMyPicks,
  useAllMyPicks,
  useMakePick,
  useSaveTiebreaker,
  pickKeys
} from '../../../entities/pick/model/queries'

// Derives per-tournament pick counts for the sidebar mapping
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