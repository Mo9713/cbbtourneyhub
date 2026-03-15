// src/widgets/tournament-bracket/ui/BracketView/BracketGrid.tsx
import { useRef, useState, useCallback, useLayoutEffect, useMemo, useEffect } from 'react'
import MatchupColumn, { type SlotItem }  from './MatchupColumn'
import ChampionCallout                   from './ChampionCallout'
import SvgConnectors                     from '../../../../shared/ui/SvgConnectors'
import { computeConnectorLines, type ConnectorLine, type EffectiveNames } from '../../../../shared/lib/bracketMath'
import type { Game, Pick, Tournament }   from '../../../../shared/types'
import { useTheme }                      from '../../../../shared/lib/theme'

const HEADER_H = 80

function computeSlotH(numLeafSlots: number): number {
  if (numLeafSlots >= 32) return 80 
  if (numLeafSlots <= 8)  return 105
  const t = (numLeafSlots - 8) / (32 - 8)
  return Math.round(105 - t * (105 - 80))
}

function resolveSlot(feeder: Game, allGames: Game[], gameNumbers: Record<string, number>): 'in1' | 'in2' {
  if (!feeder.next_game_id) return 'in1'
  const siblings = allGames
    .filter(g => g.next_game_id === feeder.next_game_id)
    .sort((a, b) => (gameNumbers[a.id] ?? 0) - (gameNumbers[b.id] ?? 0))
  return siblings.length === 0 || siblings[0].id === feeder.id ? 'in1' : 'in2'
}

function buildSlotGrid(rounds: [number, Game[]][], allGames: Game[], gameNumbers: Record<string, number>): Map<number, SlotItem[]> {
  if (!rounds.length) return new Map()

  const roundNums    = rounds.map(([r]) => r).sort((a, b) => a - b)
  const maxRound     = roundNums[roundNums.length - 1]
  const gamesByRound = new Map(rounds)
  const grid         = new Map<number, SlotItem[]>()

  const lastGames = [...(gamesByRound.get(maxRound) ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
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
        newSlots.push({ type: 'game', game: feeders[0] }, { type: 'game', game: feeders[1] })
      }
    }
    grid.set(thisRound, newSlots)
  }
  return grid
}

interface Props {
  rounds:          [number, Game[]][]
  pickMap:         Map<string, Pick>
  effectiveNames:  EffectiveNames
  tournament:      Tournament
  gameNumbers:     Record<string, number>
  eliminatedTeams: Set<string>
  champion:        string | null
  actualChampion:  string | null
  readOnly:        boolean
  ownerName?:      string
  selectedRegion?: string | null
  onRegionSelect?: (region: string) => void
}

