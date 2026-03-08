// src/utils/bracketMath.ts
// ─────────────────────────────────────────────────────────────
// Pure, side-effect-free bracket math utilities.
//
// Extracted from BracketView.tsx and AdminBuilderView.tsx so that:
//   1. The logic can be unit-tested without rendering anything.
//   2. BracketView and AdminBuilderView import the same canonical
//      slot-resolution algorithm — no drift between the two.
//   3. The Context layer (BracketContext) can pre-compute these
//      values once and memoize them outside of any component.
//
// RULES FOR THIS FILE:
//   • No React imports. No hooks. No side effects.
//   • Every function must be a pure function:
//     same input → same output, always.
//   • No Supabase calls, no service imports.
// ─────────────────────────────────────────────────────────────

import type { Game, Pick } from '../types'
import { isTBDName }        from './helpers'


/**
 * Follows the next_game_id chain from a given game and returns
 * every downstream game ID in traversal order (closest first).
 *
 * Used by makePick() to determine which picks must be cascade-deleted
 * when a feeder pick is changed or toggled off.
 *
 * The bracket's next_game_id structure is a DAG that converges to
 * the championship, so there are no cycles and traversal always
 * terminates. Each game feeds into at most one downstream game.
 *
 * @param startGame  - The game whose pick is being changed/removed.
 * @param allGames   - All games in the active tournament.
 * @returns          - Ordered array of game IDs downstream of startGame
 *                     (does NOT include startGame.id itself).
 */
export function collectDownstreamGameIds(
  startGame: Game,
  allGames:  Game[],
): string[] {
  const gameById = new Map(allGames.map(g => [g.id, g]))
  const downstream: string[] = []
  let currentId = startGame.next_game_id

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
 * These numbers are used to write and match "Winner of Game #N"
 * placeholder text when linking games in the bracket tree.
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
 * Determines which slot ('in1' = team1, 'in2' = team2) a given
 * game's winner should flow into in the next game.
 *
 * This is the canonical three-tier priority algorithm used by:
 *   - deriveEffectiveNames() below  (user-facing bracket display)
 *   - AdminBuilderView SVG connectors (admin canvas lines)
 *   - gameService.setWinner()        (advancing winners server-side)
 *
 * All three consumers must use the same resolution order or the
 * displayed bracket, admin canvas, and DB state will diverge.
 *
 * Priority:
 *   1. PRIMARY   — text-match: nextGame.team1_name or team2_name equals
 *                  "Winner of Game #N". This is the authoritative source
 *                  written at link time by linkTemplateSlots().
 *   2. SECONDARY — if the actual_winner has already been set and advanced,
 *                  the placeholder was replaced by the team name — match that.
 *   3. FALLBACK  — sort all feeders of the next game by sort_order + id
 *                  and use positional index (0 = team1, 1+ = team2).
 *                  Only reached on fresh template games before any slot
 *                  labels have been written.
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
    // ── 1. PRIMARY: "Winner of Game #N" placeholder text-match ──
    if (
      nextGame.team1_name === winnerText ||
      game.team1_name     === winnerText   // defensive: self-referential edge case
    ) return 'in1'

    if (
      nextGame.team2_name === winnerText ||
      game.team2_name     === winnerText
    ) return 'in2'

    // ── 2. SECONDARY: actual_winner already advanced ─────────────
    if (game.actual_winner) {
      if (nextGame.team1_name === game.actual_winner) return 'in1'
      if (nextGame.team2_name === game.actual_winner) return 'in2'
    }
  }

  // ── 3. FALLBACK: positional index by sort_order + id ─────────
  const feeders = games
    .filter(g => g.next_game_id === game.next_game_id)
    .sort((a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id)
    )

  return feeders.findIndex(f => f.id === game.id) === 0 ? 'in1' : 'in2'
}

// ─────────────────────────────────────────────────────────────
// § 3. Effective Name Derivation
// ─────────────────────────────────────────────────────────────

/**
 * Derives the display name for both team slots in every game, by
 * propagating user picks (and confirmed actual_winners) forward
 * through the bracket tree.
 *
 * This replaces the "Winner of Game #N" placeholder text with the
 * real team name once the preceding game has a pick or a result,
 * so users see their bracket filling in as they make picks.
 *
 * Pick propagation rules:
 *   - actual_winner always wins out (admin-confirmed result).
 *   - A user pick is only propagated when BOTH slot names in the
 *     current game are real teams (not placeholders). If either
 *     slot is still "Winner of Game #N", the feeder game hasn't
 *     resolved yet and the pick cannot be meaningful.
 *   - Games are processed in round_num order (ascending) so that
 *     picks in earlier rounds propagate into later rounds correctly
 *     in a single pass.
 *
 * Slot resolution for where a winner propagates uses resolveAdvancingSlot()
 * — the same algorithm used by the SVG connector lines and gameService.
 *
 * @param games   - All games in the current tournament (any order)
 * @param picks   - All picks for the current user in this tournament
 * @returns       - Record mapping game.id → { team1, team2 } display strings
 */
