// src/features/bracket/ui/BracketView/BracketGrid.tsx

// ── Imports ───────────────────────────────────────────────────────────────────
import {
  useRef, useState, useCallback, useLayoutEffect, useMemo,
} from 'react'
import MatchupColumn, { type SlotItem } from './MatchupColumn'
import ChampionCallout                    from './ChampionCallout'
import SvgConnectors                      from '../../../../shared/ui/SvgConnectors'
import {
  computeConnectorLines,
  type ConnectorLine,
  type EffectiveNames,
}                                         from '../../../../shared/lib/bracketMath'
import type { Game, Pick, Tournament }   from '../../../../shared/types'

// ── Layout constants ──────────────────────────────────────────────────────────
// HEADER_H: must match the h-12 (48px) column header in MatchupColumn.
const HEADER_H = 64   // px

// SLOT_H: height (px) for each leaf slot in round 1.
// Reverted from 88 to 58. This compacts the layout horizontally,
// stopping the overlap with the round headers.
const SLOT_H   = 64   // px

// ── Ghost-node slot grid ──────────────────────────────────────────────────────

/**
 * Determines which input slot (in1 = top / in2 = bottom) a feeder game
 * advances into on its next game.  Lower game-number sibling → in1.
 */
function resolveSlot(
  feeder:      Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): 'in1' | 'in2' {
  if (!feeder.next_game_id) return 'in1'

  const siblings = allGames
    .filter(g => g.next_game_id === feeder.next_game_id)
    .sort((a, b) => (gameNumbers[a.id] ?? 0) - (gameNumbers[b.id] ?? 0))

  return siblings.length === 0 || siblings[0].id === feeder.id ? 'in1' : 'in2'
}

/**
 * Builds a Map<roundNumber, SlotItem[]> where each round's array is
 * a power-of-2 expansion of the final round.
 *
 * Backward expansion:
 *  • Seed the last round's games as 'game' slots.
 *  • For each earlier round, expand every parent slot:
 *      ghost          → [ghost, ghost]
 *      game + 2 feeders → [feeder-in1, feeder-in2]
 *      game + 1 feeder  → [feeder, ghost]  or  [ghost, feeder]
 *      game + 0 feeders → [ghost, ghost]
 *
 * This guarantees equal flex-1 distribution makes round-(N+1) games
 * vertically centered between their round-N feeders. ✓
 */
