// src/widgets/admin-bracket-grid/ui/index.tsx
import { useRef, useState, useCallback, useLayoutEffect } from 'react'
import { Plus, Link2, X }           from 'lucide-react'
import { getRoundLabel, getScore }   from '../../../shared/lib/helpers'
import {
  computeConnectorLines,
  type ConnectorLine,
}                                    from '../../../shared/lib/bracketMath'
import AdminGameCard                 from './AdminGameCard'
import SvgConnectors                 from './SvgConnectors'
import type { Tournament, Game }     from '../../../shared/types'

export interface AdminBracketGridProps {
  tournament:       Tournament
  games:            Game[]
  rounds:           [number, Game[]][]
  gameNumbers:      Record<string, number>
  maxRound:         number
  linkingFromId:    string | null
  dragOverGameId:   string | null
  onStartLink:      (gameId: string) => void
  onCompleteLink:   (toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onCancelLink:     () => void
  onUpdateGame:     (id: string, updates: Partial<Game>) => void
  onSetWinner:      (game: Game, winner: string) => void
  onDeleteGame:     (game: Game) => void
  onAddGameToRound: (round: number) => void
  onUnlinkGame:     (gameId: string) => void
  onDragStart:      (id: string) => void
  onDragOver:       (e: React.DragEvent, id: string) => void
  onDragEnd:        () => void
  onDrop:           (e: React.DragEvent, id: string) => void
}

export default function AdminBracketGrid({
  tournament, games, rounds, gameNumbers, maxRound,
  linkingFromId, dragOverGameId,
  onStartLink, onCompleteLink, onCancelLink,
  onUpdateGame, onSetWinner, onDeleteGame, onAddGameToRound, onUnlinkGame,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: AdminBracketGridProps) {
  const bracketRef              = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<ConnectorLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  // ── Drag-to-pan state ─────────────────────────────────────
  const isPanning  = useRef(false)
  const panOrigin  = useRef({ x: 0, y: 0, sl: 0, st: 0 })

  // ── SVG line measurement ───────────────────────────────────
  // computeConnectorLines() uses the canonical bracketMath implementation.
  // We measure inside a double-rAF so the browser has fully resolved all
  // flex layout + CSS transforms before getBoundingClientRect() is called.
  // Without this, elements with `top-1/2 -translate-y-1/2` (the output dot)
  // report pre-transform coordinates during the first synchronous layout pass.
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
      games, gameNumbers, getOutRect, getInRect,
      cRect, container.scrollLeft, container.scrollTop,
    )

    setSvgLines(lines)
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight })
  }, [games, gameNumbers])

  useLayoutEffect(() => {
    let rafA: number
    let rafB: number

    // Double rAF: first frame commits layout, second frame is after paint —
    // the earliest moment getBoundingClientRect() is fully stable.
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

  // ── Pan handlers ───────────────────────────────────────────
  // Only activates when mousedown lands on a non-interactive background
  // element — cards, buttons, and inputs are excluded so that card
  // drag-to-reorder and text editing are unaffected.
  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (
      target.closest('[draggable="true"]') ||
      target.closest('button') ||
      target.closest('input')
    ) return

    const container = bracketRef.current
    if (!container) return

    isPanning.current = true
    panOrigin.current = {
      x:  e.clientX,
      y:  e.clientY,
      sl: container.scrollLeft,
      st: container.scrollTop,
    }
    container.style.cursor = 'grabbing'
    // Prevent text selection while panning
    e.preventDefault()
  }, [])

  const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current || !bracketRef.current) return
    const dx = e.clientX - panOrigin.current.x
    const dy = e.clientY - panOrigin.current.y
    bracketRef.current.scrollLeft = panOrigin.current.sl - dx
    bracketRef.current.scrollTop  = panOrigin.current.st - dy
  }, [])

  const handlePanEnd = useCallback(() => {
    if (!isPanning.current) return
    isPanning.current = false
    if (bracketRef.current) {
      bracketRef.current.style.cursor = linkingFromId ? 'crosshair' : ''
    }
  }, [linkingFromId])

  return (
    <>
      {/* ── Linking mode banner ── */}
      {linkingFromId && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-semibold flex-shrink-0">
          <Link2 size={12} />
          Linking Game #{gameNumbers[linkingFromId] ?? '?'} — click an input dot on any higher-round card, or press{' '}
          <kbd className="bg-slate-800 text-slate-400 px-1 rounded text-[10px]">Esc</kbd>
          <button
            onClick={onCancelLink}
            className="ml-auto text-amber-400/60 hover:text-amber-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={bracketRef}
        className="flex-1 overflow-auto relative scrollbar-thin select-none"
        style={{ cursor: linkingFromId ? 'crosshair' : 'default' }}
        onScroll={recomputeLines}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        <SvgConnectors lines={svgLines} dims={svgDims} />

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
                      {roundGames.length} game{roundGames.length !== 1 ? 's' : ''} · {pts}pt
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

                  {/* Add game button */}
                  <button
                    onClick={() => onAddGameToRound(round)}
                    className="mt-1 w-full py-2 rounded-xl border border-dashed border-slate-700 text-slate-600 hover:border-amber-500/40 hover:text-amber-400/70 transition-all text-xs flex items-center justify-center gap-1"
                  >
                    <Plus size={10} /> Add Game
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