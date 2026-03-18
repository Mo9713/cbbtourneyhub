// ─────────────────────────────────────────────────────────────
// src/shared/lib/bracketMath.ts
// ─────────────────────────────────────────────────────────────

import type { Game, Pick, Tournament } from '../types'
import { isTBDName, getScore }         from './helpers'

// ─────────────────────────────────────────────────────────────
// § 0. Smart String Matching (First Four Support)
// ─────────────────────────────────────────────────────────────

export function isTeamMatch(
  teamName:     string | null | undefined,
  actualWinner: string | null | undefined,
): boolean {
  if (!teamName || !actualWinner) return false
  const t = teamName.trim().toLowerCase()
  const a = actualWinner.trim().toLowerCase()

  // Exact case-insensitive match — the primary and preferred path.
  if (t === a) return true

  // First Four slash strings only — exact equality per part, no substrings.
  if (t.includes('/')) {
    const parts = t.split('/').map(p => p.trim())
    if (parts.some(p => p === a)) return true
  }
  if (a.includes('/')) {
    const parts = a.split('/').map(p => p.trim())
    if (parts.some(p => p === t)) return true
  }

  return false
}

// ─────────────────────────────────────────────────────────────
// § 1. Cascade Delete Helper
// ─────────────────────────────────────────────────────────────

export function collectDownstreamGameIds(
  startGame: Game,
  allGames:  Game[],
): string[] {
  const gameById    = new Map(allGames.map(g => [g.id, g]))
  const downstream: string[] = []
  let currentId     = startGame.next_game_id

  while (currentId) {
    downstream.push(currentId)
    currentId = gameById.get(currentId)?.next_game_id ?? null
  }

  return downstream
}

// ─────────────────────────────────────────────────────────────
// § 2. Game Numbering
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
// § 3. Slot Resolution
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
      if (isTeamMatch(nextGame.team1_name, game.actual_winner)) return 'in1'
      if (isTeamMatch(nextGame.team2_name, game.actual_winner)) return 'in2'
    }
  }

  const feeders = games
    .filter(g => g.next_game_id === game.next_game_id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))

  return feeders.findIndex(r => r.id === game.id) === 0 ? 'in1' : 'in2'
}

// ─────────────────────────────────────────────────────────────
// § 4. Effective Name Derivation (DUAL-TRACK PREDICTION)
// ─────────────────────────────────────────────────────────────

export type DualSlot = {
  actual:        string
  predicted:     string
  actualSeed?:   number | null
  predictedSeed?: number | null
}
export type EffectiveNames = Record<string, { team1: DualSlot; team2: DualSlot }>

