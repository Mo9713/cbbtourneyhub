// src/features/bracket/ui/BracketView/GameCard.tsx

// Pure presentational leaf component. Zero context subscriptions.
// pointValue is passed down from MatchupColumn, which already computes
// it for the column header — no need to re-derive it here.
import { CheckCircle, EyeOff } from 'lucide-react'
import { useTheme }            from '../../../../shared/lib/theme'
import { useBracketView }      from './BracketViewContext'
import type { Game, Pick }     from '../../../../shared/types'

const isTBDName = (n: string) =>
  !n || n === 'TBD' || n === 'BYE' || n.startsWith('Winner of Game')

interface GameCardProps {
  game:            Game
  gameNum:         number
  pointValue:      number
  eliminatedTeams: Set<string>
  userPick:        Pick | undefined
  effectiveTeam1:  { actual: string; predicted: string }
  effectiveTeam2:  { actual: string; predicted: string }
}

export default function GameCard({
  game, gameNum, pointValue, eliminatedTeams, userPick, effectiveTeam1, effectiveTeam2,
}: GameCardProps) {
  const theme                          = useTheme()
  const { isLocked, readOnly, onPick } = useBracketView()

  const teams = [
    { actual: effectiveTeam1.actual, predicted: effectiveTeam1.predicted, key: 'team1' as const },
    { actual: effectiveTeam2.actual, predicted: effectiveTeam2.predicted, key: 'team2' as const },
  ]

  return (
    <div className="relative bg-slate-900/50 backdrop-blur border border-slate-800/80 rounded-xl overflow-hidden w-full flex-shrink-0 shadow-sm hover:border-slate-700 transition-all">
      <div className="px-3 py-1.5 bg-slate-800/30 border-b border-slate-800/60 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          GM #{gameNum} · {pointValue}PT
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

      <div>
        {teams.map(({ actual, predicted, key }) => {
          const isTBD       = isTBDName(predicted)
          const isPicked    = userPick?.predicted_winner === predicted
          const isWinner    = game.actual_winner === actual || game.actual_winner === predicted
          const isLoser     = !!(game.actual_winner && game.actual_winner !== predicted)
          const lostThisGame = !!game.actual_winner && game.actual_winner !== predicted
          const isGhost      = !game.actual_winner && eliminatedTeams.has(predicted)
          const diverged     = !isTBDName(actual) && actual !== predicted && !isTBDName(predicted)
          const isBusted     = lostThisGame || isGhost || diverged

          return (
            <button
              key={key}
              disabled={isLocked || isTBD || !!game.actual_winner || readOnly}
              onClick={() => !isTBD && !readOnly && onPick(game, predicted)}
              className={`w-full text-left px-3 h-[3.25rem] flex items-center gap-2 transition-all group
                ${isTBD || readOnly ? 'cursor-default' : 'cursor-pointer'}
                ${game.actual_winner === actual ? 'bg-emerald-500/10'
                : isPicked    ? `${theme.bg}`
                : isBusted    ? 'bg-rose-500/5'
                :               'hover:bg-slate-800/40'
                } border-b border-slate-800/60 last:border-0`}
            >
              <div className="flex flex-col flex-1 truncate justify-center">
                <span className={`text-sm font-medium truncate leading-tight
                  ${isTBD       ? 'text-slate-600 italic'
                  : game.actual_winner === actual && actual === predicted ? 'text-emerald-400 font-bold'
                  : isBusted    ? 'text-rose-400/70 line-through'
                  : isPicked    ? theme.accent
                  :               'text-slate-200'
                  }`}>
                  {predicted || 'TBD'}
                </span>

                {diverged && (
                  <span className="text-[10px] text-slate-400 mt-0.5 truncate leading-tight">
                    Actual: <span className="text-white font-semibold">{actual}</span>
                  </span>
                )}
              </div>
              {game.actual_winner === actual && (
                <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
              )}
              {isPicked && !isWinner && !isLoser && !diverged && (
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.bgMd}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}