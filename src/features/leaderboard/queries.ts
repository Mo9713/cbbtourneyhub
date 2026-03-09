// src/features/leaderboard/queries.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeaderboardData }     from './api'

export const leaderboardKeys = {
  raw: ['leaderboard', 'raw'] as const,
}

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

/** Fetches all picks, games, and profiles in one parallel shot. */
export function useLeaderboardRaw() {
  return useQuery({
    queryKey: leaderboardKeys.raw,
    queryFn:  () => unwrap(fetchLeaderboardData()),
    // No stale override — inherits the 1-min staleTime from queryClient defaults.
    // Components mounting this hook trigger a fetch; realtime invalidates it.
  })
}

/** Convenience: expose the invalidator so useRealtimeSync can call it. */
export function useLeaderboardInvalidator() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: leaderboardKeys.raw })
}