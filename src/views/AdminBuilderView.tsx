// src/views/AdminBuilderView.tsx
import {
  useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect,
} from 'react'
import {
  Plus, Lock, Globe, AlertTriangle, Edit3, Link2, Settings2,
  RefreshCw, Trash2, X, GripVertical, Unlink, Target,
  ChevronRight, ToggleLeft, ToggleRight, Hash,
} from 'lucide-react'
import { useTheme }                              from '../utils/theme'
import { isoToInputCST, cstInputToISO }         from '../utils/time'
import { getScore, getRoundLabel, isTBDName, computeGameNumbers, BD_REGIONS, fibonacci } from '../utils/helpers'
import type { Tournament, Game, SVGLine, ScoringConfig } from '../types'

// ─────────────────────────────────────────────────────────────
// AdminGameCard
// ─────────────────────────────────────────────────────────────
function AdminGameCard({
  game, allGames, gameNum, gameNumbers, maxRound,
  onUpdate, onSetWinner, onDelete, onStartLink, onCompleteLink, onUnlink,
  linkingFromId, isValidLinkTarget, isDragOver,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  game: Game; allGames: Game[]; gameNum: number
  gameNumbers: Record<string, number>; maxRound: number
  onUpdate:          (id: string, updates: Partial<Game>) => void
  onSetWinner:       (game: Game, winner: string) => void
  onDelete:          (game: Game) => void
  onStartLink:       (gameId: string) => void
  onCompleteLink:    (toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onUnlink:          (gameId: string) => void
  linkingFromId:     string | null
  isValidLinkTarget: boolean
  isDragOver:        boolean
  onDragStart: (id: string) => void
  onDragOver:  (e: React.DragEvent, id: string) => void
  onDragEnd:   () => void
  onDrop:      (e: React.DragEvent, id: string) => void
}) {
  const theme = useTheme()
  const [team1,       setTeam1]       = useState(game.team1_name)
  const [team2,       setTeam2]       = useState(game.team2_name)
  const [showWinner,  setShowWinner]  = useState(false)

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
    const gNum       = parseInt(slotName.replace('Winner of Game #', ''), 10)
    const feederGame = allGames.find(g => gameNumbers[g.id] === gNum)
    return feederGame?.actual_winner ?? slotName
  }

  const inDot1Class = `w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all
    ${isValidLinkTarget
      ? 'border-sky-400 bg-sky-400/40 hover:bg-sky-400 cursor-pointer animate-pulse'
      : 'border-slate-600 bg-slate-800'
    }`
  const inDot2Class = inDot1Class

  const outDotClass = `w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all cursor-pointer
    ${isLinkingFrom
      ? 'border-amber-400 bg-amber-400 scale-150 shadow-lg shadow-amber-400/40'
      : game.next_game_id
        ? 'border-emerald-500 bg-emerald-500/30 hover:bg-emerald-500/60'
        : 'border-slate-600 bg-slate-800 hover:border-amber-400'
    }`

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
      {/* Output dot (links out to next game) */}
      {!isChampionship && (
        <div
          data-out={game.id}
          className={`absolute -right-4 top-1/2 -translate-y-1/2 ${outDotClass}`}
          onClick={() => onStartLink(game.id)}
        />
      )}

      <div
        className={`w-52 rounded-xl border overflow-hidden shadow transition-all
          ${isLinkingFrom
            ? 'border-amber-400/60 shadow-amber-400/20 shadow-lg'
            : isValidLinkTarget
              ? 'border-sky-400/60 shadow-sky-400/20 shadow-lg cursor-pointer'
              : 'border-slate-700 hover:border-slate-600'
          } bg-slate-900/90`}
        onClick={() => isValidLinkTarget && onCompleteLink(game.id, 'team1_name')}
      >
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
              title="Set winner"
              className={`p-1 rounded hover:bg-slate-700 transition-all ${showWinner ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}>
              <Target size={9} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(game) }}
              title="Delete" className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-rose-400 transition-all">
              <Trash2 size={9} />
            </button>
          </div>
        </div>

        {/* Team slots */}
        {[
          { val: team1, setter: setTeam1, field: 'team1_name' as const, slot: 'team1_name' as const },
          { val: team2, setter: setTeam2, field: 'team2_name' as const, slot: 'team2_name' as const },
        ].map(({ val, setter, field, slot }) => {
          const isTBD     = isTBDName(val)
          const isWinner  = game.actual_winner === val
          const dotClass  = slot === 'team1_name' ? inDot1Class : inDot2Class
          const dataAttr  = slot === 'team1_name'
            ? { 'data-in1': game.id }
            : { 'data-in2': game.id }

          return (
            <div
              key={field}
              className={`flex items-center gap-2 px-2 py-1.5 border-b border-slate-800/60 last:border-0
                ${isWinner ? 'bg-emerald-500/10' : ''}`}
              onClick={e => {
                if (isValidLinkTarget) { e.stopPropagation(); onCompleteLink(game.id, slot) }
              }}
            >
              <div className={dotClass} {...dataAttr} />
              <input
                value={isTBD ? resolveSlotName(val) : val}
                onChange={e => setter(e.target.value)}
                onBlur={e => handleBlur(field, e.target.value)}
                onClick={e => e.stopPropagation()}
                className={`flex-1 bg-transparent text-xs font-medium focus:outline-none truncate
                  ${isWinner
                    ? 'text-emerald-400 font-bold'
                    : isTBD
                      ? 'text-slate-600 italic'
                      : 'text-white'
                  }`}
              />
              {isWinner && <span className="text-[9px] text-emerald-400 font-bold">✓</span>}
            </div>
          )
        })}

        {/* Winner setter */}
        {showWinner && (
          <div className="px-2 py-2 bg-slate-800/40 border-t border-slate-800 space-y-1" onClick={e => e.stopPropagation()}>
            {[team1, team2]
              .filter(t => !isTBDName(t))
              .map(team => (
                <button key={team} onClick={() => onSetWinner(game, team)}
                  className={`w-full py-1 rounded-lg text-[10px] font-bold border transition-all
                    ${game.actual_winner === team
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}>
                  {team}{game.actual_winner === team && ' ✓'}
                </button>
              ))
            }
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

