// src/features/leaderboard/queries.ts
import { useQuery } from '@tanstack/react-query'
import { fetchLeaderboardData } from './api'

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

// FIX: useLeaderboardInvalidator() was exported here but never called
// anywhere in the codebase. useRealtimeSync calls qc.invalidateQueries()
// directly with leaderboardKeys.raw. Exporting an unused hook function
// creates dead API surface — new contributors may import it believing it
// is the intended integration point, and it forces an unnecessary
// useQueryClient() call at every call site. Removed entirely.