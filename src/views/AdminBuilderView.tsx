// src/views/AdminBuilderView.tsx
import {
  useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect,
} from 'react'
import {
  Plus, Lock, Globe, AlertTriangle, Edit3, Link2,
  RefreshCw, Shield, Trash2, X, GripVertical, Unlink, Target,
  CheckCircle, ChevronRight,
} from 'lucide-react'
import { useTheme } from '../utils/theme'
import { isoToInputCST, cstInputToISO } from '../utils/time'
import { getScore, getRoundLabel, isTBDName, computeGameNumbers, BD_REGIONS } from '../utils/helpers'
import type { Tournament, Game, Pick, SVGLine } from '../types'

// ── Admin Game Card ───────────────────────────────────────────
function AdminGameCard({
  game, allGames, gameNum, gameNumbers, maxRound,
  onUpdate, onSetWinner, onDelete, onStartLink, onCompleteLink, onUnlink,
  linkingFromId, isValidLinkTarget, isDragOver,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  game: Game; allGames: Game[]; gameNum: number
  gameNumbers: Record<string, number>; maxRound: number
  onUpdate:       (id: string, updates: Partial<Game>) => void
  onSetWinner:    (game: Game, winner: string) => void
  onDelete:       (game: Game) => void
  onStartLink:    (gameId: string) => void
  onCompleteLink: (toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onUnlink:       (gameId: string) => void
  linkingFromId:  string | null
  isValidLinkTarget: boolean
  isDragOver: boolean
  onDragStart: (id: string) => void
  onDragOver:  (e: React.DragEvent, id: string) => void
  onDragEnd:   () => void
  onDrop:      (e: React.DragEvent, id: string) => void
}) {
  const theme = useTheme()
  const [team1, setTeam1] = useState(game.team1_name)
  const [team2, setTeam2] = useState(game.team2_name)
  const [showWinner, setShowWinner] = useState(false)

  useEffect(() => { setTeam1(game.team1_name) }, [game.team1_name])
  useEffect(() => { setTeam2(game.team2_name) }, [game.team2_name])

  const handleBlur = (field: 'team1_name' | 'team2_name', val: string) => {
    if (val.trim() === game[field]) return
    onUpdate(game.id, { [field]: val.trim() || game[field] })
  }

  const isChampionship = game.round_num === maxRound
  const isLinkingFrom  = linkingFromId === game.id

  const resolveSlotName = (slotName: string): string => {
    if (!slotName.startsWith('Winner of Game #')) return slotName
    const gNum = parseInt(slotName.replace('Winner of Game #', ''), 10)
    const feederGame = allGames.find(g => gameNumbers[g.id] === gNum)
    return feederGame?.actual_winner ?? slotName
  }
  const effectiveTeam1  = resolveSlotName(game.team1_name)
  const effectiveTeam2  = resolveSlotName(game.team2_name)
  const winnerOptions   = [effectiveTeam1, effectiveTeam2].filter(n => n && !isTBDName(n))

  const slot1IsLinked = game.team1_name.startsWith('Winner of Game')
  const slot2IsLinked = game.team2_name.startsWith('Winner of Game')

  const handleOutClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLinkingFrom) onStartLink('')
    else onStartLink(game.id)
  }
  const handleInClick = (slot: 'team1_name' | 'team2_name') => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (linkingFromId && linkingFromId !== game.id) onCompleteLink(game.id, slot)
  }

  const inDotBase = 'w-3.5 h-3.5 rounded-full border-2 transition-all flex-shrink-0 z-20'
  const inDot1Class = (linkingFromId && linkingFromId !== game.id && isValidLinkTarget)
    ? `${inDotBase} border-emerald-400 bg-emerald-400/30 animate-pulse cursor-pointer scale-125`
    : slot1IsLinked
      ? `${inDotBase} border-amber-400 bg-amber-400/40 cursor-default`
      : `${inDotBase} border-slate-600 bg-slate-800 hover:border-slate-400 cursor-default`
  const inDot2Class = (linkingFromId && linkingFromId !== game.id && isValidLinkTarget)
    ? `${inDotBase} border-sky-400 bg-sky-400/30 animate-pulse cursor-pointer scale-125`
    : slot2IsLinked
      ? `${inDotBase} border-amber-400 bg-amber-400/40 cursor-default`
      : `${inDotBase} border-slate-600 bg-slate-800 hover:border-slate-400 cursor-default`

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(game.id) }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(e, game.id) }}
      onDragEnd={onDragEnd}
      onDrop={e => { e.stopPropagation(); onDrop(e, game.id) }}
      className={`relative transition-all ${isDragOver ? 'opacity-50 scale-95' : ''}`}
      style={{ paddingRight: '18px' }}>

      {/* Output dot */}
      {!isChampionship && (
        <button
          data-out={game.id}
          onClick={handleOutClick}
          title={game.next_game_id ? 'Linked — click to re-link' : 'Click to link to next game'}
          className={`absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all z-20
            ${isLinkingFrom
              ? 'border-amber-400 bg-amber-400 scale-150 cursor-pointer shadow-lg shadow-amber-400/40'
              : game.next_game_id
                ? 'border-emerald-500 bg-emerald-500/30 hover:bg-emerald-500/60 cursor-pointer'
                : 'border-slate-600 bg-slate-800 hover:border-amber-400 cursor-pointer'
            }`}
        />
      )}

      <div className={`w-52 rounded-xl border overflow-hidden shadow transition-all
        ${isLinkingFrom
          ? 'border-amber-400/60 shadow-amber-400/20 shadow-lg'
          : isValidLinkTarget
            ? 'border-sky-400/60 shadow-sky-400/20 shadow-lg cursor-pointer'
            : 'border-slate-700 hover:border-slate-600'
        } bg-slate-900/90`}>

        {/* Card header */}
        <div className="px-3 py-1.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <GripVertical size={10} className="text-slate-700 cursor-grab" />
            <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest">
              #{gameNum} · R{game.round_num} · {getScore(game.round_num)}pt
            </span>
          </div>
          <div className="flex items-center gap-1">
            {game.next_game_id && (
              <button onClick={e => { e.stopPropagation(); onUnlink(game.id) }}
                title="Unlink" className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-amber-400 transition-all">
                <Unlink size={9} />
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); setShowWinner(v => !v) }}
              title="Set winner" className={`p-1 rounded hover:bg-slate-700 transition-all ${showWinner ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}>
              <Target size={9} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(game) }}
              title="Delete" className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-rose-400 transition-all">
              <Trash2 size={9} />
            </button>
          </div>
        </div>

        {/* Team inputs */}
        {[
          { val: team1, setter: setTeam1, field: 'team1_name' as const, dotClass: inDot1Class, slotKey: 'team1_name' as const },
          { val: team2, setter: setTeam2, field: 'team2_name' as const, dotClass: inDot2Class, slotKey: 'team2_name' as const },
        ].map(({ val, setter, field, dotClass, slotKey }) => (
          <div key={field} className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-800/60 last:border-0">
            <div className={dotClass} data-in1={slotKey === 'team1_name' ? game.id : undefined}
              data-in2={slotKey === 'team2_name' ? game.id : undefined}
              onClick={handleInClick(slotKey)} />
            <input
              value={val}
              onChange={e => setter(e.target.value)}
              onBlur={e => handleBlur(field, e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:text-white min-w-0"
              placeholder="Team name"
              onClick={e => e.stopPropagation()}
            />
            {game.actual_winner === val && val && !isTBDName(val) && (
              <CheckCircle size={10} className="text-emerald-400 flex-shrink-0" />
            )}
          </div>
        ))}

        {/* Winner panel */}
        {showWinner && (
          <div className="p-2 bg-slate-800/40 border-t border-slate-800 space-y-1.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Set Winner</span>
            {winnerOptions.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {winnerOptions.map(team => (
                  <button key={team} onClick={() => onSetWinner(game, team)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all
                      ${game.actual_winner === team
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}>
                    {team}{game.actual_winner === team && ' ✓'}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-600 italic">
                {game.team1_name.startsWith('Winner of Game') && game.team2_name.startsWith('Winner of Game')
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

// ── Admin Builder View ────────────────────────────────────────
interface AdminBuilderViewProps {
  tournament: Tournament
  games: Game[]
  onUpdateGame:       (id: string, updates: Partial<Game>) => void
  onAddGameToRound:   (round: number) => void
  onAddNextRound:     () => void
  onPublish:          () => void
  onLock:             () => void
  onSetWinner:        (game: Game, winner: string) => void
  onDeleteGame:       (game: Game) => void
  onDeleteTournament: () => void
  onReload:           () => void
  onLink:             (fromGameId: string, toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onUnlink:           (fromGameId: string) => void
  onRenameTournament: (newName: string) => void
  onUpdateTournament: (updates: Partial<Tournament>) => void
}

export default function AdminBuilderView({
  tournament, games,
  onUpdateGame, onAddGameToRound, onAddNextRound,
  onPublish, onLock, onSetWinner, onDeleteGame, onDeleteTournament,
  onReload, onLink, onUnlink, onRenameTournament, onUpdateTournament,
}: AdminBuilderViewProps) {
  const theme = useTheme()
  const [linkingFromId,  setLinkingFromId]  = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [draggedGameId,  setDraggedGameId]  = useState<string | null>(null)
  const [dragOverGameId, setDragOverGameId] = useState<string | null>(null)
  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState(tournament.name)
  const [unlocksAtInput, setUnlocksAtInput] = useState(isoToInputCST(tournament.unlocks_at))
  const [locksAtInput,   setLocksAtInput]   = useState(isoToInputCST(tournament.locks_at))
  const bracketRef = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<SVGLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  useEffect(() => { setUnlocksAtInput(isoToInputCST(tournament.unlocks_at)) }, [tournament.unlocks_at])
  useEffect(() => { setLocksAtInput(isoToInputCST(tournament.locks_at))     }, [tournament.locks_at])

  const gameNumbers  = useMemo(() => computeGameNumbers(games), [games])
  const maxRound     = useMemo(() => games.length ? Math.max(...games.map(g => g.round_num)) : 1, [games])
  const isBigDance   = games.some(g => g.region)
  const publishValid = useMemo(() => {
    const nonChamp = games.filter(g => g.round_num < maxRound)
    return nonChamp.length === 0 || nonChamp.every(g => g.next_game_id)
  }, [games, maxRound])

  const displayGames = useMemo(() =>
    (!isBigDance || !selectedRegion) ? games : games.filter(g => g.region === selectedRegion),
    [games, isBigDance, selectedRegion]
  )

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach(g => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([r, gs]) => [r, gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))] as [number, Game[]])
  }, [displayGames])

  // SVG connector lines
  const recomputeLines = useCallback(() => {
    const container = bracketRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const lines: SVGLine[] = []
    for (const game of games) {
      if (!game.next_game_id) continue
      const outDot = container.querySelector<HTMLElement>(`[data-out="${game.id}"]`)
      if (!outDot) continue
      const outR = outDot.getBoundingClientRect()
      const outX = outR.left + outR.width  / 2 - containerRect.left + container.scrollLeft
      const outY = outR.top  + outR.height / 2 - containerRect.top  + container.scrollTop
      let slot: 'in1' | 'in2' = 'in1'
      if (game.next_game_id) {
        const feeders = games
          .filter(g => g.next_game_id === game.next_game_id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
        slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'in1' : 'in2'
      }
      const inDot = container.querySelector<HTMLElement>(`[data-${slot}="${game.next_game_id}"]`)
      if (!inDot) continue
      const inR = inDot.getBoundingClientRect()
      const inX = inR.left + inR.width  / 2 - containerRect.left + container.scrollLeft
      const inY = inR.top  + inR.height / 2 - containerRect.top  + container.scrollTop
      lines.push({ x1: outX, y1: outY, x2: inX, y2: inY, gameId: game.id, fromSlot: slot })
    }
    setSvgLines(lines)
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight })
  }, [games, gameNumbers])

  useLayoutEffect(() => { recomputeLines() }, [games, recomputeLines, selectedRegion])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLinkingFromId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleStartLink = (gameId: string) => {
    setLinkingFromId(prev => (prev === gameId || gameId === '') ? null : gameId)
  }
  const handleCompleteLink = (toGameId: string, slot: 'team1_name' | 'team2_name') => {
    if (!linkingFromId || linkingFromId === toGameId) return
    const fromGame = games.find(g => g.id === linkingFromId)
    const toGame   = games.find(g => g.id === toGameId)
    if (!fromGame || !toGame || fromGame.round_num >= toGame.round_num) return
    onLink(linkingFromId, toGameId, slot)
    setLinkingFromId(null)
  }

  const handleDragStart = (id: string) => setDraggedGameId(id)
  const handleDragOver  = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (id !== draggedGameId) setDragOverGameId(id)
  }
  const handleDragEnd = () => { setDraggedGameId(null); setDragOverGameId(null) }
  const handleDrop = async (e: React.DragEvent, targetGameId: string) => {
    e.preventDefault()
    if (!draggedGameId || draggedGameId === targetGameId) { handleDragEnd(); return }
    const dragged = games.find(g => g.id === draggedGameId)
    const target  = games.find(g => g.id === targetGameId)
    if (!dragged || !target || dragged.round_num !== target.round_num) { handleDragEnd(); return }
    const roundGames = games
      .filter(g => g.round_num === dragged.round_num)
      .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999))
    const draggedIdx = roundGames.findIndex(g => g.id === draggedGameId)
    const targetIdx  = roundGames.findIndex(g => g.id === targetGameId)
    if (draggedIdx === -1 || targetIdx === -1) { handleDragEnd(); return }
    const reordered = [...roundGames]
    const [removed] = reordered.splice(draggedIdx, 1)
    reordered.splice(targetIdx, 0, removed)
    reordered.forEach((g, i) => onUpdateGame(g.id, { sort_order: i }))
    handleDragEnd()
  }

  const handleSaveTipOff = () => {
    onUpdateTournament({
      unlocks_at: cstInputToISO(unlocksAtInput),
      locks_at:   cstInputToISO(locksAtInput),
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-amber-500/10 bg-amber-500/5 flex-shrink-0 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {editingName ? (
              <form onSubmit={e => { e.preventDefault(); onRenameTournament(nameInput); setEditingName(false) }}
                className="flex items-center gap-2">
                <input value={nameInput} onChange={e => setNameInput(e.target.value)} autoFocus
                  className="bg-slate-800 border border-amber-500/40 rounded-lg px-2 py-1 text-white text-sm font-bold focus:outline-none"
                />
                <button type="submit" className="p-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 transition-all">
                  <ChevronRight size={12} />
                </button>
                <button type="button" onClick={() => setEditingName(false)} className="p-1 rounded text-slate-500 hover:text-white transition-all">
                  <X size={12} />
                </button>
              </form>
            ) : (
              <button onClick={() => setEditingName(true)}
                className="flex items-center gap-1.5 group">
                <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide group-hover:text-amber-300 transition-colors">
                  {tournament.name}
                </h2>
                <Edit3 size={12} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
              </button>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest
              ${tournament.status === 'draft' ? 'bg-amber-500/20 text-amber-400' :
                tournament.status === 'open'  ? 'bg-emerald-500/20 text-emerald-400' :
                                                'bg-slate-700 text-slate-400'}`}>
              {tournament.status}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click output dot → input dot to link. Drag cards to reorder.{' '}
            <kbd className="text-slate-600 bg-slate-800 px-1 rounded text-[9px]">Esc</kbd> cancels linking.
          </p>
        </div>

        <div className="flex items-start gap-4 flex-wrap">
          {/* Tip-off schedule */}
          <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Unlocks At (CT)</label>
              <input type="datetime-local" value={unlocksAtInput}
                onChange={e => setUnlocksAtInput(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Locks At (CT)</label>
              <input type="datetime-local" value={locksAtInput}
                onChange={e => setLocksAtInput(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
            <button onClick={handleSaveTipOff}
              className="self-end px-2.5 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all">
              Save
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onReload}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
              <RefreshCw size={12} />
            </button>
            <button onClick={onAddNextRound}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">
              <Plus size={11} /> Add Next Round
            </button>
            {tournament.status === 'draft' && (
              <div className="flex items-center gap-1.5">
                {!publishValid && (
                  <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                    <AlertTriangle size={10} />
                    <span className="text-[10px] font-semibold">Unlinked games</span>
                  </div>
                )}
                <button onClick={onPublish} disabled={!publishValid}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Globe size={11} /> Publish
                </button>
              </div>
            )}
            {tournament.status === 'open' && (
              <button onClick={onLock}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-bold transition-all">
                <Lock size={11} /> Lock
              </button>
            )}
            <button onClick={onDeleteTournament}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all">
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Big Dance region tabs */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-amber-500/10 flex-shrink-0 overflow-x-auto bg-slate-900/30">
          <button onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
              ${!selectedRegion ? 'border-amber-500 text-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            All
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r ? 'border-amber-500 text-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Linking banner */}
      {linkingFromId && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-semibold flex-shrink-0">
          <Link2 size={12} />
          Linking Game #{gameNumbers[linkingFromId] ?? '?'} — Click an input dot on a higher-round game, or press Esc to cancel
          <button onClick={() => setLinkingFromId(null)} className="ml-auto text-amber-400/60 hover:text-amber-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Bracket canvas */}
      <div
        ref={bracketRef}
        className="flex-1 overflow-auto relative"
        style={{ cursor: linkingFromId ? 'crosshair' : 'default' }}
        onScroll={recomputeLines}>
        <svg style={{
          position: 'absolute', top: 0, left: 0,
          width: svgDims.w || '100%', height: svgDims.h || '100%',
          pointerEvents: 'none', zIndex: 0,
        }} className="overflow-visible">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {svgLines.map((line, i) => {
            const cx = (line.x1 + line.x2) / 2
            return (
              <path key={`${line.gameId}-${i}`}
                d={`M ${line.x1} ${line.y1} C ${cx} ${line.y1}, ${cx} ${line.y2}, ${line.x2} ${line.y2}`}
                stroke={line.fromSlot === 'in1' ? '#f59e0b' : '#38bdf8'}
                strokeWidth="1.5" fill="none" strokeOpacity="0.55"
                strokeDasharray="5 3" filter="url(#glow)"
              />
            )
          })}
        </svg>

        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <Plus size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No games yet. Click "Add Next Round" to start building.</p>
          </div>
        ) : (
          <div className="relative flex gap-10 min-w-max items-start p-8" style={{ zIndex: 1 }}
            onClick={e => e.stopPropagation()}>
            {rounds.map(([round, roundGames]) => (
              <div key={round} className="flex flex-col gap-3" style={{ overflow: 'visible' }}>
                <div className="text-center pb-3 border-b border-amber-500/20">
                  <h3 className="font-display text-sm font-bold text-amber-400/70 uppercase tracking-widest">
                    {getRoundLabel(round, maxRound)}
                  </h3>
                  <span className="text-[10px] text-slate-600">
                    {roundGames.length} game{roundGames.length !== 1 ? 's' : ''} · {getScore(round)}pt
                  </span>
                </div>
                <div className="flex flex-col gap-5" style={{ overflow: 'visible' }}>
                  {roundGames.map(game => (
                    <AdminGameCard
                      key={game.id}
                      game={game}
                      allGames={games}
                      gameNum={gameNumbers[game.id] ?? 0}
                      gameNumbers={gameNumbers}
                      maxRound={maxRound}
                      onUpdate={onUpdateGame}
                      onSetWinner={onSetWinner}
                      onDelete={onDeleteGame}
                      onStartLink={handleStartLink}
                      onCompleteLink={handleCompleteLink}
                      onUnlink={onUnlink}
                      linkingFromId={linkingFromId}
                      isValidLinkTarget={
                        linkingFromId !== null &&
                        linkingFromId !== game.id &&
                        (games.find(g => g.id === linkingFromId)?.round_num ?? 0) < game.round_num
                      }
                      isDragOver={dragOverGameId === game.id}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
                <button onClick={() => onAddGameToRound(round)}
                  className="mt-1 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-700 text-slate-600 hover:text-slate-400 hover:border-slate-500 text-[10px] font-semibold transition-all">
                  <Plus size={10} /> Add Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}