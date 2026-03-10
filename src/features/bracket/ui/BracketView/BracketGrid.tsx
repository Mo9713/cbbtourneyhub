// src/features/bracket/ui/BracketView/BracketGrid.tsx

import { useRef, useCallback } from 'react'
import MatchupColumn            from './MatchupColumn'
import ChampionCallout          from './ChampionCallout'
import { useTheme }             from '../../../../shared/lib/theme'
import type { Game, Pick, Tournament } from '../../../../shared/types'
import type { EffectiveNames }  from '../../../../shared/lib/bracketMath'

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

export default function BracketGrid({
  rounds, pickMap, effectiveNames, tournament, gameNumbers,
  eliminatedTeams, champion, readOnly, ownerName,
}: Props) {
  const theme    = useTheme()
  const maxRound = rounds.length > 0 ? Math.max(...rounds.map(([r]) => r)) : 1

  // ── Drag-to-pan ───────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning    = useRef(false)
  const panOrigin    = useRef({ x: 0, y: 0, sl: 0, st: 0 })

  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Don't intercept clicks on interactive elements
    if (target.closest('button') || target.closest('input')) return
    const el = containerRef.current
    if (!el) return
    isPanning.current = true
    panOrigin.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.style.cursor = 'grabbing'
    e.preventDefault()
  }, [])

  const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current || !containerRef.current) return
    containerRef.current.scrollLeft = panOrigin.current.sl - (e.clientX - panOrigin.current.x)
    containerRef.current.scrollTop  = panOrigin.current.st - (e.clientY - panOrigin.current.y)
  }, [])

  const handlePanEnd = useCallback(() => {
    if (!isPanning.current) return
    isPanning.current = false
    if (containerRef.current) containerRef.current.style.cursor = ''
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-6 scrollbar-thin select-none"
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      <div className="flex items-start gap-6 w-max min-h-full">

        {rounds.map(([round, games]) => (
          <MatchupColumn
            key={round}
            round={round}
            games={games}
            maxRound={maxRound}
            pickMap={pickMap}
            effectiveNames={effectiveNames}
            tournament={tournament}
            gameNumbers={gameNumbers}
            eliminatedTeams={eliminatedTeams}
          />
        ))}

        {/* Champion node */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0 w-52">
          <div className="text-center pb-3 border-b border-slate-800/80 mb-2 w-full">
            <h3 className={`font-display text-sm font-bold uppercase tracking-widest ${theme.accent}`}>
              Champion
            </h3>
            <span className="text-[10px] text-transparent select-none">.</span>
          </div>
          <div className="flex flex-col gap-4 w-full h-full">
            <ChampionCallout champion={champion} readOnly={readOnly} ownerName={ownerName} />
          </div>
        </div>

      </div>
    </div>
  )
}