// ─────────────────────────────────────────────────────────────
// TournamentConfigPanel
// ─────────────────────────────────────────────────────────────
function TournamentConfigPanel({
  tournament, games, onUpdateTournament,
}: {
  tournament:        Tournament
  games:             Game[]
  onUpdateTournament: (updates: Partial<Tournament>) => void
}) {
  const theme    = useTheme()
  const maxRound = games.length ? Math.max(...games.map(g => g.round_num)) : 6

  const [open,            setOpen]            = useState(false)
  const [roundNamesInput, setRoundNamesInput] = useState<string[]>(
    tournament.round_names?.length ? [...tournament.round_names] : []
  )
  const [scoringInput, setScoringInput] = useState<Record<string, string>>(() => {
    const config = tournament.scoring_config ?? {}
    const result: Record<string, string> = {}
    for (let r = 1; r <= Math.max(maxRound, 6); r++) {
      result[String(r)] = config[String(r)] !== undefined
        ? String(config[String(r)])
        : String(fibonacci(r + 1))
    }
    return result
  })

  // Sync when tournament prop updates from parent (e.g. after a save)
  useEffect(() => {
    setRoundNamesInput(tournament.round_names?.length ? [...tournament.round_names] : [])
  }, [tournament.round_names])

  useEffect(() => {
    const config = tournament.scoring_config ?? {}
    const result: Record<string, string> = {}
    for (let r = 1; r <= Math.max(maxRound, 6); r++) {
      result[String(r)] = config[String(r)] !== undefined
        ? String(config[String(r)])
        : String(fibonacci(r + 1))
    }
    setScoringInput(result)
  }, [tournament.scoring_config, maxRound])

  const handleSaveConfig = () => {
    // Build scoring config — only save if any round differs from Fibonacci default
    const config: ScoringConfig = {}
    let isCustom = false
    Object.entries(scoringInput).forEach(([r, val]) => {
      const parsed     = parseInt(val, 10)
      const defaultVal = fibonacci(parseInt(r, 10) + 1)
      if (!isNaN(parsed)) {
        config[r] = parsed
        if (parsed !== defaultVal) isCustom = true
      }
    })

    onUpdateTournament({
      round_names:    roundNamesInput.map(n => n.trim()),
      scoring_config: isCustom ? config : null,
    })
  }

  const resetScoringToFibonacci = () => {
    const reset: Record<string, string> = {}
    for (let r = 1; r <= Math.max(maxRound, 6); r++) {
      reset[String(r)] = String(fibonacci(r + 1))
    }
    setScoringInput(reset)
  }

  const inputCls = `bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-slate-500 transition-colors`

  return (
    <div className="w-full border-t border-amber-500/10 mt-3 pt-3">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[11px] font-bold text-amber-400/70 hover:text-amber-300 uppercase tracking-widest transition-colors w-full text-left"
      >
        <Settings2 size={11} />
        Tournament Config
        <span className="text-slate-600 normal-case font-normal tracking-normal ml-1">
          scoring · round names · tiebreaker
        </span>
        <span className={`ml-auto text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* ── Scoring per round ── */}
          <div className={`${theme.panelBg} border border-slate-800 rounded-xl p-3`}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Hash size={9} /> Points per Round
            </h4>
            <div className="space-y-1.5">
              {Array.from({ length: maxRound }, (_, i) => {
                const r = String(i + 1)
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-14 flex-shrink-0">Round {r}</span>
                    <input
                      type="number" min="0"
                      value={scoringInput[r] ?? ''}
                      onChange={e => setScoringInput(prev => ({ ...prev, [r]: e.target.value }))}
                      className={`w-14 text-center ${inputCls}`}
                    />
                    <span className="text-[10px] text-slate-600">
                      (fib: {fibonacci(i + 2)})
                    </span>
                  </div>
                )
              })}
            </div>
            {tournament.scoring_config && (
              <button
                onClick={resetScoringToFibonacci}
                className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
              >
                ↺ Reset to Fibonacci
              </button>
            )}
          </div>

          {/* ── Custom round names ── */}
          <div className={`${theme.panelBg} border border-slate-800 rounded-xl p-3`}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Custom Round Names
            </h4>
            <p className="text-[10px] text-slate-600 mb-2">
              Leave blank to use the default label for that round.
            </p>
            <div className="space-y-1.5">
              {Array.from({ length: maxRound }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-14 flex-shrink-0">Round {i + 1}</span>
                  <input
                    value={roundNamesInput[i] ?? ''}
                    onChange={e => {
                      const next = [...roundNamesInput]
                      next[i] = e.target.value
                      setRoundNamesInput(next)
                    }}
                    placeholder={getRoundLabel(i + 1, maxRound)}
                    className={`flex-1 ${inputCls} placeholder-slate-700`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Tie-breaker toggle ── */}
          <div className={`${theme.panelBg} border border-slate-800 rounded-xl p-3`}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Tie-Breaker
            </h4>
            <p className="text-[10px] text-slate-600 mb-3">
              Require users to predict the championship game's final score. Used to break point ties on the leaderboard.
            </p>
            <button
              onClick={() => onUpdateTournament({ requires_tiebreaker: !tournament.requires_tiebreaker })}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-bold
                ${tournament.requires_tiebreaker
                  ? `${theme.bg} ${theme.border} ${theme.accent}`
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
            >
              {tournament.requires_tiebreaker ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {tournament.requires_tiebreaker ? 'Enabled' : 'Disabled'}
            </button>
            {tournament.requires_tiebreaker && (
              <p className="mt-2 text-[10px] text-amber-400/70">
                Users will see a score input on the championship game card.
              </p>
            )}
          </div>

          {/* ── Save button ── */}
          <div className="md:col-span-3 flex justify-end">
            <button
              onClick={handleSaveConfig}
              className={`px-5 py-2 rounded-xl text-white text-sm font-bold transition-all ${theme.btn}`}
            >
              Save Tournament Config
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AdminBuilderView
// ─────────────────────────────────────────────────────────────
interface AdminBuilderViewProps {
  tournament:         Tournament
  games:              Game[]
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

  // ── SVG connector lines ──────────────────────────────────
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

      // ── Slot resolution: text-match first, index fallback second ──
      //
      // PRIMARY: Check the next game's slot text against the canonical
      //          "Winner of Game #N" placeholder that was written at link time.
      //          This is the only reliable source of truth for custom brackets
      //          where a user has manually linked to a specific top/bottom slot.
      //
      // SECONDARY: If the winner has already advanced, the placeholder will have
      //            been replaced by the team name — match that instead.
      //
      // FALLBACK: Sort feeders by sort_order and use index. Only reached when
      //           no text evidence exists (e.g. a template game before slot
      //           labels have been written).

      const nextGame   = games.find(g => g.id === game.next_game_id)
      const winnerText = `Winner of Game #${gameNumbers[game.id]}`

      let slot: 'in1' | 'in2'

      if (nextGame) {
        if (
          nextGame.team1_name === winnerText ||
          (game.actual_winner && nextGame.team1_name === game.actual_winner)
        ) {
          slot = 'in1'
        } else if (
          nextGame.team2_name === winnerText ||
          (game.actual_winner && nextGame.team2_name === game.actual_winner)
        ) {
          slot = 'in2'
        } else {
          // Fallback: index order
          const feeders = games
            .filter(g => g.next_game_id === game.next_game_id)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
          slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'in1' : 'in2'
        }
      } else {
        // nextGame not in local state yet — fall back to index
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

  // ── Link handlers ────────────────────────────────────────
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

  // ── Drag handlers ────────────────────────────────────────
  const handleDragStart = (id: string) => setDraggedGameId(id)
  const handleDragOver  = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (id !== draggedGameId) setDragOverGameId(id)
  }
  const handleDragEnd = () => { setDraggedGameId(null); setDragOverGameId(null) }
  const handleDrop = (e: React.DragEvent, targetGameId: string) => {
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

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 py-3 border-b border-amber-500/10 bg-amber-500/5 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">

          {/* Title + status */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {editingName ? (
                <form
                  onSubmit={e => { e.preventDefault(); onRenameTournament(nameInput); setEditingName(false) }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    autoFocus
                    className="bg-slate-800 border border-amber-500/40 rounded-lg px-2 py-1 text-white text-sm font-bold focus:outline-none"
                  />
                  <button type="submit" className="p-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 transition-all">
                    <ChevronRight size={12} />
                  </button>
                  <button type="button" onClick={() => setEditingName(false)}
                    className="p-1 rounded text-slate-500 hover:text-white transition-all">
                    <X size={12} />
                  </button>
                </form>
              ) : (
                <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 group">
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
            <p className="text-[11px] text-slate-500">
              Click output dot → input dot to link. Drag cards to reorder.{' '}
              <kbd className="text-slate-600 bg-slate-800 px-1 rounded text-[9px]">Esc</kbd> cancels linking.
            </p>
          </div>

          {/* Right side: schedule + actions */}
          <div className="flex items-start gap-4 flex-wrap">

            {/* Tip-off schedule */}
            <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Unlocks At (CT)
                </label>
                <input
                  type="datetime-local" value={unlocksAtInput}
                  onChange={e => setUnlocksAtInput(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Locks At (CT)
                </label>
                <input
                  type="datetime-local" value={locksAtInput}
                  onChange={e => setLocksAtInput(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <button
                onClick={handleSaveTipOff}
                className="self-end px-2.5 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all"
              >
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

        {/* ── Tournament Config Panel (collapsible) ── */}
        <TournamentConfigPanel
          tournament={tournament}
          games={games}
          onUpdateTournament={onUpdateTournament}
        />
      </div>

      {/* ── Big Dance region tabs ── */}
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

      {/* ── Linking banner ── */}
      {linkingFromId && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-semibold flex-shrink-0">
          <Link2 size={12} />
          Linking Game #{gameNumbers[linkingFromId] ?? '?'} — Click an input dot on a higher-round game, or press Esc to cancel
          <button onClick={() => setLinkingFromId(null)} className="ml-auto text-amber-400/60 hover:text-amber-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Bracket canvas ── */}
      <div
        ref={bracketRef}
        className="flex-1 overflow-auto relative"
        style={{ cursor: linkingFromId ? 'crosshair' : 'default' }}
        onScroll={recomputeLines}
      >
        {/* SVG connector lines */}
        <svg style={{
          position: 'absolute', top: 0, left: 0,
          width: svgDims.w || '100%', height: svgDims.h || '100%',
          pointerEvents: 'none', zIndex: 0,
        }} className="overflow-visible">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
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
                    {/* Use custom name if provided, otherwise fall back to default label */}
                    {tournament.round_names?.[round - 1]?.trim()
                      ? tournament.round_names[round - 1]
                      : getRoundLabel(round, maxRound)
                    }
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
                {/* Add game to this round button */}
                <button
                  onClick={() => onAddGameToRound(round)}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-amber-500/40 text-slate-600 hover:text-amber-400/70 text-[10px] font-bold transition-all"
                >
                  <Plus size={9} /> Add Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}