// src/components/GameCard.tsx
import { CheckCircle, Circle, X, EyeOff } from 'lucide-react'
import { useTheme } from '../utils/theme'
import type { Game, Pick } from '../types'

function getScore(r: number): number {
  // Fibonacci scoring
  if (r <= 0) return 0
  if (r === 1 || r === 2) return 1
  let a = 1, b = 1
  for (let i = 3; i <= r; i++) { const c = a + b; a = b; b = c }
  return b
}

const isTBDName = (n: string) =>
  !n || n === 'TBD' || n === 'BYE' || n.startsWith('Winner of Game')

interface GameCardProps {
  game: Game
  userPick: Pick | undefined
  effectiveTeam1: string
  effectiveTeam2: string
  isLocked: boolean
  onPick: (game: Game, team: string) => void
  readOnly?: boolean
  ownerName?: string
}

export default function GameCard({
  game, userPick, effectiveTeam1, effectiveTeam2,
  isLocked, onPick, readOnly, ownerName,
}: GameCardProps) {
  const theme = useTheme()
  const teams = [
    { name: effectiveTeam1, key: 'team1' as const },
    { name: effectiveTeam2, key: 'team2' as const },
  ]

  return (
    <div className="relative bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl overflow-hidden w-52 flex-shrink-0 shadow-lg hover:border-slate-700 transition-all">
      <div className="px-3 py-1.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {getScore(game.round_num)}pt · R{game.round_num}
        </span>
        <div className="flex items-center gap-1.5">
          {game.actual_winner && (
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle size={9} /> Final
            </span>
          )}
          {!game.actual_winner && userPick && (
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${theme.accent}`}>Picked</span>
          )}
          {readOnly && (
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <EyeOff size={9} /> View
            </span>
          )}
        </div>
      </div>

      {teams.map(({ name, key }) => {
        const isPicked    = userPick?.predicted_winner === name
        const isWinner    = game.actual_winner === name
        const isLoser     = !!(game.actual_winner && game.actual_winner !== name)
        const isTBD       = isTBDName(name)
        const pickedWrong = isPicked && isLoser

        return (
          <button key={key}
            disabled={isLocked || isTBD || !!game.actual_winner || readOnly}
            onClick={() => !isTBD && !readOnly && onPick(game, name)}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-all group
              ${isTBD || readOnly ? 'cursor-default' : 'cursor-pointer'}
              ${isWinner    ? 'bg-emerald-500/15 border-l-2 border-l-emerald-400' : ''}
              ${pickedWrong ? 'bg-rose-500/10 border-l-2 border-l-rose-500' : ''}
              ${isPicked && !game.actual_winner ? `${theme.bg} border-l-2 ${theme.borderB.replace('border-', 'border-l-')}` : ''}
              ${!isPicked && !isWinner && !isTBD && !isLocked && !game.actual_winner && !readOnly
                ? 'hover:bg-slate-800/80' : ''}
            `}>
            <div className="flex-shrink-0 w-3.5">
              {isWinner    && <CheckCircle size={13} className="text-emerald-400" />}
              {pickedWrong && <X           size={13} className="text-rose-400" />}
              {isPicked && !game.actual_winner && <Circle size={13} className={`${theme.accent} fill-current`} />}
              {!isPicked && !isWinner && (
                <Circle size={13} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
              )}
            </div>
            <span className={`flex-1 text-sm font-semibold truncate leading-tight ${
              isTBD       ? 'text-slate-600 italic' :
              isWinner    ? 'text-emerald-300' :
              pickedWrong ? 'text-rose-300/60 line-through' :
              isPicked    ? theme.accentB :
                            'text-slate-200 group-hover:text-white transition-colors'
            }`}>
              {isTBD ? '—' : name}
            </span>
          </button>
        )
      })}
    </div>
  )
}