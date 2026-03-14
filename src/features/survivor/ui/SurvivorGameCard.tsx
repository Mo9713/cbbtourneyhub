// src/features/survivor/ui/SurvivorGameCard.tsx

import { Check, Ban } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'
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

  const renderTeam = (teamName: string | null, seed: number | null | undefined, inKey: 'data-in1' | 'data-in2') => {
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

    const isPicked = currentPick?.predicted_winner === teamName
    const isBurned = usedTeams.includes(teamName) && !isPicked

    let bgClass = ''
    if (isPicked) bgClass = `${theme.bgMd} font-bold text-amber-500`
    else if (isBurned) bgClass = `opacity-40 grayscale line-through ${theme.textMuted} bg-black/5 dark:bg-white/5`
    else bgClass = `hover:${theme.bgMd} cursor-pointer`

    if (isLocked && !isPicked) {
      bgClass = `opacity-60 cursor-not-allowed ${theme.textMuted}`
    }

    return (
      <div
        onClick={() => {
          if (isLocked || isBurned) return
          onMakePick(game.id, isPicked ? null : teamName, game.round_num)
        }}
        className={`relative flex items-center px-3 py-2 text-xs transition-colors select-none min-h-[32px] ${bgClass}`}
      >
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center pointer-events-none z-10">
          <div {...{ [inKey]: game.id }} className="w-0 h-0" aria-hidden />
        </div>
        <span className={`w-4 text-[10px] font-bold text-right mr-2 ${theme.textMuted}`}>{seed || '-'}</span>
        <span className="truncate flex-1">{teamName}</span>
        {isPicked && <Check size={14} className="ml-1 shrink-0" />}
        {isBurned && !isPicked && <Ban size={12} className="ml-1 shrink-0 opacity-50" />}
      </div>
    )
  }

  return (
    <div className={`relative flex flex-col w-full border rounded-lg shadow-sm overflow-visible ${theme.panelBg} ${theme.borderBase} ${isEliminated ? 'border-red-500/30' : ''}`}>
      <div className="absolute inset-y-0 right-0 flex flex-col justify-center pointer-events-none z-10">
         <div data-out={game.id} className="w-0 h-0" aria-hidden />
      </div>
      
      {renderTeam(game.team1_name, game.team1_seed, 'data-in1')}
      <div className={`h-px w-full ${theme.borderBase}`} />
      {renderTeam(game.team2_name, game.team2_seed, 'data-in2')}
    </div>
  )
}