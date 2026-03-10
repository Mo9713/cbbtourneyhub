// src/features/tournament/AdminBuilderView/AdminGameCard.tsx
import { useState, useEffect } from 'react'
import {
  GripVertical, Unlink, Trash2, Target,
} from 'lucide-react'
import { getScore, isTBDName } from '../../../../shared/lib/helpers'
import type { Game }            from '../../../../shared/types'

interface Props {
  game:              Game
  allGames:          Game[]
  gameNum:           number
  gameNumbers:       Record<string, number>
  maxRound:          number
  linkingFromId:     string | null
  isValidLinkTarget: boolean
  isDragOver:        boolean
  onUpdate:          (id: string, updates: Partial<Game>) => void
  onSetWinner:       (game: Game, winner: string) => void
  onDelete:          (game: Game) => void
  onStartLink:       (gameId: string) => void
  onCompleteLink:    (toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onUnlink:          (gameId: string) => void
  onDragStart:       (id: string) => void
  onDragOver:        (e: React.DragEvent, id: string) => void
  onDragEnd:         () => void
  onDrop:            (e: React.DragEvent, id: string) => void
}

export default function AdminGameCard({
  game, allGames, gameNum, gameNumbers, maxRound,
  linkingFromId, isValidLinkTarget, isDragOver,
  onUpdate, onSetWinner, onDelete,
  onStartLink, onCompleteLink, onUnlink,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: Props) {
  const [team1,      setTeam1]      = useState(game.team1_name)
  const [team2,      setTeam2]      = useState(game.team2_name)
  const [showWinner, setShowWinner] = useState(false)

  // Sync local input state if the DB value changes (realtime or undo)
  useEffect(() => { setTeam1(game.team1_name) }, [game.team1_name])
  useEffect(() => { setTeam2(game.team2_name) }, [game.team2_name])

  const isChampionship = game.round_num === maxRound
  const isLinkingFrom  = linkingFromId === game.id

  // For TBD/placeholder slots: resolve "Winner of Game #N" → actual_winner
  // if the feeder game has a confirmed result, so the admin sees the real name.
  const resolveSlotName = (slotName: string): string => {
    if (!slotName.startsWith('Winner of Game #')) return slotName
    const gNum   = parseInt(slotName.replace('Winner of Game #', ''), 10)
    const feeder = allGames.find(g => gameNumbers[g.id] === gNum)
    return feeder?.actual_winner ?? slotName
  }

  const handleBlur = (field: 'team1_name' | 'team2_name', val: string) => {
    if (val.trim() === game[field]) return
    onUpdate(game.id, { [field]: val.trim() || game[field] })
  }

  // ── Dot styles ────────────────────────────────────────────
  const inDotCls = `w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all
    ${isValidLinkTarget
      ? 'border-sky-400 bg-sky-400/40 hover:bg-sky-400 cursor-pointer animate-pulse'
      : 'border-slate-600 bg-slate-800'
    }`

  const outDotCls = `w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all cursor-pointer
    ${isLinkingFrom
      ? 'border-amber-400 bg-amber-400 scale-150 shadow-lg shadow-amber-400/40'
      : game.next_game_id
        ? 'border-emerald-500 bg-emerald-500/30 hover:bg-emerald-500/60'
        : 'border-slate-600 bg-slate-800 hover:border-amber-400'
    }`

  // Slot rows: team1 → data-in1, team2 → data-in2
  const slots = [
    { val: team1, setter: setTeam1, field: 'team1_name' as const, dataAttr: { 'data-in1': game.id } },
    { val: team2, setter: setTeam2, field: 'team2_name' as const, dataAttr: { 'data-in2': game.id } },
  ]

  return (
    <div
      draggable
      onDragStart={() => onDragStart(game.id)}
      onDragOver={e => onDragOver(e, game.id)}
      onDragEnd={onDragEnd}
      onDrop={e => onDrop(e, game.id)}
      style={{ overflow: 'visible', position: 'relative' }}
      className={`transition-all ${isDragOver ? 'opacity-50 scale-95' : ''}`}
    >
      {/* Output dot — right edge, vertically centred */}
      {!isChampionship && (
        <div
          data-out={game.id}
          className={`absolute -right-4 top-1/2 -translate-y-1/2 z-10 ${outDotCls}`}
          onClick={() => onStartLink(game.id)}
        />
      )}

      <div
        className={`w-52 rounded-xl border overflow-hidden shadow transition-all bg-slate-900/90
          ${isLinkingFrom
            ? 'border-amber-400/60 shadow-amber-400/20 shadow-lg'
            : isValidLinkTarget
              ? 'border-sky-400/60 shadow-sky-400/20 shadow-lg cursor-pointer'
              : 'border-slate-700 hover:border-slate-600'
          }`}
        // Clicking anywhere on a valid target defaults to slot team1_name
        onClick={() => isValidLinkTarget && onCompleteLink(game.id, 'team1_name')}
      >

        {/* ── Card header ── */}
        <div className="px-3 py-1.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <GripVertical size={10} className="text-slate-700 cursor-grab" />
            <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest">
              #{gameNum} · R{game.round_num} · {getScore(game.round_num)}pt
            </span>
          </div>
          <div className="flex items-center gap-1">
            {game.next_game_id && (
              <button
                onClick={e => { e.stopPropagation(); onUnlink(game.id) }}
                title="Unlink from next game"
                className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-amber-400 transition-all">
                <Unlink size={9} />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); setShowWinner(v => !v) }}
              title="Set winner"
              className={`p-1 rounded hover:bg-slate-700 transition-all
                ${showWinner ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}>
              <Target size={9} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(game) }}
              title="Delete game"
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-rose-400 transition-all">
              <Trash2 size={9} />
            </button>
          </div>
        </div>

        {/* ── Team slots ── */}
        {slots.map(({ val, setter, field, dataAttr }) => {
          const isTBD    = isTBDName(val)
          const isWinner = game.actual_winner === val
          return (
            <div
              key={field}
              className={`flex items-center gap-2 px-2 py-1.5 border-b border-slate-800/60 last:border-0
                ${isWinner ? 'bg-emerald-500/10' : ''}`}
              onClick={e => {
                // Clicking a slot row precisely targets that slot when linking
                if (isValidLinkTarget) {
                  e.stopPropagation()
                  onCompleteLink(game.id, field)
                }
              }}
            >
              {/* Input dot with data attribute — used by AdminSvgConnectors to measure position */}
              <div className={inDotCls} {...dataAttr} />
              <input
                value={isTBD ? resolveSlotName(val) : val}
                onChange={e => setter(e.target.value)}
                onBlur={e => handleBlur(field, e.target.value)}
                onClick={e => e.stopPropagation()}
                className={`flex-1 bg-transparent text-xs font-medium focus:outline-none truncate
                  ${isWinner   ? 'text-emerald-400 font-bold'
                  : isTBD      ? 'text-slate-600 italic'
                               : 'text-white'}`}
              />
              {isWinner && <span className="text-[9px] text-emerald-400 font-bold">✓</span>}
            </div>
          )
        })}

        {/* ── Winner setter (toggle panel) ── */}
        {showWinner && (
          <div
            className="px-2 py-2 bg-slate-800/40 border-t border-slate-800 space-y-1"
            onClick={e => e.stopPropagation()}
          >
            {[team1, team2].filter(t => !isTBDName(t)).map(team => (
              <button key={team}
                onClick={() => onSetWinner(game, team)}
                className={`w-full py-1 rounded-lg text-[10px] font-bold border transition-all
                  ${game.actual_winner === team
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}>
                {team}{game.actual_winner === team && ' ✓'}
              </button>
            ))}
            {[team1, team2].filter(t => !isTBDName(t)).length === 0 && (
              <p className="text-[10px] text-slate-600 italic">
                {team1.startsWith('Winner of Game') && team2.startsWith('Winner of Game')
                  ? 'Set winners in earlier rounds first'
                  : 'Add team names first'}
              </p>
            )}
            {game.actual_winner && (
              <button onClick={() => onSetWinner(game, '')}
                className="w-full py-1 rounded-lg text-[10px] text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                Clear Winner
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}





