// src/hooks/useLeaderboard.ts
// ─────────────────────────────────────────────────────────────
// Owns all leaderboard data: raw picks, games, profiles, and
// the derived standings computation.
//
// ── Removed in Phase 1 refactor ──────────────────────────────
//   snoopTargetId / setSnoopTargetId — previously lived here
//   and caused every LeaderboardContext subscriber to re-render
//   whenever the snoop modal opened or closed. Snoop open/close
//   is now local state in AppShell. The snoopTargetId value is
//   passed as a prop to LeaderboardProvider solely to trigger
//   the loadLeaderboard() call when snoop is activated from a
//   non-leaderboard view (e.g., the bracket view).
// ─────────────────────────────────────────────────────────────

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

  // Tracks IDs already seeded into the filter so new tournaments
  // added at runtime are included automatically (Bug C fix).
  const knownIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (tournaments.length === 0) return

    const incoming = tournaments.map(t => t.id)
    const newIds   = incoming.filter(id => !knownIdsRef.current.has(id))

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

  // ── Derived leaderboard ──────────────────────────────────────

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
    loadLeaderboard,
  }
}