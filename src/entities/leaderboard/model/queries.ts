// src/entities/leaderboard/model/queries.ts

import { useQuery }                from '@tanstack/react-query'
import { unwrap }                  from '../../../shared/lib/unwrap'
import { fetchLeaderboardData }    from '../api'
import type { LeaderboardRaw }     from '../api'

export const leaderboardKeys = {
  raw: ['leaderboard', 'raw'] as const,
}

/** Fetches all picks, games, and profiles in one parallel shot. */
export function useLeaderboardRaw() {
  return useQuery<LeaderboardRaw, Error>({
    queryKey: leaderboardKeys.raw,
    queryFn:  () => unwrap(fetchLeaderboardData()),
  })
}