// src/features/bracket/ui/AdminBracketGrid/AdminGameCard.tsx
import { useState, useEffect } from 'react'
import { Unlink, Trash2, Target, GripVertical } from 'lucide-react'
import { getScore, isTBDName } from '../../../../shared/lib/helpers'
import { useTheme }            from '../../../../shared/lib/theme'
import type { Game }           from '../../../../shared/types'

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
  const theme = useTheme()

  const [team1,        setTeam1]        = useState(game.team1_name)
  const [team2,        setTeam2]        = useState(game.team2_name)
  const [seed1,        setSeed1]        = useState(String(game.team1_seed ?? ''))
  const [seed2,        setSeed2]        = useState(String(game.team2_seed ?? ''))
  const [score1,       setScore1]       = useState(String(game.team1_score ?? ''))
  const [score2,       setScore2]       = useState(String(game.team2_score ?? ''))
  const [showWinner,   setShowWinner]   = useState(false)

  useEffect(() => { setTeam1(game.team1_name) },              [game.team1_name])
  useEffect(() => { setTeam2(game.team2_name) },              [game.team2_name])
  useEffect(() => { setSeed1(String(game.team1_seed ?? '')) },  [game.team1_seed])
  useEffect(() => { setSeed2(String(game.team2_seed ?? '')) },  [game.team2_seed])
  useEffect(() => { setScore1(String(game.team1_score ?? '')) }, [game.team1_score])
  useEffect(() => { setScore2(String(game.team2_score ?? '')) }, [game.team2_score])

  const isChampionship = game.round_num === maxRound
  const isLinkingFrom  = linkingFromId === game.id

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

  const handleSeedBlur = (field: 'team1_seed' | 'team2_seed', val: string) => {
    const trimmed = val.trim()
    if (trimmed === String(game[field] ?? '')) return
    onUpdate(game.id, { [field]: trimmed || undefined })
  }

  const handleScoreBlur = (field: 'team1_score' | 'team2_score', val: string) => {
    const trimmed = val.trim()
    if (trimmed !== String(game[field] ?? '')) {
      onUpdate(game.id, { [field]: trimmed || undefined })
    }

    const s1Str = field === 'team1_score' ? trimmed : score1.trim()
    const s2Str = field === 'team2_score' ? trimmed : score2.trim()
    if (!s1Str || !s2Str) return

    const s1 = parseInt(s1Str, 10)
    const s2 = parseInt(s2Str, 10)
    if (isNaN(s1) || isNaN(s2) || s1 === s2) return

    const winner = s1 > s2 ? team1 : team2
    if (!isTBDName(winner)) {
      onSetWinner(game, winner)
    }
  }

  const inDotCls = `w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all
    ${isValidLinkTarget
      ? 'border-sky-400 bg-sky-400/40 hover:bg-sky-400 cursor-pointer animate-pulse'
      : `${theme.borderBase} ${theme.inputBg}`
    }`

  const pts        = getScore(game.round_num)
  const hasLinked  = !!game.next_game_id
  const linkedGame = hasLinked ? allGames.find(g => g.id === game.next_game_id) : null

  const rows = [
    {
      field:       'team1_name'  as const,
      seedField:   'team1_seed'  as const,
      scoreField:  'team1_score' as const,
      val:         team1,
      setter:      setTeam1,
      seedVal:     seed1,
      seedSetter:  setSeed1,
      scoreVal:    score1,
      scoreSetter: setScore1,
      isTBD:       isTBDName(team1),
      isWinner:    game.actual_winner === team1 && !isTBDName(team1),
      dataAttr:    { 'data-in1': game.id },
    },
    {
      field:       'team2_name'  as const,
      seedField:   'team2_seed'  as const,
      scoreField:  'team2_score' as const,
      val:         team2,
      setter:      setTeam2,
      seedVal:     seed2,
      seedSetter:  setSeed2,
      scoreVal:    score2,
      scoreSetter: setScore2,
      isTBD:       isTBDName(team2),
      isWinner:    game.actual_winner === team2 && !isTBDName(team2),
      dataAttr:    { 'data-in2': game.id },
    },
  ]

  return (
    <div
      className={`
        relative ${theme.panelBg} border rounded-xl overflow-visible transition-all
        ${isDragOver        ? `border-amber-500/60 shadow-lg shadow-amber-500/10` : theme.borderBase}
        ${isValidLinkTarget ? `border-sky-500/60 shadow-lg shadow-sky-500/10`    : ''}
        ${isLinkingFrom     ? `border-amber-500/80 shadow-lg shadow-amber-500/20` : ''}
      `}
      draggable
      onDragStart={() => onDragStart(game.id)}
      onDragOver={e  => onDragOver(e, game.id)}
      onDragEnd={onDragEnd}
      onDrop={e      => onDrop(e, game.id)}
    >
      <button
        data-out={game.id}
        title="Link output to another game's input"
        onClick={e => { e.stopPropagation(); onStartLink(game.id) }}
        className={`
          absolute -right-8 top-1/2 -translate-y-1/2
          w-2.5 h-2.5 rounded-full border-2 transition-all cursor-pointer z-10
          ${isLinkingFrom
            ? 'border-amber-500 bg-amber-500/40 animate-pulse'
            : `${theme.borderBase} ${theme.panelBg} hover:border-amber-500 hover:bg-amber-500/20`
          }
        `}
      />

      <div className={`flex items-center justify-between px-2 py-1.5 border-b ${theme.borderBase}`}>
        <div className="flex items-center gap-1.5">
          <GripVertical size={11} className={`${theme.textMuted} cursor-grab`} />
          <span className={`text-[9px] font-black ${theme.textMuted} uppercase tracking-widest`}>
            #{String(gameNum).padStart(2, '0')}
          </span>
          {isChampionship && (
            <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
              Final
            </span>
          )}
          <span className={`text-[9px] ${theme.textMuted}`}>·</span>
          <span className={`text-[9px] ${theme.textMuted}`}>{pts}pt</span>
        </div>

        <div className="flex items-center gap-1">
          {hasLinked && (
            <button
              title={`Unlink from Game #${gameNumbers[linkedGame?.id ?? ''] ?? '?'}`}
              onClick={e => { e.stopPropagation(); onUnlink(game.id) }}
              className={`${theme.textMuted} hover:text-rose-500 transition-colors`}
            >
              <Unlink size={10} />
            </button>
          )}
          <button
            title="Set winner"
            onClick={e => { e.stopPropagation(); setShowWinner(v => !v) }}
            className={`transition-colors ${showWinner ? 'text-amber-500' : `${theme.textMuted} hover:text-amber-500`}`}
          >
            <Target size={10} />
          </button>
          <button
            title="Delete game"
            onClick={e => { e.stopPropagation(); onDelete(game) }}
            className={`${theme.textMuted} hover:text-rose-500 transition-colors`}
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {rows.map(({
        field, seedField, scoreField,
        val, setter, seedVal, seedSetter,
        scoreVal, scoreSetter,
        isTBD, isWinner, dataAttr,
      }) => (
        <div
          key={field}
          className={`
            flex items-center gap-1 px-2 py-1 border-b ${theme.borderBase} last:border-b-0
            ${isValidLinkTarget ? `hover:${theme.bg} cursor-pointer` : ''}
            ${isWinner ? 'bg-emerald-500/10' : ''}
          `}
          onClick={e => {
            if (isValidLinkTarget) {
              e.stopPropagation()
              onCompleteLink(game.id, field)
            }
          }}
        >
          <div className={inDotCls} {...dataAttr} />

          <input
            value={seedVal}
            onChange={e => seedSetter(e.target.value)}
            onBlur={e => handleSeedBlur(seedField, e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="#"
            className={`w-6 ${theme.inputBg} border ${theme.borderBase} rounded px-1 text-[9px] font-bold ${theme.textMuted} text-center focus:outline-none focus:border-amber-500/50 transition-colors placeholder:${theme.textMuted}`}
          />

          <input
            value={isTBD ? resolveSlotName(val) : val}
            onChange={e => setter(e.target.value)}
            onBlur={e => handleBlur(field, e.target.value)}
            onClick={e => e.stopPropagation()}
            className={`flex-1 bg-transparent text-xs font-medium focus:outline-none truncate min-w-0
              ${isWinner ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : isTBD   ? `italic ${theme.textMuted}`
                        : theme.textBase}`}
          />

          <input
            value={scoreVal}
            onChange={e => scoreSetter(e.target.value)}
            onBlur={e => handleScoreBlur(scoreField, e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="—"
            className={`w-8 ${theme.inputBg} border ${theme.borderBase} rounded px-1 text-[9px] font-bold ${theme.textMuted} text-center focus:outline-none focus:border-amber-500/50 transition-colors placeholder:${theme.textMuted}`}
          />

          {isWinner && (
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">✓</span>
          )}
        </div>
      ))}

      {showWinner && (
        <div
          className={`px-2 py-2 ${theme.inputBg} border-t ${theme.borderBase} space-y-1`}
          onClick={e => e.stopPropagation()}
        >
          {[team1, team2].filter(t => !isTBDName(t)).map(team => (
            <button key={team}
              onClick={() => onSetWinner(game, team)}
              className={`w-full py-1 rounded-lg text-[10px] font-bold border transition-all
                ${game.actual_winner === team
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : `${theme.panelBg} ${theme.borderBase} ${theme.textBase} hover:brightness-95 dark:hover:brightness-110`
                }`}>
              {team}{game.actual_winner === team && ' ✓'}
            </button>
          ))}
          {[team1, team2].filter(t => !isTBDName(t)).length === 0 && (
            <p className={`text-[10px] ${theme.textMuted} italic`}>
              {team1.startsWith('Winner of Game') && team2.startsWith('Winner of Game')
                ? 'Set winners in earlier rounds first'
                : 'Add team names first'}
            </p>
          )}
          {game.actual_winner && (
            <button onClick={() => onSetWinner(game, '')}
              className="w-full py-1 rounded-lg text-[10px] text-rose-600 dark:text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
              Clear Winner
            </button>
          )}
        </div>
      )}
    </div>
  )
}