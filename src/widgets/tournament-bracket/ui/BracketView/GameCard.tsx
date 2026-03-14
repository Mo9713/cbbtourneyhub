// src/widgets/tournament-bracket/ui/BracketView/GameCard.tsx

import { useBracketView } from './BracketViewContext'
import type { Game, Pick } from '../../../../shared/types'

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
  game,
  gameNum,
  pointValue,
  eliminatedTeams,
  userPick,
  effectiveTeam1,
  effectiveTeam2,
}: GameCardProps) {
  const { isLocked, readOnly, onPick } = useBracketView()

  const hasWinner = !!game.actual_winner

  const cardBorderCls   = hasWinner ? 'border-emerald-500/50 dark:border-emerald-900/50' : 'border-slate-300 dark:border-slate-800'
  const cardShadowStyle = hasWinner
    ? { boxShadow: '0 0 14px 2px rgba(16, 185, 129, 0.25)' }
    : undefined

  const rows = [
    {
      actual:    effectiveTeam1.actual,
      predicted: effectiveTeam1.predicted,
      seed:      game.team1_seed,
      score:     game.team1_score,
      inKey:     'data-in1' as const,
    },
    {
      actual:    effectiveTeam2.actual,
      predicted: effectiveTeam2.predicted,
      seed:      game.team2_seed,
      score:     game.team2_score,
      inKey:     'data-in2' as const,
    },
  ]

  return (
    <div className="relative w-full" style={{ overflow: 'visible' }}>
      <div className="absolute -top-4 left-0 flex items-center gap-1">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-widest leading-none">
          #{String(gameNum).padStart(2, '0')}
        </span>
        <span className="text-[9px] text-slate-300 dark:text-slate-700 leading-none">·</span>
        <span className="text-[9px] text-slate-500 dark:text-slate-600 leading-none">{pointValue}pt</span>
      </div>

      <div
        className={`relative flex flex-col w-full bg-white dark:bg-[#11141d] border rounded-none transition-colors duration-150 ${cardBorderCls}`}
        style={cardShadowStyle}
      >
        <div className="absolute inset-y-0 right-0 flex flex-col justify-center pointer-events-none z-10">
          <div data-out={game.id} className="w-0 h-0" aria-hidden />
        </div>

        {rows.map(({ actual, predicted, seed, score, inKey }, idx) => {
          const isTBD = isTBDName(predicted)

          const isWinner = hasWinner && !isTBD && (
            game.actual_winner === actual || game.actual_winner === predicted
          )
          const isPicked     = !isTBD && userPick?.predicted_winner === predicted
          const isEliminated = !isTBD && !isWinner && eliminatedTeams.has(predicted)

          const isIncorrectAdvancement = isEliminated && actual !== predicted
          const shouldStrikeThrough = isEliminated && (isPicked || isIncorrectAdvancement)
          const shouldFade = isEliminated && !shouldStrikeThrough

          const rowBg = isWinner
            ? 'bg-emerald-50 dark:bg-[#022c22]'
            : shouldFade
              ? 'bg-slate-100/50 dark:bg-black/30'
              : ''
          const rowRingCls = isWinner ? 'ring-2 ring-inset ring-emerald-500 z-10' : ''

          let nameClass: string
          let seedColorCls: string

          if (isWinner) {
            nameClass    = 'text-emerald-600 dark:text-emerald-400 font-black'
            seedColorCls = 'text-emerald-600 dark:text-emerald-400'
          } else if (shouldStrikeThrough) {
            nameClass    = 'line-through text-rose-600 dark:text-rose-500 decoration-rose-600 dark:decoration-rose-500 decoration-2 font-bold'
            seedColorCls = 'text-rose-600 dark:text-rose-500 line-through decoration-rose-600 dark:decoration-rose-500 decoration-2'
          } else if (shouldFade) {
            nameClass    = 'text-slate-400 dark:text-slate-500'
            seedColorCls = 'text-slate-300 dark:text-slate-600'
          } else if (isTBD) {
            nameClass    = 'text-slate-400 dark:text-slate-600 italic'
            seedColorCls = 'text-slate-300 dark:text-slate-700'
          } else {
            nameClass    = 'text-slate-900 dark:text-slate-200 font-bold'
            seedColorCls = 'text-slate-400 dark:text-slate-500'
          }

          const scoreCls = isWinner ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-600 dark:text-slate-400'
          const canPick  = !isTBD && !isLocked && !readOnly

          const showCheck = isWinner && isPicked
          const showX     = isEliminated && isPicked
          const showDot   = !showCheck && !showX && isPicked && !isWinner && !isEliminated
          const showActualAdvancing = !isTBD && actual && actual !== predicted && !isTBDName(actual)

          return (
            <div
              key={idx}
              className={`
                relative flex items-center justify-between min-h-[32px] py-1 px-2
                border-b border-slate-200 dark:border-[#2a303c] last:border-b-0
                ${rowBg} ${rowRingCls}
                ${canPick ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-[#022c22]' : 'cursor-default'}
                transition-all duration-75
              `}
              onClick={() => canPick && onPick(game, predicted)}
            >
              <div className="absolute inset-y-0 left-0 flex flex-col justify-center pointer-events-none z-10">
                <div {...{ [inKey]: game.id }} className="w-0 h-0" aria-hidden />
              </div>

              {seed != null ? (
                <span className={`w-3.5 text-[9px] font-bold text-right mr-1.5 flex-shrink-0 tabular-nums ${seedColorCls}`}>
                  {seed}
                </span>
              ) : (
                <span className="w-3.5 mr-1.5 flex-shrink-0" aria-hidden />
              )}

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className={`text-[11px] uppercase tracking-tight truncate leading-tight ${nameClass}`}>
                  {isTBD ? '—' : predicted}
                </span>
                {showActualAdvancing && (
                  <span className="block text-[8px] text-slate-500 dark:text-slate-500 uppercase tracking-tighter leading-none mt-0.5 font-bold">
                    Actual: {actual}
                  </span>
                )}
              </div>

              {score != null && (
                <span className={`text-[11px] font-bold ml-2 flex-shrink-0 tabular-nums ${scoreCls}`}>
                  {score}
                </span>
              )}

              <div className="flex items-center justify-center w-5 flex-shrink-0">
                {showCheck && (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 leading-none">✓</span>
                )}
                {showX && (
                  <span className="text-[10px] font-black text-rose-600 dark:text-rose-500 leading-none">✕</span>
                )}
                {showDot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}