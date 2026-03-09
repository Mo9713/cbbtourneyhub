// src/shared/utils/bracketMath.ts
// ─────────────────────────────────────────────────────────────

import type { Game, Pick } from '../../shared/types'
import { isTBDName }        from './helpers'

// ─────────────────────────────────────────────────────────────
// § 0. Cascade Delete Helper
// ─────────────────────────────────────────────────────────────

/**
 * Follows the next_game_id chain from a given game and returns
 * every downstream game ID in traversal order (closest first).
 * Does NOT include startGame.id itself.
 */
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

/**
 * Assigns a stable sequential display number to each game, ordered
 * first by round_num, then by sort_order within that round.
 *
 * Used to write and match "Winner of Game #N" placeholder text
 * when linking games in the bracket tree.
 *
 * @returns Record mapping game.id → display number (1-based)
 */
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

/**
 * Determines which display slot ('in1' = team1, 'in2' = team2) a
 * given game's winner should flow into in the next game.
 *
 * This is the SINGLE canonical three-tier priority algorithm used by:
 *   - deriveEffectiveNames() below  (user-facing bracket display)
 *   - AdminBuilderView SVG connectors (admin canvas lines)
 *   - gameService.ts setWinner()     (advancing winners server-side)
 *
 * All consumers MUST use this function. Inline reimplementations
 * will drift. See Phase 2 audit for prior divergence history.
 *
 * Priority:
 *   1. PRIMARY   — text-match: nextGame.team1_name or team2_name
 *                  equals "Winner of Game #N". Authoritative.
 *   2. SECONDARY — actual_winner has already been advanced;
 *                  match the team name that replaced the placeholder.
 *   3. FALLBACK  — sort feeders by sort_order + id, use positional
 *                  index. Only reached on brand-new templates before
 *                  placeholder text is written.
 */
export function resolveAdvancingSlot(
  game:        Game,
  games:       Game[],
  gameNumbers: Record<string, number>
): 'in1' | 'in2' {
  if (!game.next_game_id) return 'in1'

  const nextGame   = games.find(g => g.id === game.next_game_id)
  const winnerText = `Winner of Game #${gameNumbers[game.id]}`

  if (nextGame) {
    // 1. PRIMARY: placeholder text-match (fixed typo here)
    if (nextGame.team1_name === winnerText) return 'in1'
    if (nextGame.team2_name === winnerText) return 'in2'

    // 2. SECONDARY: winner already advanced, match by name
    if (game.actual_winner) {
      if (nextGame.team1_name === game.actual_winner) return 'in1'
      if (nextGame.team2_name === game.actual_winner) return 'in2'
    }
  }

  // 3. FALLBACK: positional index
  // FIX W-5: Variable was named `reeders` (f→r token mutation of `feeders`).
  const feeders = games
    .filter(g => g.next_game_id === game.next_game_id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))

  return feeders.findIndex(r => r.id === game.id) === 0 ? 'in1' : 'in2'
}

// ─────────────────────────────────────────────────────────────
// § 3. Effective Name Derivation
// ─────────────────────────────────────────────────────────────

/**
 * Derives the display name for both team slots in every game by
 * propagating user picks (and confirmed actual_winners) forward
 * through the bracket tree.
 *
 * Replaces "Winner of Game #N" placeholder text with the real
 * team name once the preceding game has a pick or result.
 *
 * Pick propagation rules:
 *   1. actual_winner always wins out (admin-confirmed result).
 *   2. A user pick is only propagated when BOTH slot names in the
 *      current game are real teams (not TBD/placeholder). If
 *      either slot is still a placeholder, the path hasn't resolved.
 *   3. GHOST PICK GUARD: a pick is discarded if the picked team
 *      does not match either current effective team in the game.
 *      This defends against orphaned DB rows surviving a partial
 *      cascade-delete failure. The bracket will not propagate a
 *      pick for a team that no longer occupies that slot.
 *   4. Games are processed in round_num ascending order so Round 1
 *      picks propagate correctly before Round 2 reads them.
 *
 * @param games - All games in the current tournament (any order)
 * @param picks - Current user's picks for this tournament
 * @returns     - Record mapping game.id → { team1, team2 } display strings
 */
