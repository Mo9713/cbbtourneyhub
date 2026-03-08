// src/hooks/useLeaderboard.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

import * as pickService    from '../services/pickService'
import * as gameService    from '../services/gameService'
import * as profileService from '../services/profileService'
import { computeLeaderboard, type LeaderboardEntry } from '../services/leaderboardService'

import type { Profile, Tournament, Game, Pick } from '../types'

export interface LeaderboardState {
  leaderboard:         LeaderboardEntry[]
  allPicks:            Pick[]
  allGames:            Game[]
  allProfiles:         Profile[]

  // ── Tournament filter (admin) ───────────────────────────────
  selectedTournaments: Set<string>
  toggleTournament:    (id: string) => void

  // ── Snoop modal ─────────────────────────────────────────────
  snoopTargetId:       string | null
  setSnoopTargetId:    (id: string | null) => void

  loadLeaderboard:     () => Promise<void>
}

export function useLeaderboard(
  profile:     Profile | null,
  tournaments: Tournament[],
): LeaderboardState {

  const [allPicks,    setAllPicks]    = useState<Pick[]>([])
  const [allGames,    setAllGames]    = useState<Game[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])

  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(
    () => new Set<string>()
  )
  const [snoopTargetId, setSnoopTargetId] = useState<string | null>(null)

  // Tracks IDs already seeded into the filter so new tournaments
  // added at runtime are included automatically (Bug C fix).
  const knownIdsRef = useRef<Set<string>>(new Set())

  // ── Bug C fix: seed filter for newly added tournaments ──────
  // Old code guarded on `size === 0` so tournaments created or
  // published after the initial load were silently excluded.
  // This effect diffs incoming IDs against a stable ref so each
  // new ID is added exactly once regardless of when it appears.
  useEffect(() => {
    if (tournaments.length === 0) return

    const incoming  = tournaments.map(t => t.id)
    const newIds    = incoming.filter(id => !knownIdsRef.current.has(id))

    if (newIds.length === 0) return

    newIds.forEach(id => knownIdsRef.current.add(id))
    setSelectedTournaments(prev => {
      const next = new Set(prev)
      newIds.forEach(id => next.add(id))
      return next
    })
  }, [tournaments])

  // ── Loader ──────────────────────────────────────────────────

  const loadLeaderboard = useCallback(async () => {
    if (!profile) return
    const [picksRes, gamesRes, profilesRes] = await Promise.all([
      pickService.fetchAllPicks(),
      gameService.fetchAllGames(),
      profileService.fetchAllProfiles(),
    ])
    if (picksRes.ok)    setAllPicks(picksRes.data)
    if (gamesRes.ok)    setAllGames(gamesRes.data)
    if (profilesRes.ok) setAllProfiles(profilesRes.data)
  }, [profile])

  // ── Filter toggle ────────────────────────────────────────────

  const toggleTournament = useCallback((id: string) => {
    setSelectedTournaments(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // ── Derived leaderboard (pure memo — no setState needed) ────

  const leaderboard = useMemo((): LeaderboardEntry[] => {
    if (allProfiles.length === 0) return []
    const tournamentMap = new Map(tournaments.map(t => [t.id, t]))
    const scopedGames   = selectedTournaments.size > 0
      ? allGames.filter(g => selectedTournaments.has(g.tournament_id))
      : allGames
    return computeLeaderboard(allPicks, scopedGames, allGames, allProfiles, tournamentMap)
  }, [allPicks, allGames, allProfiles, tournaments, selectedTournaments])

  return {
    leaderboard,
    allPicks,
    allGames,
    allProfiles,
    selectedTournaments,
    toggleTournament,
    snoopTargetId,
    setSnoopTargetId,
    loadLeaderboard,
  }
}