export function deriveEffectiveNames(
  games: Game[],
  picks: Pick[]
): Record<string, { team1: string; team2: string }> {

  // Seed with raw DB values — mutations below are on this local copy only
  const names: Record<string, { team1: string; team2: string }> = {}
  games.forEach(g => {
    names[g.id] = { team1: g.team1_name, team2: g.team2_name }
  })

  const pickMap    = new Map(picks.map(p => [p.game_id, p.predicted_winner]))
  const gameNums   = computeGameNumbers(games)

  // Process ascending by round so round 1 propagates before round 2, etc.
  const sorted = [...games].sort((a, b) =>
    a.round_num !== b.round_num
      ? a.round_num - b.round_num
      : (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )

  for (const game of sorted) {
    if (!game.next_game_id) continue

    // Read the *current* (potentially already-updated) slot names for this game,
    // not the raw DB values — earlier propagation may have already filled them.
    const currentTeam1  = names[game.id]?.team1 ?? game.team1_name
    const currentTeam2  = names[game.id]?.team2 ?? game.team2_name

    // Only propagate a user pick when both teams are real.
    // If either slot is still a placeholder, the bracket path hasn't
    // resolved and the user hasn't (meaningfully) picked yet.
    const slotsAreReal  = !isTBDName(currentTeam1) && !isTBDName(currentTeam2)

    const winner =
      game.actual_winner ??
      (slotsAreReal ? pickMap.get(game.id) : undefined)

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
 *   2. User's direct pick on the championship game
 *   3. A team name that has propagated into the championship game's
 *      effective slots via pick propagation in deriveEffectiveNames()
 *      (covers the case where a pick was made in an earlier round
 *      and has visually advanced all the way to the final)
 *
 * Returns null if no champion can be determined yet.
 *
 * @param games         - All games in the tournament
 * @param picks         - Current user's picks
 * @param effectiveNames - Output of deriveEffectiveNames() — pass the
 *                         already-computed value to avoid re-computing.
 */
export function deriveChampion(
  games:          Game[],
  picks:          Pick[],
  effectiveNames: Record<string, { team1: string; team2: string }>
): string | null {
  if (games.length === 0) return null

  const maxRound = Math.max(...games.map(g => g.round_num))

  // Championship game: highest round, no next_game_id (true terminal node).
  // Fall back to any game at maxRound if all have next_game_id set.
  const champGame =
    games.find(g => g.round_num === maxRound && !g.next_game_id) ??
    games.find(g => g.round_num === maxRound)

  if (!champGame) return null

  // 1. Admin-confirmed result
  if (champGame.actual_winner) return champGame.actual_winner

  // 2. Direct pick on the championship game
  const directPick = picks.find(p => p.game_id === champGame.id)?.predicted_winner
  if (directPick) return directPick

  // 3. A real team that has propagated into an effective slot
  const eff = effectiveNames[champGame.id]
  if (eff) {
    if (eff.team1 && !isTBDName(eff.team1)) return eff.team1
    if (eff.team2 && !isTBDName(eff.team2)) return eff.team2
  }

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
  x3?:      number   // elbow x (for L-shaped connectors, optional)
  y2:       number
  gameId:   string
  fromSlot: 'in1' | 'in2'
}

/**
 * Computes SVG connector line data for the admin bracket canvas by
 * measuring DOM element positions. This is the pure data-computation
 * portion — the caller is responsible for providing the bounding rects.
 *
 * Separated here so the coordinate math can be tested without a DOM.
 * The AdminBuilderView's useLayoutEffect calls this after measuring.
 *
 * @param games         - All games (for slot resolution)
 * @param gameNumbers   - Output of computeGameNumbers()
 * @param getOutRect    - Callback: returns the output-dot DOMRect for a game id
 * @param getInRect     - Callback: returns the input-dot DOMRect for a slot
 * @param containerRect - The bracket container's DOMRect (for offset math)
 * @param scrollLeft    - container.scrollLeft
 * @param scrollTop     - container.scrollTop
 */
export function computeConnectorLines(
  games:         Game[],
  gameNumbers:   Record<string, number>,
  getOutRect:    (gameId: string)                           => DOMRect | null,
  getInRect:     (gameId: string, slot: 'in1' | 'in2')     => DOMRect | null,
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

    const slot  = resolveAdvancingSlot(game, games, gameNumbers)
    const inR   = getInRect(game.next_game_id, slot)
    if (!inR) continue

    const inX = inR.left + inR.width  / 2 - containerRect.left + scrollLeft
    const inY = inR.top  + inR.height / 2 - containerRect.top  + scrollTop

    lines.push({ x1: outX, y1: outY, x2: inX, y2: inY, gameId: game.id, fromSlot: slot })
  }

  return lines
}
