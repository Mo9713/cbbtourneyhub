import { Check, Ban, Flame } from 'lucide-react'
import { useTheme }          from '../../../shared/lib/theme'
import { isTeamMatch }       from '../../../shared/lib/bracketMath'
import type { Game, Pick }   from '../../../shared/types'

type TeamState =
  | 'winner-picked'
  | 'loser-picked'
  | 'loser'
  | 'burned'
  | 'picked'
  | 'locked'
  | 'default'

interface Props {
  game:            Game
  currentPick?:    Pick
  usedTeams:       string[]
  activeRound:     number
  isEliminated:    boolean
  isTournamentOver: boolean
  onMakePick:      (gameId: string, teamName: string | null, roundNum: number) => void
  readOnly?:       boolean
  adminOverride?:  boolean
}

export function SurvivorGameCard({
  game,
  currentPick,
  usedTeams,
  activeRound,
  isEliminated,
  isTournamentOver,
  onMakePick,
  readOnly = false,
  adminOverride = false,
}: Props) {
  const theme = useTheme()

  const isSecret = readOnly && !adminOverride && activeRound > 0 && game.round_num >= activeRound
  const effectivePick = isSecret ? undefined : currentPick

  const isPickingLocked = (activeRound !== game.round_num || isEliminated || isTournamentOver) && !adminOverride
  const canPick = adminOverride || (!readOnly && !isPickingLocked)

  const renderTeam = (
    teamName:    string | null,
    seed:        number | null | undefined,
    inKey:       'data-in1' | 'data-in2',
    slot:        'team1' | 'team2',
  ) => {
    if (!teamName || teamName === 'TBD' || teamName.toLowerCase().includes('winner')) {
      return (
        <div className={`relative flex items-center px-3 py-2 text-xs ${theme.textMuted} opacity-50 min-h-[32px]`}>
          <div className="absolute inset-y-0 left-0 flex flex-col justify-center pointer-events-none z-10">
            <div {...{ [inKey]: game.id }} className="w-0 h-0" aria-hidden />
          </div>
          <span className="w-4 text-right mr-2 opacity-50">-</span>
          <span className="truncate">TBD</span>
        </div>
      )
    }

    const isPicked  = effectivePick?.predicted_winner === slot
    const isBurned  = usedTeams.includes(teamName) && !isPicked
    const isWinner  = !!game.actual_winner && isTeamMatch(teamName, game.actual_winner)
    const isLoser   = !!game.actual_winner && !isWinner

    const teamState: TeamState =
      (isWinner && isPicked)                    ? 'winner-picked' :
      (isLoser  && isPicked)                    ? 'loser-picked'  :
      isLoser                                   ? 'loser'         :
      (isBurned && !isPicked)                   ? 'burned'        :
      isPicked                                  ? 'picked'        :
      (isPickingLocked && !game.actual_winner)  ? 'locked'        :
      'default'

    const isInteractive = canPick && teamState !== 'burned'

    const bgClass = {
      'winner-picked': `bg-emerald-50 dark:bg-[#022c22] text-emerald-600 dark:text-emerald-400 font-bold ${isInteractive ? 'cursor-pointer' : ''}`,
      'loser-picked':  `opacity-60 line-through decoration-rose-500 ${theme.textMuted} bg-rose-500/5 ${isInteractive ? 'cursor-pointer' : ''}`,
      'loser':         `opacity-50 line-through ${theme.textMuted} bg-black/5 dark:bg-white/5 ${isInteractive ? 'cursor-pointer' : ''}`,
      'burned':        `opacity-40 ${theme.textMuted} bg-amber-500/5 border-l-2 border-amber-500/40 cursor-not-allowed`,
      'picked':        `${theme.bgMd} font-bold text-amber-500 ${isInteractive ? 'cursor-pointer' : ''}`,
      'locked':        `opacity-50 cursor-not-allowed ${theme.textMuted}`,
      'default':       `hover:bg-emerald-50 dark:hover:bg-[#022c22] ${isInteractive ? 'cursor-pointer' : ''}`,
    }[teamState]

    const titleAttr: string | undefined =
      isSecret                      ? 'Pick is hidden until round locks'       :
      teamState === 'burned'        ? 'Already used — cannot pick again'       :
      teamState === 'loser'         ? 'Eliminated from this game'              :
      teamState === 'loser-picked'  ? 'Wrong pick — this team was eliminated'  :
      teamState === 'locked'        ? 'Round picks are not open'               :
      teamState === 'winner-picked' ? 'Correct pick!'                          :
      undefined

    // FIX U-01: Swapped `div role="button"` for native `<button>`
    return (
      <button
        type="button"
        disabled={!isInteractive}
        title={titleAttr}
        onClick={() => {
          if (!isInteractive) return
          onMakePick(game.id, isPicked ? null : slot, game.round_num)
        }}
        className={`w-full relative flex items-center text-left px-3 py-2 text-xs transition-colors select-none min-h-[32px] outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${bgClass}`}
      >
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center pointer-events-none z-10">
          <div {...{ [inKey]: game.id }} className="w-0 h-0" aria-hidden />
        </div>

        <span className={`w-4 text-[10px] font-bold text-right mr-2 ${isWinner ? 'text-emerald-600' : theme.textMuted}`}>
          {seed || '-'}
        </span>

        <span className={`truncate flex-1 ${isSecret ? 'italic opacity-60' : ''}`}>
          {isSecret ? 'Hidden' : teamName}
        </span>

        {teamState === 'winner-picked' && <Check  size={14} className="ml-1 shrink-0 text-emerald-500" />}
        {teamState === 'loser-picked'  && <Ban    size={14} className="ml-1 shrink-0 text-rose-500" />}
        {teamState === 'burned'        && <Flame  size={12} className="ml-1 shrink-0 text-amber-500/70" />}
        {teamState === 'picked'        && <Check  size={14} className="ml-1 shrink-0 text-amber-500" />}
      </button>
    )
  }

  return (
    <div
      className={`relative flex flex-col w-full border rounded-lg shadow-sm overflow-visible
        ${theme.panelBg} ${theme.borderBase}
        ${isEliminated    ? 'border-rose-500/30'   : ''}
        ${isTournamentOver? 'border-slate-500/30 opacity-75' : ''}
      `}
    >
      <div className="absolute inset-y-0 right-0 flex flex-col justify-center pointer-events-none z-10">
        <div data-out={game.id} className="w-0 h-0" aria-hidden />
      </div>

      {renderTeam(game.team1_name, game.team1_seed, 'data-in1', 'team1')}
      <div className={`h-px w-full ${theme.borderBase}`} />
      {renderTeam(game.team2_name, game.team2_seed, 'data-in2', 'team2')}
    </div>
  )
}