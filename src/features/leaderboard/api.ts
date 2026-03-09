// src/features/leaderboard/api.ts
import { supabase, withAuth } from '../../services/supabaseClient'
import type { Pick, Game, Profile, ServiceResult } from '../../types'

// All three fetches run in parallel — called as one unit in the query.
// RLS allows all authenticated users to read picks/games/profiles.

async function fetchAllPicks(): Promise<ServiceResult<Pick[]>> {
  return withAuth(async () => {
    const { data, error } = await supabase.from('picks').select('*')
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as Pick[] }
  })
}

async function fetchAllGames(): Promise<ServiceResult<Game[]>> {
  const { data, error } = await supabase
    .from('games').select('*').order('round_num', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Game[] }
}

async function fetchAllProfiles(): Promise<ServiceResult<Profile[]>> {
  return withAuth(async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as Profile[] }
  })
}

export interface LeaderboardRaw {
  allPicks:    Pick[]
  allGames:    Game[]
  allProfiles: Profile[]
}

export async function fetchLeaderboardData(): Promise<ServiceResult<LeaderboardRaw>> {
  const [picksRes, gamesRes, profilesRes] = await Promise.all([
    fetchAllPicks(),
    fetchAllGames(),
    fetchAllProfiles(),
  ])
  if (!picksRes.ok)    return { ok: false, error: picksRes.error }
  if (!gamesRes.ok)    return { ok: false, error: gamesRes.error }
  if (!profilesRes.ok) return { ok: false, error: profilesRes.error }
  return {
    ok:   true,
    data: {
      allPicks:    picksRes.data,
      allGames:    gamesRes.data,
      allProfiles: profilesRes.data,
    },
  }
}