export default function BracketGrid({
  rounds, pickMap, effectiveNames, tournament, gameNumbers,
  eliminatedTeams, champion, actualChampion, readOnly, ownerName,
  selectedRegion, onRegionSelect
}: Props) {
  const theme = useTheme()
  const maxRound = rounds.length > 0 ? Math.max(...rounds.map(([r]) => r)) : 1
  const minRound = rounds.length > 0 ? Math.min(...rounds.map(([r]) => r)) : 1

  const allDisplayGames = useMemo(() => rounds.flatMap(([, gs]) => gs), [rounds])
  const slotGrid = useMemo(() => buildSlotGrid(rounds, allDisplayGames, gameNumbers), [rounds, allDisplayGames, gameNumbers])

  const rawLeafSlots  = slotGrid.get(minRound)?.length ?? 1
  const slotH         = computeSlotH(rawLeafSlots)
  const totalHeight   = Math.max(4, rawLeafSlots) * slotH + HEADER_H

  const outerScrollRef          = useRef<HTMLDivElement>(null)
  const innerBracketRef         = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<ConnectorLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  const isPanning = useRef(false)
  const panOrigin = useRef({ x: 0, y: 0, sl: 0, st: 0 })

  useEffect(() => {
    if (outerScrollRef.current) {
      outerScrollRef.current.scrollTop = 0
      outerScrollRef.current.scrollLeft = 0
    }
  }, [selectedRegion])

  const recomputeLines = useCallback(() => {
    const container = innerBracketRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()

    const getOutRect = (gameId: string): DOMRect | null =>
      container.querySelector<HTMLElement>(`[data-out="${gameId}"]`)?.getBoundingClientRect() ?? null

    const getInRect = (gameId: string, slot: 'in1' | 'in2'): DOMRect | null =>
      container.querySelector<HTMLElement>(`[data-${slot}="${gameId}"]`)?.getBoundingClientRect() ?? null

    const lines = computeConnectorLines(allDisplayGames, gameNumbers, getOutRect, getInRect, cRect, 0, 0)
    setSvgLines(lines)
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight })
  }, [allDisplayGames, gameNumbers])

  useLayoutEffect(() => {
    let rafA = 0; let rafB = 0
    rafA = requestAnimationFrame(() => { rafB = requestAnimationFrame(recomputeLines) })
    const container = innerBracketRef.current
    if (!container) return () => { cancelAnimationFrame(rafA); cancelAnimationFrame(rafB) }
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafB); rafB = requestAnimationFrame(recomputeLines)
    })
    ro.observe(container)
    return () => { cancelAnimationFrame(rafA); cancelAnimationFrame(rafB); ro.disconnect() }
  }, [recomputeLines])

  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input')) return
    const el = outerScrollRef.current
    if (!el) return
    isPanning.current = true
    panOrigin.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.style.cursor   = 'grabbing'
    e.preventDefault()
  }, [])

  const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current || !outerScrollRef.current) return
    outerScrollRef.current.scrollLeft = panOrigin.current.sl - (e.clientX - panOrigin.current.x)
    outerScrollRef.current.scrollTop  = panOrigin.current.st - (e.clientY - panOrigin.current.y)
  }, [])

  const handlePanEnd = useCallback(() => {
    if (!isPanning.current) return
    isPanning.current = false
    if (outerScrollRef.current) outerScrollRef.current.style.cursor = ''
  }, [])

  const isRegionalView = selectedRegion && selectedRegion !== 'Final Four'

  return (
    <div
      ref={outerScrollRef}
      className={`flex-1 overflow-auto p-8 relative scrollbar-thin select-none ${theme.appBg} transition-colors duration-300`}
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      <div 
        ref={innerBracketRef} 
        className="relative flex items-stretch gap-4"
        style={{ height: totalHeight, width: 'max-content' }}
      >
        <SvgConnectors lines={svgLines} dims={svgDims} />
        
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
            allGames={allDisplayGames}
          />
        ))}

        <div className="flex flex-col h-full w-52 flex-shrink-0 relative z-10">
          <div className={`flex-shrink-0 flex items-center justify-center border-b ${theme.borderBase}`} style={{ height: HEADER_H }}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${theme.accent}`}>
              {isRegionalView ? 'Advances To' : 'Champion'}
            </span>
          </div>
          
          <div className="flex-1 flex items-center justify-center px-1">
            {isRegionalView ? (
              <button 
                onClick={() => onRegionSelect && onRegionSelect('Final Four')}
                className={`${theme.panelBg} border-2 border-emerald-500/50 rounded-2xl overflow-hidden w-full flex-shrink-0 shadow-lg flex flex-col items-center justify-center p-4 min-h-[8rem] hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group active:scale-95`}
              >
                <div className="bg-emerald-500/20 text-emerald-500 p-3 rounded-full mb-3 group-hover:scale-110 group-hover:bg-emerald-500/30 transition-all">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </div>
                <p className={`font-display text-xl font-black uppercase tracking-widest ${theme.textBase}`}>
                  Final Four
                </p>
                <div className="mt-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  Click to Advance
                </div>
              </button>
            ) : (
              <ChampionCallout
                champion={champion}
                actualChampion={actualChampion}
                readOnly={readOnly}
                ownerName={ownerName}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}