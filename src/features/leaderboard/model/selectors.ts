// src/features/leaderboard/model/selectors.ts

import { deriveEffectiveNames, calculateLocalScore, isTeamMatch } from '../../../shared/lib/bracketMath'
import type { Pick, Game, Profile, Tournament } from '../../../shared/types'

export interface LeaderboardEntry {
  profile:      Profile
  points:       number
  correct:      number
  total:        number
  maxPossible:  number
  isEliminated: boolean
  seedScore:    number
}

interface InternalEntry extends LeaderboardEntry {
  _eliminatedInSurvivorTids: Set<string>
  _firstElimRoundByTid:      Map<string, number>
}

export function computeLeaderboard(
  allPicks:      Pick[],
  filteredGames: Game[],
  _allGames:     Game[], 
  allProfiles:   Profile[],
  tournamentMap: Map<string, Tournament>,
): LeaderboardEntry[] {

  const scores: Record<string, InternalEntry> = {}

  allProfiles.forEach(p => {
    scores[p.id] = {
      profile:      p,
      points:       0,
      correct:      0,
      total:        0,
      maxPossible:  0,
      isEliminated: false,
      seedScore:    0,
      _eliminatedInSurvivorTids: new Set(),
      _firstElimRoundByTid:      new Map(),
    }
  })

  const filteredGameMap = new Map(filteredGames.map(g => [g.id, g]))

  // ── PRIMARY SCORING PASS (Survivor Only) ──────────────────
  allPicks.forEach(pick => {
    const entry = scores[pick.user_id]
    if (!entry) return

    const game = filteredGameMap.get(pick.game_id)
    if (!game)  return

    const tournament = tournamentMap.get(game.tournament_id)
    
    if (tournament?.game_type !== 'survivor') return

    let predictedString = pick.predicted_winner
    const isT1 = predictedString === 'team1'
    const isT2 = predictedString === 'team2'
    
    if (isT1) predictedString = game.team1_name
    else if (isT2) predictedString = game.team2_name

    entry.total++

    if (game.actual_winner) {
      if (isTeamMatch(predictedString, game.actual_winner)) {
        entry.points  += 1
        entry.correct += 1
        
        // FIX: ONLY add seed score if they correctly guessed the winner
        if (isT1 && game.team1_seed) {
          entry.seedScore += Number(game.team1_seed) || 0
        } else if (isT2 && game.team2_seed) {
          entry.seedScore += Number(game.team2_seed) || 0
        }

      } else {
        entry._eliminatedInSurvivorTids.add(game.tournament_id)
        const prev = entry._firstElimRoundByTid.get(game.tournament_id)
        if (prev === undefined || game.round_num < prev) {
          entry._firstElimRoundByTid.set(game.tournament_id, game.round_num)
        }
      }
    }
  })
  
  // ── SECONDARY SCORING PASS (Standard Brackets) ────────────────
  const picksByUser = new Map<string, Pick[]>()
  for (const p of allPicks) {
     const arr = picksByUser.get(p.user_id) ?? []
     arr.push(p)
     picksByUser.set(p.user_id, arr)
  }

  for (const [uid, internalEntry] of Object.entries(scores)) {
    const uPicks = picksByUser.get(uid) ?? []

    for (const [tid, tournament] of tournamentMap.entries()) {
      if (tournament.game_type === 'survivor') continue 

      const tGames = filteredGames.filter(g => g.tournament_id === tid)
      const tPicks = uPicks.filter(p => tGames.some(g => g.id === p.game_id))
      
      internalEntry.total += tPicks.length

      const effNames = deriveEffectiveNames(tGames, tPicks)
      const s = calculateLocalScore(tGames, tPicks, effNames, tournament)
      
      internalEntry.points += s.current
      internalEntry.maxPossible += s.max
      
      for (const pick of tPicks) {
        const game = tGames.find(g => g.id === pick.game_id)
        if (game?.actual_winner) {
          let pStr = pick.predicted_winner
          const eff = effNames[game.id]
          if (eff) {
            if (pStr === 'team1') pStr = eff.team1.predicted
            else if (pStr === 'team2') pStr = eff.team2.predicted
          }
          if (isTeamMatch(pStr, game.actual_winner)) internalEntry.correct += 1
        }
      }
    }
  }

  // ──REVIVE_ALL POST-PROCESSING PASS──────────────────────────────
  for (const [tid, tournament] of tournamentMap.entries()) {
    if (tournament.game_type !== 'survivor') continue
    if (tournament.survivor_elimination_rule !== 'revive_all') continue

    const tournamentGames    = filteredGames.filter(g => g.tournament_id === tid)
    const allTournamentPicks = allPicks.filter(p =>
      tournamentGames.some(g => g.id === p.game_id),
    )

    const gamesByRound = new Map<number, Game[]>()
    for (const g of tournamentGames) {
      const existing = gamesByRound.get(g.round_num) ?? []
      gamesByRound.set(g.round_num, [...existing, g])
    }
    const sortedRounds = [...gamesByRound.entries()].sort(([a], [b]) => a - b)

    const cumulativeEliminated = new Set<string>()

    for (const [_round, roundGames] of sortedRounds) {
      if (!roundGames.every(g => !!g.actual_winner)) break

      const roundGameIds = new Set(roundGames.map(g => g.id))
      const activePickers       = new Set<string>()
      const eliminatedThisRound = new Set<string>()

      for (const pick of allTournamentPicks) {
        if (!roundGameIds.has(pick.game_id))       continue
        if (cumulativeEliminated.has(pick.user_id)) continue

        activePickers.add(pick.user_id)

        const game = roundGames.find(g => g.id === pick.game_id)!
        let predictedString = pick.predicted_winner
        if (predictedString === 'team1') predictedString = game.team1_name
        else if (predictedString === 'team2') predictedString = game.team2_name

        if (!isTeamMatch(predictedString, game.actual_winner)) {
          eliminatedThisRound.add(pick.user_id)
        }
      }

      if (activePickers.size > 0 && eliminatedThisRound.size === activePickers.size) {
        for (const uid of eliminatedThisRound) {
          scores[uid]?._eliminatedInSurvivorTids.delete(tid)
          scores[uid]?._firstElimRoundByTid.delete(tid)
        }
      } else {
        for (const uid of eliminatedThisRound) {
          cumulativeEliminated.add(uid)
        }
      }
    }
  }

  // ── DETERMINE ELIMINATION DISPLAY MODE ───────────────────
  const viewSurvivorTids = new Set<string>()
  const viewStandardTids = new Set<string>()

  filteredGames.forEach(g => {
    const t = tournamentMap.get(g.tournament_id)
    if (t?.game_type === 'survivor') viewSurvivorTids.add(g.tournament_id)
    else viewStandardTids.add(g.tournament_id)
  })

  const eliminationApplies = viewSurvivorTids.size > 0 && viewStandardTids.size === 0

  const entries = Object.values(scores).map((internalEntry): LeaderboardEntry => {
    const { _eliminatedInSurvivorTids, _firstElimRoundByTid, ...publicEntry } = internalEntry

    if (eliminationApplies) {
      publicEntry.isEliminated = [...viewSurvivorTids].every(tid =>
        _eliminatedInSurvivorTids.has(tid),
      )
    } else {
      publicEntry.isEliminated = false
    }

    return publicEntry
  })

  return entries.sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1
    if (b.points       !== a.points)       return b.points - a.points
    if (b.seedScore    !== a.seedScore)     return b.seedScore - a.seedScore
    return b.correct - a.correct
  })
}