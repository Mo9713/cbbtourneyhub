// src/features/survivor/ui/SurvivorGameCard.tsx

import { Check, Ban } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'
import { isTeamMatch } from '../../../shared/lib/bracketMath'
import type { Game, Pick } from '../../../shared/types'

interface Props {
  game: Game
  currentPick?: Pick
  usedTeams: string[]
  activeRound: number
  isEliminated: boolean
  onMakePick: (gameId: string, teamName: string | null, roundNum: number) => void
}

export function SurvivorGameCard({ game, currentPick, usedTeams, activeRound, isEliminated, onMakePick }: Props) {
  const theme = useTheme()
  const isLocked = activeRound !== game.round_num || isEliminated

  const renderTeam = (teamName: string | null, seed: number | null | undefined, inKey: 'data-in1' | 'data-in2', slot: 'team1' | 'team2') => {
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

    const isPicked = currentPick?.predicted_winner === slot
    const isBurned = usedTeams.includes(teamName) && !isPicked

    // USE FOOL-PROOF MATCHING HERE TOO!
    const isWinner = !!game.actual_winner && isTeamMatch(teamName, game.actual_winner)
    const isLoser  = !!game.actual_winner && !isWinner

    let bgClass = ''
    if (isPicked) bgClass = `${theme.bgMd} font-bold text-amber-500`
    else if (isBurned) bgClass = `opacity-40 grayscale line-through ${theme.textMuted} bg-black/5 dark:bg-white/5`
    else bgClass = `hover:bg-emerald-50 dark:hover:bg-[#022c22] cursor-pointer`

    if (isLoser) {
       bgClass = `opacity-60 line-through ${theme.textMuted} bg-black/5 dark:bg-white/5`
    } else if (isWinner && isPicked) {
       bgClass = `bg-emerald-50 dark:bg-[#022c22] text-emerald-600 dark:text-emerald-400 font-bold`
    }

    if (isLocked && !isPicked && !game.actual_winner) {
      bgClass = `opacity-60 cursor-not-allowed ${theme.textMuted}`
    }

    return (
      <div
        onClick={() => {
          if (isLocked || isBurned) return
          onMakePick(game.id, isPicked ? null : slot, game.round_num)
        }}
        className={`relative flex items-center px-3 py-2 text-xs transition-colors select-none min-h-[32px] ${bgClass}`}
      >
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center pointer-events-none z-10">
          <div {...{ [inKey]: game.id }} className="w-0 h-0" aria-hidden />
        </div>
        <span className={`w-4 text-[10px] font-bold text-right mr-2 ${isWinner ? 'text-emerald-600' : theme.textMuted}`}>{seed || '-'}</span>
        <span className="truncate flex-1">{teamName}</span>
        {isPicked && isWinner && <Check size={14} className="ml-1 shrink-0 text-emerald-500" />}
        {isPicked && isLoser && <Ban size={14} className="ml-1 shrink-0 text-rose-500" />}
        {isPicked && !game.actual_winner && <Check size={14} className="ml-1 shrink-0" />}
        {isBurned && !isPicked && <Ban size={12} className="ml-1 shrink-0 opacity-50" />}
      </div>
    )
  }

  return (
    <div className={`relative flex flex-col w-full border rounded-lg shadow-sm overflow-visible ${theme.panelBg} ${theme.borderBase} ${isEliminated ? 'border-red-500/30' : ''}`}>
      <div className="absolute inset-y-0 right-0 flex flex-col justify-center pointer-events-none z-10">
         <div data-out={game.id} className="w-0 h-0" aria-hidden />
      </div>
      
      {renderTeam(game.team1_name, game.team1_seed, 'data-in1', 'team1')}
      <div className={`h-px w-full ${theme.borderBase}`} />
      {renderTeam(game.team2_name, game.team2_seed, 'data-in2', 'team2')}
    </div>
  )
}