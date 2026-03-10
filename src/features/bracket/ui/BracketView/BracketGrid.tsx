// src/features/bracket/ui/BracketView/BracketGrid.tsx
//
// Layout engine for the user-facing read-only bracket.
//
// Key design decisions:
//
//  BASE_SLOT_H = 68px  — tight & dense, matches broadcast bracket density.
//
//  safeLeafSlots = Math.max(numLeafSlots, 8)   [raised from 4]
//    Prevents floating game labels from overlapping in 4- and 8-team
//    brackets. 8 × 68 + 80 = 624px minimum canvas height.
//
//  HEADER_H = 80px — hard ceiling so no card ever drifts into the round
//    label row regardless of how many slots exist.
//
//  Dynamic SLOT_H scaling:
//    For very large brackets (numLeafSlots > 32) we clamp SLOT_H down
//    further to avoid runaway height on 64/128-team brackets.
//
//  Ghost-node algorithm: backward expansion from the final round.
//    Every parent slot expands into exactly 2 child slots (game or ghost).
//    This gives every column a power-of-2 slot count. Because each slot
//    is flex-1 inside a fixed-height column, later-round games are
//    automatically centered between their two feeder slots. ✓
//
//  Double-rAF SVG measurement: mirrors AdminBracketGrid exactly so
//    getBoundingClientRect() fires after all CSS transforms settle.

import {
  useRef, useState, useCallback, useLayoutEffect, useMemo,
} from 'react'
import MatchupColumn, { type SlotItem } from './MatchupColumn'
import ChampionCallout                   from './ChampionCallout'
import SvgConnectors                     from '../../../../shared/ui/SvgConnectors'
import {
  computeConnectorLines,
  type ConnectorLine,
  type EffectiveNames,
}                                        from '../../../../shared/lib/bracketMath'
import type { Game, Pick, Tournament }   from '../../../../shared/types'

// ── Layout constants ──────────────────────────────────────────────────────────

const BASE_SLOT_H  = 68   // px — target height per leaf slot
const HEADER_H     = 80   // px — hard header buffer (prevents label bleed)
const MIN_SLOTS    = 8    // ← raised from 4: prevents label overlap in small brackets
const MAX_SLOT_H   = 80   // px — cap so tall brackets don't explode
const MIN_SLOT_H   = 52   // px — floor so wide brackets stay readable

/** Clamp slot height to stay sane across bracket sizes. */
function computeSlotH(numLeafSlots: number): number {
  if (numLeafSlots <= 4)  return Math.min(MAX_SLOT_H, BASE_SLOT_H)
  if (numLeafSlots >= 32) return MIN_SLOT_H
  const t = (numLeafSlots - 4) / (32 - 4)
  return Math.round(BASE_SLOT_H - t * (BASE_SLOT_H - MIN_SLOT_H))
}

// ── Ghost-node slot grid ──────────────────────────────────────────────────────

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
 * Build Map<roundNum, SlotItem[]> via backward expansion from the final round.
 */
function buildSlotGrid(
  rounds:      [number, Game[]][],
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): Map<number, SlotItem[]> {
  if (!rounds.length) return new Map()

  const roundNums    = rounds.map(([r]) => r).sort((a, b) => a - b)
  const maxRound     = roundNums[roundNums.length - 1]
  const gamesByRound = new Map(rounds)
  const grid         = new Map<number, SlotItem[]>()

  const lastGames = [...(gamesByRound.get(maxRound) ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  grid.set(maxRound, lastGames.map(g => ({ type: 'game', game: g } as SlotItem)))

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
  const minRound = rounds.length > 0 ? Math.min(...rounds.map(([r]) => r)) : 1

  const allDisplayGames = useMemo(
    () => rounds.flatMap(([, gs]) => gs),
    [rounds],
  )

  const slotGrid = useMemo(
    () => buildSlotGrid(rounds, allDisplayGames, gameNumbers),
    [rounds, allDisplayGames, gameNumbers],
  )

  const rawLeafSlots  = slotGrid.get(minRound)?.length ?? 1
  const safeLeafSlots = Math.max(rawLeafSlots, MIN_SLOTS)
  const slotH         = computeSlotH(safeLeafSlots)
  const totalHeight   = safeLeafSlots * slotH + HEADER_H

  // ── SVG state ─────────────────────────────────────────────────────────────
  const bracketRef              = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<ConnectorLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  // ── Pan state ─────────────────────────────────────────────────────────────
  const isPanning = useRef(false)
  const panOrigin = useRef({ x: 0, y: 0, sl: 0, st: 0 })

  // ── Double-rAF SVG measurement ────────────────────────────────────────────
  const recomputeLines = useCallback(() => {
    const container = bracketRef.current
    if (!container) return

    const cRect = container.getBoundingClientRect()

    const getOutRect = (gameId: string): DOMRect | null =>
      container.querySelector<HTMLElement>(`[data-out="${gameId}"]`)
               ?.getBoundingClientRect() ?? null

    const getInRect = (gameId: string, slot: 'in1' | 'in2'): DOMRect | null =>
      container.querySelector<HTMLElement>(`[data-${slot}="${gameId}"]`)
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
      // bg-slate-950: explicit neutral canvas — prevents theme colors bleeding through
      className="flex-1 overflow-auto p-6 scrollbar-thin select-none relative bg-slate-950"
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      <SvgConnectors lines={svgLines} dims={svgDims} />

      <div
        className="flex items-stretch gap-4"
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

        {/* Champion column */}
        <div className="flex flex-col h-full w-52 flex-shrink-0">
          <div
            className="flex-shrink-0 flex items-center justify-center border-b border-slate-700/50"
            style={{ height: HEADER_H }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
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