export function deriveEffectiveNames(
  games: Game[],
  picks: Pick[]
): EffectiveNames {

  const names: EffectiveNames = {}
  games.forEach(g => {
    names[g.id] = {
      team1: { actual: g.team1_name, predicted: g.team1_name, actualSeed: g.team1_seed, predictedSeed: g.team1_seed },
      team2: { actual: g.team2_name, predicted: g.team2_name, actualSeed: g.team2_seed, predictedSeed: g.team2_seed },
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

    const eff      = names[game.id]
    const curTeam1 = eff?.team1 ?? { actual: game.team1_name, predicted: game.team1_name, actualSeed: game.team1_seed, predictedSeed: game.team1_seed }
    const curTeam2 = eff?.team2 ?? { actual: game.team2_name, predicted: game.team2_name, actualSeed: game.team2_seed, predictedSeed: game.team2_seed }

    const actualWinner = game.actual_winner

    let userPickString = pickMap.get(game.id)
    let predictedWinningSeed: number | null | undefined = null

    // ── STRICT UPGRADE LOGIC ──
    // We check if the user's DB string matches the current slot via isTeamMatch.
    // If it does, we OVERRIDE their DB string with the clean curTeam.predicted string.
    if (userPickString === 'team1') {
      userPickString       = curTeam1.predicted
      predictedWinningSeed = curTeam1.predictedSeed
    } else if (userPickString === 'team2') {
      userPickString       = curTeam2.predicted
      predictedWinningSeed = curTeam2.predictedSeed
    } else if (userPickString) {
      if (isTeamMatch(userPickString, curTeam1.predicted)) {
        userPickString       = curTeam1.predicted
        predictedWinningSeed = curTeam1.predictedSeed
      } else if (isTeamMatch(userPickString, curTeam2.predicted)) {
        userPickString       = curTeam2.predicted
        predictedWinningSeed = curTeam2.predictedSeed
      }
    }

    // Automatically nullify pick if it STILL doesn't match after the upgrade check.
    if (userPickString && userPickString !== curTeam1.predicted && userPickString !== curTeam2.predicted) {
      userPickString       = undefined
      predictedWinningSeed = null
    }

    if (userPickString && isTBDName(userPickString)) {
      userPickString       = undefined
      predictedWinningSeed = null
    }

    const predictedWinner = userPickString ?? actualWinner

    let actualWinningSeed: number | null | undefined = null
    if (actualWinner) {
      if (isTeamMatch(curTeam1.actual, actualWinner))      actualWinningSeed = curTeam1.actualSeed
      else if (isTeamMatch(curTeam2.actual, actualWinner)) actualWinningSeed = curTeam2.actualSeed
    }

    if (!actualWinner && !predictedWinner) continue

    const nextGame = names[game.next_game_id]
    if (!nextGame) continue

    const slot = resolveAdvancingSlot(game, games, gameNums)

    if (slot === 'in1') {
      if (actualWinner)    { nextGame.team1.actual = actualWinner; nextGame.team1.actualSeed = actualWinningSeed }
      if (predictedWinner) { nextGame.team1.predicted = predictedWinner; nextGame.team1.predictedSeed = predictedWinningSeed }
    } else {
      if (actualWinner)    { nextGame.team2.actual = actualWinner; nextGame.team2.actualSeed = actualWinningSeed }
      if (predictedWinner) { nextGame.team2.predicted = predictedWinner; nextGame.team2.predictedSeed = predictedWinningSeed }
    }
  }

  return names
}

// ─────────────────────────────────────────────────────────────
// § 5. Deep Elimination & Local Scoring
// ─────────────────────────────────────────────────────────────

export function deriveEliminatedTeams(
  games:          Game[],
  effectiveNames: EffectiveNames
): Set<string> {
  const eliminated = new Set<string>()
  for (const game of games) {
    if (game.actual_winner) {
      const eff = effectiveNames[game.id]
      const t1  = eff?.team1.actual ?? game.team1_name
      const t2  = eff?.team2.actual ?? game.team2_name
      if (t1 && !isTeamMatch(t1, game.actual_winner) && !isTBDName(t1)) eliminated.add(t1)
      if (t2 && !isTeamMatch(t2, game.actual_winner) && !isTBDName(t2)) eliminated.add(t2)
    }
  }
  return eliminated
}

export function calculateLocalScore(
  games:          Game[],
  picks:          Pick[],
  effectiveNames: EffectiveNames,
  tournament:     Tournament,
): { current: number; max: number } {
  let current = 0
  let max     = 0
  const eliminated = deriveEliminatedTeams(games, effectiveNames)
  const pickMap    = new Map(picks.map(p => [p.game_id, p.predicted_winner]))

  for (const game of games) {
    const pts = tournament.scoring_config?.[String(game.round_num)] ?? getScore(game.round_num)

    let userPickString = pickMap.get(game.id)
    if (!userPickString) continue

    const eff = effectiveNames[game.id]
    if (eff) {
      // ── STRICT UPGRADE LOGIC ──
      if (userPickString === 'team1')      userPickString = eff.team1.predicted
      else if (userPickString === 'team2') userPickString = eff.team2.predicted
      else if (isTeamMatch(userPickString, eff.team1.predicted)) userPickString = eff.team1.predicted
      else if (isTeamMatch(userPickString, eff.team2.predicted)) userPickString = eff.team2.predicted
    }

    if (isTBDName(userPickString)) continue

    if (game.actual_winner) {
      if (isTeamMatch(userPickString, game.actual_winner)) { current += pts; max += pts }
    } else {
      // Because we upgraded the string, eliminated.has() works flawlessly!
      if (!eliminated.has(userPickString)) max += pts
    }
  }

  return { current, max }
}

// ─────────────────────────────────────────────────────────────
// § 6. Champion Derivation
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

  const directPick = picks.find(p => p.game_id === champGame.id)?.predicted_winner
  if (directPick) {
    let pickStr = directPick
    const eff = effectiveNames[champGame.id]
    if (eff) {
      // ── STRICT UPGRADE LOGIC ──
      if (directPick === 'team1') pickStr = eff.team1.predicted
      else if (directPick === 'team2') pickStr = eff.team2.predicted
      else if (isTeamMatch(directPick, eff.team1.predicted)) pickStr = eff.team1.predicted
      else if (isTeamMatch(directPick, eff.team2.predicted)) pickStr = eff.team2.predicted
    }
    if (!isTBDName(pickStr)) return pickStr
  }

  if (champGame.actual_winner) return champGame.actual_winner

  return null
}

// ─────────────────────────────────────────────────────────────
// § 7. Survivor Mass-Revival Utility
// ─────────────────────────────────────────────────────────────

export function isMassRevivalRound(
  roundGames:      Game[],
  allPicks:        Pick[],
  priorEliminated: Set<string>,
): boolean {
  const roundGameMap = new Map(roundGames.map(g => [g.id, g]))
  const roundGameIds = new Set(roundGames.map(g => g.id))
  const activePickers       = new Set<string>()
  const eliminatedThisRound = new Set<string>()

  for (const pick of allPicks) {
    if (!roundGameIds.has(pick.game_id))        continue
    if (priorEliminated.has(pick.user_id))      continue

    activePickers.add(pick.user_id)

    const game = roundGameMap.get(pick.game_id)!
    let predictedString = pick.predicted_winner
    if (predictedString === 'team1')      predictedString = game.team1_name
    else if (predictedString === 'team2') predictedString = game.team2_name

    if (!isTeamMatch(predictedString, game.actual_winner)) {
      eliminatedThisRound.add(pick.user_id)
    }
  }

  return activePickers.size > 0 && eliminatedThisRound.size === activePickers.size
}

// ─────────────────────────────────────────────────────────────
// § 8. SVG Connector Line Data
// ─────────────────────────────────────────────────────────────

export interface ConnectorLine {
  x1:       number
  y1:       number
  x2:       number
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
  scrollTop:     number,
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

export function computeAdminConnectorLines(
  games:         Game[],
  getOutRect:    (gameId: string)                       => DOMRect | null,
  getInRect:     (gameId: string, slot: 'in1' | 'in2') => DOMRect | null,
  containerRect: DOMRect,
  scrollLeft:    number,
  scrollTop:     number,
) {
  const lines: any[] = []

  for (const game of games) {
    if (!game.next_game_id) continue

    const outR = getOutRect(game.id)
    if (!outR) continue

    const outX = outR.left + outR.width  / 2 - containerRect.left + scrollLeft
    const outY = outR.top  + outR.height / 2 - containerRect.top  + scrollTop

    const feeders = games
      .filter(g => g.next_game_id === game.next_game_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))

    const slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'in1' : 'in2'

    const inR = getInRect(game.next_game_id, slot)
    if (!inR) continue

    const inX = inR.left + inR.width  / 2 - containerRect.left + scrollLeft
    const inY = inR.top  + inR.height / 2 - containerRect.top  + scrollTop

    lines.push({ x1: outX, y1: outY, x2: inX, y2: inY })
  }

  return lines
}