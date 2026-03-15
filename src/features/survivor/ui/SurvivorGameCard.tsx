// src/features/survivor/ui/SurvivorGameCard.tsx
//
// PRIORITY LADDER (this PR): Team visual state is now resolved through an
// explicit single-assignment priority ladder (teamState) rather than a
// chain of if-reassignments. This eliminates the bug where a "burned"
// team's styling was silently overridden by the "loser" branch, making
// burned teams visually indistinguishable from merely-eliminated ones.
//
// STATE TAXONOMY:
//   winner-picked — correct active pick (green)
//   loser-picked  — wrong active pick, game resolved (rose, strikethrough)
//   loser         — team lost the game, not the user's pick (muted, strikethrough)
//   burned        — used in a prior round, amber left-border signal
//   picked        — active pick, game in progress (amber)
//   locked        — round closed, no pick, no result (neutral grey)
//   default       — available, unpicked, interactable
//
// NEW PROP: isTournamentOver — when true, locks ALL teams regardless of
// round, without requiring tournament.status to be changed. This prevents
// the admin status-write false-lock bug described in the architecture review.
//
// ACCESSIBILITY: aria-disabled and title attributes are set per teamState
// so screen reader users and mobile users without hover can understand
// why an option is unavailable.

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
}

export function SurvivorGameCard({
  game,
  currentPick,
  usedTeams,
  activeRound,
  isEliminated,
  isTournamentOver,
  onMakePick,
}: Props) {
  const theme = useTheme()

  // A pick is locked if: the round clock is wrong, the user is out,
  // or the entire pool resolved via the end_early mass-elimination rule.
  const isPickingLocked = activeRound !== game.round_num || isEliminated || isTournamentOver

  const renderTeam = (
    teamName:    string | null,
    seed:        number | null | undefined,
    inKey:       'data-in1' | 'data-in2',
    slot:        'team1' | 'team2',
  ) => {
    if (!teamName || teamName === 'TBD') {
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

    const isPicked  = currentPick?.predicted_winner === slot
    // A team is burned if the user has committed to it in ANY round, and
    // it is not their CURRENT pick in THIS game (picking it again to toggle off is valid).
    const isBurned  = usedTeams.includes(teamName) && !isPicked
    const isWinner  = !!game.actual_winner && isTeamMatch(teamName, game.actual_winner)
    const isLoser   = !!game.actual_winner && !isWinner

    // ── Single-assignment priority ladder ─────────────────────
    // Each state is mutually exclusive at this priority level. The first
    // matching condition wins — subsequent branches are never evaluated.
    const teamState: TeamState =
      (isWinner && isPicked)                    ? 'winner-picked' :
      (isLoser  && isPicked)                    ? 'loser-picked'  :
      isLoser                                   ? 'loser'         :
      (isBurned && !isPicked)                   ? 'burned'        :
      isPicked                                  ? 'picked'        :
      (isPickingLocked && !game.actual_winner)  ? 'locked'        :
      'default'

    const bgClass = {
      'winner-picked': `bg-emerald-50 dark:bg-[#022c22] text-emerald-600 dark:text-emerald-400 font-bold`,
      'loser-picked':  `opacity-60 line-through decoration-rose-500 ${theme.textMuted} bg-rose-500/5`,
      'loser':         `opacity-50 line-through ${theme.textMuted} bg-black/5 dark:bg-white/5`,
      'burned':        `opacity-40 ${theme.textMuted} bg-amber-500/5 border-l-2 border-amber-500/40 cursor-not-allowed`,
      'picked':        `${theme.bgMd} font-bold text-amber-500`,
      'locked':        `opacity-50 cursor-not-allowed ${theme.textMuted}`,
      'default':       `hover:bg-emerald-50 dark:hover:bg-[#022c22] cursor-pointer`,
    }[teamState]

    // Accessibility metadata per state
    const titleAttr: string | undefined =
      teamState === 'burned'        ? 'Already used — cannot pick again'       :
      teamState === 'loser'         ? 'Eliminated from this game'              :
      teamState === 'loser-picked'  ? 'Wrong pick — this team was eliminated'  :
      teamState === 'locked'        ? 'Round picks are not open'               :
      teamState === 'winner-picked' ? 'Correct pick!'                          :
      undefined

    const isInteractive = teamState === 'default' || teamState === 'picked'

    return (
      <div
        role="button"
        tabIndex={isInteractive ? 0 : -1}
        aria-disabled={!isInteractive}
        title={titleAttr}
        onClick={() => {
          if (isPickingLocked || isBurned) return
          onMakePick(game.id, isPicked ? null : slot, game.round_num)
        }}
        onKeyDown={(e) => {
          if (!isInteractive) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onMakePick(game.id, isPicked ? null : slot, game.round_num)
          }
        }}
        className={`relative flex items-center px-3 py-2 text-xs transition-colors select-none min-h-[32px] ${bgClass}`}
      >
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center pointer-events-none z-10">
          <div {...{ [inKey]: game.id }} className="w-0 h-0" aria-hidden />
        </div>

        <span className={`w-4 text-[10px] font-bold text-right mr-2 ${isWinner ? 'text-emerald-600' : theme.textMuted}`}>
          {seed || '-'}
        </span>

        <span className="truncate flex-1">{teamName}</span>

        {/* State icons — only one renders per team per the priority ladder */}
        {teamState === 'winner-picked' && <Check  size={14} className="ml-1 shrink-0 text-emerald-500" />}
        {teamState === 'loser-picked'  && <Ban    size={14} className="ml-1 shrink-0 text-rose-500" />}
        {teamState === 'burned'        && <Flame  size={12} className="ml-1 shrink-0 text-amber-500/70" />}
        {teamState === 'picked'        && <Check  size={14} className="ml-1 shrink-0 text-amber-500" />}
      </div>
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