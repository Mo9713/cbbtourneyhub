// src/shared/libs/bracketMath.ts
// ─────────────────────────────────────────────────────────────

import type { Game, Pick, Tournament } from '../../shared/types'
import { isTBDName, getScore }         from './helpers'

// ─────────────────────────────────────────────────────────────
// § 0. Cascade Delete Helper
// ─────────────────────────────────────────────────────────────

export function collectDownstreamGameIds(
  startGame: Game,
  allGames:  Game[],
): string[] {
  const gameById   = new Map(allGames.map(g => [g.id, g]))
  const downstream: string[] = []
  let currentId    = startGame.next_game_id

  while (currentId) {
    downstream.push(currentId)
    currentId = gameById.get(currentId)?.next_game_id ?? null
  }

  return downstream
}

// ─────────────────────────────────────────────────────────────
// § 1. Game Numbering
// ─────────────────────────────────────────────────────────────

export function computeGameNumbers(games: Game[]): Record<string, number> {
  const sorted = [...games].sort((a, b) =>
    a.round_num !== b.round_num
      ? a.round_num - b.round_num
      : (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
  const map: Record<string, number> = {}
  sorted.forEach((g, i) => { map[g.id] = i + 1 })
  return map
}

// ─────────────────────────────────────────────────────────────
// § 2. Slot Resolution
// ─────────────────────────────────────────────────────────────

export function resolveAdvancingSlot(
  game:        Game,
  games:       Game[],
  gameNumbers: Record<string, number>
): 'in1' | 'in2' {
  if (!game.next_game_id) return 'in1'

  const nextGame   = games.find(g => g.id === game.next_game_id)
  const winnerText = `Winner of Game #${gameNumbers[game.id]}`

  if (nextGame) {
    if (nextGame.team1_name === winnerText) return 'in1'
    if (nextGame.team2_name === winnerText) return 'in2'

    if (game.actual_winner) {
      if (nextGame.team1_name === game.actual_winner) return 'in1'
      if (nextGame.team2_name === game.actual_winner) return 'in2'
    }
  }

  const feeders = games
    .filter(g => g.next_game_id === game.next_game_id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))

  return feeders.findIndex(r => r.id === game.id) === 0 ? 'in1' : 'in2'
}

// ─────────────────────────────────────────────────────────────
// § 3. Effective Name Derivation (DUAL-TRACK PREDICTION)
// ─────────────────────────────────────────────────────────────

export type DualSlot = { actual: string; predicted: string }
export type EffectiveNames = Record<string, { team1: DualSlot; team2: DualSlot }>

export function deriveEffectiveNames(
  games: Game[],
  picks: Pick[]
): EffectiveNames {

  const names: EffectiveNames = {}
  games.forEach(g => {
    names[g.id] = { 
      team1: { actual: g.team1_name, predicted: g.team1_name }, 
      team2: { actual: g.team2_name, predicted: g.team2_name } 
    }
  })

  const pickMap  = new Map(picks.map(p => [p.game_id, p.predicted_winner]))
  const gameNums = computeGameNumbers(games)

  const sorted = [...games].sort((a, b) =>
    a.round_num !== b.round_num
      ? a.round_num - b.round_num
      : (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )

  for (const game of sorted) {
    if (!game.next_game_id) continue

    const eff = names[game.id]
    const curTeam1 = eff?.team1 ?? { actual: game.team1_name, predicted: game.team1_name }
    const curTeam2 = eff?.team2 ?? { actual: game.team2_name, predicted: game.team2_name }

    const actualWinner = game.actual_winner
    const predSlotsAreReal = !isTBDName(curTeam1.predicted) && !isTBDName(curTeam2.predicted)

    let userPick = pickMap.get(game.id)
    if (userPick && userPick !== curTeam1.predicted && userPick !== curTeam2.predicted) {
      userPick = undefined
    }

    const predictedWinner = (predSlotsAreReal ? userPick : undefined) ?? actualWinner

    if (!actualWinner && !predictedWinner) continue

    const nextGame = names[game.next_game_id]
    if (!nextGame) continue

    const slot = resolveAdvancingSlot(game, games, gameNums)

    if (slot === 'in1') {
      if (actualWinner)    nextGame.team1.actual    = actualWinner
      if (predictedWinner) nextGame.team1.predicted = predictedWinner
    } else {
      if (actualWinner)    nextGame.team2.actual    = actualWinner
      if (predictedWinner) nextGame.team2.predicted = predictedWinner
    }
  }

  return names
}

// ─────────────────────────────────────────────────────────────
// § 4. Deep Elimination & Local Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Returns a Set of team names that have officially lost a game.
 */
export function deriveEliminatedTeams(games: Game[], effectiveNames: EffectiveNames): Set<string> {
  const eliminated = new Set<string>()
  for (const game of games) {
    if (game.actual_winner) {
      const eff = effectiveNames[game.id]
      const t1 = eff?.team1.actual ?? game.team1_name
      const t2 = eff?.team2.actual ?? game.team2_name

      if (t1 && t1 !== game.actual_winner && !isTBDName(t1)) eliminated.add(t1)
      if (t2 && t2 !== game.actual_winner && !isTBDName(t2)) eliminated.add(t2)
    }
  }
  return eliminated
}

/**
 * Lightweight, modular scoring engine for a single bracket view.
 */
export function calculateLocalScore(
  games: Game[],
  picks: Pick[],
  effectiveNames: EffectiveNames,
  tournament: Tournament
): { current: number; max: number } {
  let current = 0
  let max = 0
  const eliminated = deriveEliminatedTeams(games, effectiveNames)
  const pickMap = new Map(picks.map(p => [p.game_id, p.predicted_winner]))

  for (const game of games) {
    const pts = tournament.scoring_config?.[String(game.round_num)] ?? getScore(game.round_num)
    const userPick = pickMap.get(game.id)

    if (!userPick || isTBDName(userPick)) continue

    if (game.actual_winner) {
      if (game.actual_winner === userPick) {
        current += pts
        max += pts
      }
    } else {
      // Game hasn't happened. Is the predicted team still alive?
      if (!eliminated.has(userPick)) {
        max += pts
      }
    }
  }

  return { current, max }
}

// ─────────────────────────────────────────────────────────────
// § 5. Champion Derivation
// ─────────────────────────────────────────────────────────────

export function deriveChampion(
  games:          Game[],
  picks:          Pick[],
  effectiveNames: EffectiveNames
): string | null {
  if (games.length === 0) return null

  const maxRound = Math.max(...games.map(g => g.round_num))

  const champGame =
    games.find(g => g.round_num === maxRound && !g.next_game_id) ??
    games.find(g => g.round_num === maxRound)

  if (!champGame) return null

  if (champGame.actual_winner) return champGame.actual_winner

  const eff          = effectiveNames[champGame.id]
  const currentTeam1 = eff?.team1.predicted ?? champGame.team1_name
  const currentTeam2 = eff?.team2.predicted ?? champGame.team2_name

  const directPick = picks.find(p => p.game_id === champGame.id)?.predicted_winner
  if (directPick && (directPick === currentTeam1 || directPick === currentTeam2)) {
    return directPick
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// § 6. SVG Connector Line Data
// ─────────────────────────────────────────────────────────────

export interface ConnectorLine {
  x1:       number
  y1:       number
  x2:       number
  x3?:      number 
  y2:       number
  gameId:   string
  fromSlot: 'in1' | 'in2'
}

export function computeConnectorLines(
  games:         Game[],
  gameNumbers:   Record<string, number>,
  getOutRect:    (gameId: string)                       => DOMRect | null,
  getInRect:     (gameId: string, slot: 'in1' | 'in2') => DOMRect | null,
  containerRect: DOMRect,
  scrollLeft:    number,
  scrollTop:     number
): ConnectorLine[] {
  const lines: ConnectorLine[] = []

  for (const game of games) {
    if (!game.next_game_id) continue

    const outR = getOutRect(game.id)
    if (!outR) continue

    const outX = outR.left + outR.width  / 2 - containerRect.left + scrollLeft
    const outY = outR.top  + outR.height / 2 - containerRect.top  + scrollTop

    const slot = resolveAdvancingSlot(game, games, gameNumbers)
    const inR  = getInRect(game.next_game_id, slot)
    if (!inR) continue

    const inX = inR.left + inR.width  / 2 - containerRect.left + scrollLeft
    const inY = inR.top  + inR.height / 2 - containerRect.top  + scrollTop

    lines.push({ x1: outX, y1: outY, x2: inX, y2: inY, gameId: game.id, fromSlot: slot })
  }

  return lines
}

// ─────────────────────────────────────────────────────────────
// § 7. Leaderboard Scoring Resolution
// ─────────────────────────────────────────────────────────────

export function resolveScore(roundNum: number, config?: Record<string, number> | null): number {
  return config?.[String(roundNum)] ?? getScore(roundNum)
}