function buildSlotGrid(
  rounds:      [number, Game[]][],
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): Map<number, SlotItem[]> {
  if (!rounds.length) return new Map()

  const roundNums = rounds.map(([r]) => r).sort((a, b) => a - b)
  const maxRound  = roundNums[roundNums.length - 1]
  const gamesByRound = new Map(rounds)
  const grid         = new Map<number, SlotItem[]>()

  // Seed: final round
  const lastGames = [...(gamesByRound.get(maxRound) ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  grid.set(maxRound, lastGames.map(g => ({ type: 'game', game: g })))

  // Backward expansion
  for (let ri = roundNums.length - 2; ri >= 0; ri--) {
    const thisRound   = roundNums[ri]
    const parentRound = roundNums[ri + 1]
    const parentSlots = grid.get(parentRound) ?? []
    const newSlots: SlotItem[] = []

    for (const slot of parentSlots) {
      if (slot.type === 'ghost') {
        newSlots.push({ type: 'ghost' }, { type: 'ghost' })
        continue
      }

      const feeders = allGames
        .filter(g => g.round_num === thisRound && g.next_game_id === slot.game.id)
        .sort((a, b) => (gameNumbers[a.id] ?? 0) - (gameNumbers[b.id] ?? 0))

      if (feeders.length === 0) {
        newSlots.push({ type: 'ghost' }, { type: 'ghost' })
      } else if (feeders.length === 1) {
        const s = resolveSlot(feeders[0], allGames, gameNumbers)
        s === 'in1'
          ? newSlots.push({ type: 'game', game: feeders[0] }, { type: 'ghost' })
          : newSlots.push({ type: 'ghost' }, { type: 'game', game: feeders[0] })
      } else {
        newSlots.push(
          { type: 'game', game: feeders[0] },
          { type: 'game', game: feeders[1] },
        )
      }
    }

    grid.set(thisRound, newSlots)
  }

  return grid
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rounds:          [number, Game[]][]
  pickMap:         Map<string, Pick>
  effectiveNames:  EffectiveNames
  tournament:      Tournament
  gameNumbers:     Record<string, number>
  eliminatedTeams: Set<string>
  champion:        string | null
  readOnly:        boolean
  ownerName?:      string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BracketGrid({
  rounds, pickMap, effectiveNames, tournament, gameNumbers,
  eliminatedTeams, champion, readOnly, ownerName,
}: Props) {

  const maxRound = rounds.length > 0 ? Math.max(...rounds.map(([r]) => r)) : 1

  // Flat list for connector measurement + ghost algorithm
  const allDisplayGames = useMemo(
    () => rounds.flatMap(([, gs]) => gs),
    [rounds],
  )

  const slotGrid = useMemo(
    () => buildSlotGrid(rounds, allDisplayGames, gameNumbers),
    [rounds, allDisplayGames, gameNumbers],
  )

  const minRound     = rounds.length > 0 ? Math.min(...rounds.map(([r]) => r)) : 1
  const numLeafSlots = slotGrid.get(minRound)?.length ?? 1
  const safeLeafSlots = Math.max(numLeafSlots, 4);
  const totalHeight  = safeLeafSlots * SLOT_H + HEADER_H;

  // ── SVG connector state ───────────────────────────────────────────────────
  const bracketRef              = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<ConnectorLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  const isPanning = useRef(false)
  const panOrigin = useRef({ x: 0, y: 0, sl: 0, st: 0 })

  // ── Double-rAF measurement (mirrors AdminBracketGrid exactly) ─────────────
  const recomputeLines = useCallback(() => {
    const container = bracketRef.current
    if (!container) return

    const cRect = container.getBoundingClientRect()

    const getOutRect = (gameId: string): DOMRect | null =>
      container
        .querySelector<HTMLElement>(`[data-out="${gameId}"]`)
        ?.getBoundingClientRect() ?? null

    const getInRect = (gameId: string, slot: 'in1' | 'in2'): DOMRect | null =>
      container
        .querySelector<HTMLElement>(`[data-${slot}="${gameId}"]`)
        ?.getBoundingClientRect() ?? null

    const lines = computeConnectorLines(
      allDisplayGames, gameNumbers,
      getOutRect, getInRect,
      cRect, container.scrollLeft, container.scrollTop,
    )

    setSvgLines(lines)
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight })
  }, [allDisplayGames, gameNumbers])

  useLayoutEffect(() => {
    let rafA = 0
    let rafB = 0

    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(recomputeLines)
    })

    const container = bracketRef.current
    if (!container) return () => { cancelAnimationFrame(rafA); cancelAnimationFrame(rafB) }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafB)
      rafB = requestAnimationFrame(recomputeLines)
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(rafA)
      cancelAnimationFrame(rafB)
      ro.disconnect()
    }
  }, [recomputeLines])

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input')) return
    const el = bracketRef.current
    if (!el) return
    isPanning.current = true
    panOrigin.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.style.cursor   = 'grabbing'
    e.preventDefault()
  }, [])

  const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current || !bracketRef.current) return
    bracketRef.current.scrollLeft = panOrigin.current.sl - (e.clientX - panOrigin.current.x)
    bracketRef.current.scrollTop  = panOrigin.current.st - (e.clientY - panOrigin.current.y)
  }, [])

  const handlePanEnd = useCallback(() => {
    if (!isPanning.current) return
    isPanning.current = false
    if (bracketRef.current) bracketRef.current.style.cursor = ''
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={bracketRef}
      className="flex-1 overflow-auto p-6 scrollbar-thin select-none relative"
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      {/* SVG connector overlay */}
      <SvgConnectors lines={svgLines} dims={svgDims} />

      {/* ── Bracket columns ──────────────────────────────────────────────
          items-stretch: every column shares the same totalHeight.
          gap-3: 12px gutter between columns (tight, like the screenshot).
          Each column's slots use flex-1, distributing height equally
          so later rounds occupy proportionally more space. ✓              */}
      <div
        className="flex items-stretch gap-3"
        style={{ height: totalHeight, width: 'max-content' }}
      >
        {rounds.map(([round]) => (
          <MatchupColumn
            key={round}
            round={round}
            maxRound={maxRound}
            slots={slotGrid.get(round) ?? []}
            pickMap={pickMap}
            effectiveNames={effectiveNames}
            tournament={tournament}
            gameNumbers={gameNumbers}
            eliminatedTeams={eliminatedTeams}
          />
        ))}

        {/* ── Champion column ─────────────────────────────────────────── */}
        <div className="flex flex-col h-full w-52 flex-shrink-0">
          <div className="h-12 flex-shrink-0 flex items-center justify-center
                          border-b border-slate-700/50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
              Champion
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center px-1">
            <ChampionCallout
              champion={champion}
              readOnly={readOnly}
              ownerName={ownerName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}