// src.components.GameCard.tsx
import { CheckCircle, EyeOff } from 'lucide-react'
import { useTheme }            from '../../shared/utils/theme'
import { useBracketView }      from './BracketViewContext'
import { useTournamentContext } from '../tournament'
import { getScore }            from '../../shared/utils/helpers'
import type { Game, Pick }     from '../../shared/types'

const isTBDName = (n: string) =>
  !n || n === 'TBD' || n === 'BYE' || n.startsWith('Winner of Game')

interface GameCardProps {
  game:           Game
  userPick:       Pick | undefined
  effectiveTeam1: string
  effectiveTeam2: string
}

export default function GameCard({
  game, userPick, effectiveTeam1, effectiveTeam2,
}: GameCardProps) {
  const theme                          = useTheme()
  const { selectedTournament }         = useTournamentContext()
  const { isLocked, readOnly, onPick } = useBracketView()

  const teams = [
    { name: effectiveTeam1, key: 'team1' as const },
    { name: effectiveTeam2, key: 'team2' as const },
  ]

  // Strictly uses the imported helper or the live database config
  const pts = selectedTournament?.scoring_config?.[String(game.round_num)] ?? getScore(game.round_num)

  return (
    <div className="relative bg-slate-900/50 backdrop-blur border border-slate-800/80 rounded-xl overflow-hidden w-full flex-shrink-0 shadow-sm hover:border-slate-700 transition-all">
      <div className="px-3 py-1.5 bg-slate-800/30 border-b border-slate-800/60 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          R{game.round_num} · {pts}PT
        </span>
        <div className="flex items-center gap-1.5">
          {game.actual_winner && (
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle size={9} /> Final
            </span>
          )}
          {!game.actual_winner && userPick && (
            <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.accent}`}>
              Picked
            </span>
          )}
          {readOnly && (
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
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
          <button
            key={key}
            disabled={isLocked || isTBD || !!game.actual_winner || readOnly}
            onClick={() => !isTBD && !readOnly && onPick(game, name)}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-all group
              ${isTBD || readOnly ? 'cursor-default' : 'cursor-pointer'}
              ${isWinner    ? 'bg-emerald-500/10'
              : isPicked    ? `${theme.bg}`
              : pickedWrong ? 'bg-rose-500/5'
              :               'hover:bg-slate-800/40'
              } border-b border-slate-800/60 last:border-0`}
          >
            <span className={`flex-1 text-sm font-medium truncate
              ${isTBD       ? 'text-slate-600 italic'
              : isWinner    ? 'text-emerald-400 font-bold'
              : pickedWrong ? 'text-rose-400/70 line-through'
              : isPicked    ? theme.accent
              :               'text-slate-200'
              }`}>
              {name || 'TBD'}
            </span>
            {isWinner  && <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />}
            {isPicked && !isWinner && !isLoser && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.bgMd}`} />
            )}
          </button>
        )
      })}
    </div>
  )
}


