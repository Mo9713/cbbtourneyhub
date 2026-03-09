// src/views/AdminBuilderView/AdminBracketGrid.tsx

import { useRef, useState, useCallback, useLayoutEffect } from 'react'
import { Plus, Link2, X }         from 'lucide-react'
import { getRoundLabel }           from '../../utils/helpers'
import { getScore }                from '../../utils/helpers'
import { resolveAdvancingSlot }    from '../../utils/bracketMath' // <-- ADDED IMPORT
import AdminGameCard               from './AdminGameCard'
import AdminSvgConnectors          from './AdminSvgConnectors'
import type { Tournament, Game, SVGLine } from '../../types'

interface Props {
  tournament:     Tournament
  games:          Game[]
  rounds:         [number, Game[]][]
  gameNumbers:    Record<string, number>
  maxRound:       number
  linkingFromId:  string | null
  dragOverGameId: string | null
  onStartLink:    (gameId: string) => void
  onCompleteLink: (toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onCancelLink:   () => void
  onUpdateGame:   (id: string, updates: Partial<Game>) => void
  onSetWinner:    (game: Game, winner: string) => void
  onDeleteGame:   (game: Game) => void
  onAddGameToRound: (round: number) => void
  onUnlinkGame:   (gameId: string) => void
  onDragStart:    (id: string) => void
  onDragOver:     (e: React.DragEvent, id: string) => void
  onDragEnd:      () => void
  onDrop:         (e: React.DragEvent, id: string) => void
}

export default function AdminBracketGrid({
  tournament, games, rounds, gameNumbers, maxRound,
  linkingFromId, dragOverGameId,
  onStartLink, onCompleteLink, onCancelLink,
  onUpdateGame, onSetWinner, onDeleteGame, onAddGameToRound, onUnlinkGame,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: Props) {
  const bracketRef = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<SVGLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  // ── SVG line measurement ───────────────────────────────────
  // Queries DOM for [data-out], [data-in1], [data-in2] attributes on
  // AdminGameCard dots, then resolves which in-slot each feeder targets.
  const recomputeLines = useCallback(() => {
    const container = bracketRef.current
    if (!container) return

    const cRect = container.getBoundingClientRect()
    const lines: SVGLine[] = []

    for (const game of games) {
      if (!game.next_game_id) continue

      const outEl = container.querySelector<HTMLElement>(`[data-out="${game.id}"]`)
      if (!outEl) continue
      const oR = outEl.getBoundingClientRect()
      const outX = oR.left + oR.width  / 2 - cRect.left + container.scrollLeft
      const outY = oR.top  + oR.height / 2 - cRect.top  + container.scrollTop

      // ── Slot resolution (Centralized) ──
      // Replaced 25 lines of duplicate logic with this single call
      const slot = resolveAdvancingSlot(game, games, gameNumbers)

      const inEl = container.querySelector<HTMLElement>(`[data-${slot}="${game.next_game_id}"]`)
      if (!inEl) continue
      const iR = inEl.getBoundingClientRect()
      const Y_OFFSET = 8 
      const inX = iR.left + iR.width  / 2 - cRect.left + container.scrollLeft
      const inY = iR.top  + iR.height / 2 - cRect.top  + container.scrollTop - Y_OFFSET

      lines.push({ x1: outX, y1: outY, x2: inX, y2: inY, gameId: game.id, fromSlot: slot })
    }

    setSvgLines(lines)
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight })
  }, [games, gameNumbers])

  // Recompute lines if games change, OR if the container size changes (like closing the sidebar)
  useLayoutEffect(() => {
    recomputeLines()
    
    const container = bracketRef.current
    if (!container) return
    
    const observer = new ResizeObserver(() => recomputeLines())
    observer.observe(container)
    
    return () => observer.disconnect()
  }, [games, recomputeLines])

  return (
    <>
      {/* ── Linking mode banner ── */}
      {linkingFromId && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-semibold flex-shrink-0">
          <Link2 size={12} />
          Linking Game #{gameNumbers[linkingFromId] ?? '?'} — click an input dot on any higher-round card, or press{' '}
          <kbd className="bg-slate-800 text-slate-400 px-1 rounded text-[10px]">Esc</kbd>
          <button onClick={onCancelLink} className="ml-auto text-amber-400/60 hover:text-amber-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={bracketRef}
        className="flex-1 overflow-auto relative"
        style={{ cursor: linkingFromId ? 'crosshair' : 'default' }}
        onScroll={recomputeLines}
      >
        <AdminSvgConnectors lines={svgLines} dims={svgDims} />

        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <Plus size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No games yet. Click "Add Next Round" to start building.</p>
          </div>
        ) : (
          <div
            className="relative flex gap-10 min-w-max items-start p-8"
            style={{ zIndex: 1 }}
            onClick={e => e.stopPropagation()}
          >
            {rounds.map(([round, roundGames]) => {
              const label = tournament.round_names?.[round - 1]?.trim()
                ? tournament.round_names[round - 1]
                : getRoundLabel(round, maxRound)

              const pts = tournament.scoring_config?.[round] ?? getScore(round)

              return (
                <div key={round} className="flex flex-col gap-3" style={{ overflow: 'visible' }}>

                  {/* Round label */}
                  <div className="text-center pb-3 border-b border-amber-500/20">
                    <h3 className="font-display text-sm font-bold text-amber-400/70 uppercase tracking-widest">
                      {label}
                    </h3>
                    <span className="text-[10px] text-slate-600">
                      {roundGames.length} game{roundGames.length !== 1 ? 's' : ''} · {pts}pt {/* <--- Changed to {pts}pt */}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-5" style={{ overflow: 'visible' }}>
                    {roundGames.map(game => (
                      <AdminGameCard
                        key={game.id}
                        game={game}
                        allGames={games}
                        gameNum={gameNumbers[game.id] ?? 0}
                        gameNumbers={gameNumbers}
                        maxRound={maxRound}
                        linkingFromId={linkingFromId}
                        isValidLinkTarget={
                          linkingFromId !== null &&
                          linkingFromId !== game.id &&
                          (games.find(g => g.id === linkingFromId)?.round_num ?? 0) < game.round_num
                        }
                        isDragOver={dragOverGameId === game.id}
                        onUpdate={onUpdateGame}
                        onSetWinner={onSetWinner}
                        onDelete={onDeleteGame}
                        onStartLink={onStartLink}
                        onCompleteLink={onCompleteLink}
                        onUnlink={onUnlinkGame}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                      />
                    ))}
                  </div>

                  {/* Add game to this round */}
                  <button
                    onClick={() => onAddGameToRound(round)}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-amber-500/40 text-slate-600 hover:text-amber-400/70 text-[10px] font-bold transition-all"
                  >
                    <Plus size={9} /> Add Game
                  </button>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}