export function deriveEffectiveNames(
  games: Game[],
  picks: Pick[]
): Record<string, { team1: string; team2: string }> {

  const names: Record<string, { team1: string; team2: string }> = {}
  games.forEach(g => {
    names[g.id] = { team1: g.team1_name, team2: g.team2_name }
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

    const currentTeam1 = names[game.id]?.team1 ?? game.team1_name
    const currentTeam2 = names[game.id]?.team2 ?? game.team2_name
    const slotsAreReal = !isTBDName(currentTeam1) && !isTBDName(currentTeam2)

    // ── Ghost pick guard ────────────────────────────────────
    // Retrieve the raw pick, then validate it against the
    // teams currently in this slot. A pick that doesn't match
    // either team is an orphaned row — discard it for display.
    let userPick = pickMap.get(game.id)
    if (userPick && userPick !== currentTeam1 && userPick !== currentTeam2) {
      userPick = undefined
    }

    const winner =
      game.actual_winner ??
      (slotsAreReal ? userPick : undefined)

    if (!winner) continue

    const nextGame = names[game.next_game_id]
    if (!nextGame) continue

    const slot = resolveAdvancingSlot(game, games, gameNums)

    if (slot === 'in1') {
      names[game.next_game_id] = { ...nextGame, team1: winner }
    } else {
      names[game.next_game_id] = { ...nextGame, team2: winner }
    }
  }

  return names
}

// ─────────────────────────────────────────────────────────────
// § 4. Champion Derivation
// ─────────────────────────────────────────────────────────────

/**
 * Returns the championship team name from a resolved bracket.
 *
 * Resolution priority:
 *   1. actual_winner on the championship game (admin confirmed)
 *   2. User's direct pick on the championship game (validated
 *      against effective slot names — ghost pick guard applies)
 *   3. A real team that has propagated into an effective slot
 *      via deriveEffectiveNames() (covers picks made in earlier
 *      rounds that have visually advanced to the final)
 *
 * Pass the already-computed effectiveNames to avoid re-computing.
 *
 * @returns Champion team name, or null if undetermined.
 */
export function deriveChampion(
  games:          Game[],
  picks:          Pick[],
  effectiveNames: Record<string, { team1: string; team2: string }>
): string | null {
  if (games.length === 0) return null

  const maxRound = Math.max(...games.map(g => g.round_num))

  const champGame =
    games.find(g => g.round_num === maxRound && !g.next_game_id) ??
    games.find(g => g.round_num === maxRound)

  if (!champGame) return null

  // 1. Admin-confirmed result
  if (champGame.actual_winner) return champGame.actual_winner

  // 2. Direct pick — validated against effective slot names
  // FIX N-1: Variable was named `err` (f→r token mutation of `eff`).
  const eff          = effectiveNames[champGame.id]
  const currentTeam1 = eff?.team1 ?? champGame.team1_name
  const currentTeam2 = eff?.team2 ?? champGame.team2_name

  const directPick = picks.find(p => p.game_id === champGame.id)?.predicted_winner
  if (directPick && (directPick === currentTeam1 || directPick === currentTeam2)) {
    return directPick
  }

  // 3. No champion determined yet.
  // (We intentionally DO NOT fall back to checking the slots here so it doesn't trigger prematurely)
  return null
}

// ─────────────────────────────────────────────────────────────
// § 5. SVG Connector Line Data
// ─────────────────────────────────────────────────────────────

/**
 * Data for one SVG connector line in the admin bracket canvas.
 * Coordinates are relative to the scrollable bracket container.
 */
export interface ConnectorLine {
  x1:       number
  y1:       number
  x2:       number
  x3?:      number   // elbow x (for L-shaped connectors)
  y2:       number
  gameId:   string
  fromSlot: 'in1' | 'in2'
}

/**
 * Computes SVG connector line data for the admin bracket canvas by
 * measuring DOM element positions. Pure data-computation — the
 * caller is responsible for providing the bounding rects.
 *
 * Separated here so the coordinate math can be tested without a DOM.
 * AdminBuilderView's useLayoutEffect calls this after measuring.
 */

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