// src/features/bracket/ui/BracketView/GameCard.tsx
//
// Purely presentational. Adheres to the broadcast density aesthetic.
//
// ── Visual state matrix (Final Polish) ───────────────────────────────────────
//
//  WINNER (any)        : bg-[#022c22]  ring-2 ring-inset ring-emerald-500
//                        text-emerald-400 font-black
//  WINNER + PICKED     : same + ✓ (emerald) on right
//
//  ELIMINATED + PICKED : line-through text-rose-600 decoration-rose-600
//                        ✕ (rose) on right
//  ELIMINATED + CASCADED (INCORRECT ADVANCEMENT): line-through text-rose-600 decoration-rose-600, NO ✕
//  ELIMINATED + NOT PICKED (ACTUAL): row bg-black/30 (subtle fade), text-slate-500, NO ✕
//                        (Applies to base round unpicked teams OR teams correctly predicted to lose)
//
//  PENDING + PICKED    : text-slate-200 (unchanged from default)
//                        emerald dot on right  ← only if NOT eliminated
//
//  DEFAULT             : text-slate-200

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

  // Card-level styling based on confirmed results
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

      {/* Output anchor for SVG connectors */}
      <div
        data-out={game.id}
        className="absolute w-0 h-0 top-1/2"
        style={{ right: 0 }}
        aria-hidden
      />

      {/* Floating game metadata labels */}
      <div className="absolute -top-4 left-0 flex items-center gap-1">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-widest leading-none">
          #{String(gameNum).padStart(2, '0')}
        </span>
        <span className="text-[9px] text-slate-300 dark:text-slate-700 leading-none">·</span>
        <span className="text-[9px] text-slate-500 dark:text-slate-600 leading-none">{pointValue}pt</span>
      </div>

      {/* Card body */}
      <div
        className={`flex flex-col w-full bg-white dark:bg-[#11141d] border rounded-none transition-colors duration-150 ${cardBorderCls}`}
        style={cardShadowStyle}
      >
        {rows.map(({ actual, predicted, seed, score, inKey }, idx) => {
          const isTBD = isTBDName(predicted)

          // ── State flags ────────────────────────────────────────────────
          const isWinner = hasWinner && !isTBD && (
            game.actual_winner === actual || game.actual_winner === predicted
          )
          const isPicked     = !isTBD && userPick?.predicted_winner === predicted
          const isEliminated = !isTBD && !isWinner && eliminatedTeams.has(predicted)

          // If the predicted team doesn't match the actual team in this slot, 
          // their presence here is a cascaded failure from a previous round.
          const isIncorrectAdvancement = isEliminated && actual !== predicted

          // Cross out ONLY if user picked them for THIS game and they were eliminated,
          // OR if they were incorrectly predicted to reach this slot (cascaded failure).
          const shouldStrikeThrough = isEliminated && (isPicked || isIncorrectAdvancement)
          
          // Fade to black if eliminated but they actually reached this slot and the user didn't pick them to advance further.
          const shouldFade = isEliminated && !shouldStrikeThrough

          // ── Row background + ring ──────────────────────────────────────
          const rowBg = isWinner
            ? 'bg-emerald-50 dark:bg-[#022c22]'
            : shouldFade
              ? 'bg-slate-100/50 dark:bg-black/30'
              : ''
          const rowRingCls = isWinner ? 'ring-2 ring-inset ring-emerald-500 z-10' : ''

          // ── Name text class ────────────────────────────────────────────
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
            // DEFAULT / Pending
            nameClass    = 'text-slate-900 dark:text-slate-200 font-bold'
            seedColorCls = 'text-slate-400 dark:text-slate-500'
          }

          const scoreCls = isWinner ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-600 dark:text-slate-400'
          const canPick  = !isTBD && !isLocked && !readOnly

          // ── Right-side indicator ───────────────────────────────────────
          const showCheck = isWinner && isPicked
          const showX     = isEliminated && isPicked
          const showDot   = !showCheck && !showX && isPicked && !isWinner && !isEliminated

          // Advancing Ghost Label
          const showActualAdvancing = !isTBD && actual && actual !== predicted && !isTBDName(actual)

          return (
            <div
              key={idx}
              className={`
                relative flex items-center justify-between min-h-[32px] py-1 px-2
                border-b border-slate-200 dark:border-[#2a303c] last:border-b-0
                ${rowBg} ${rowRingCls}
                ${canPick ? 'cursor-pointer hover:bg-slate-50 dark:hover:brightness-110' : 'cursor-default'}
                transition-all duration-75
              `}
              onClick={() => canPick && onPick(game, predicted)}
            >
              <div {...{ [inKey]: game.id }} className="absolute left-0 top-1/2 w-0 h-0" aria-hidden />

              {/* Seed badge */}
              {seed != null ? (
                <span className={`w-3.5 text-[9px] font-bold text-right mr-1.5 flex-shrink-0 tabular-nums ${seedColorCls}`}>
                  {seed}
                </span>
              ) : (
                <span className="w-3.5 mr-1.5 flex-shrink-0" aria-hidden />
              )}

              {/* Names Block */}
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

              {/* Score */}
              {score != null && (
                <span className={`text-[11px] font-bold ml-2 flex-shrink-0 tabular-nums ${scoreCls}`}>
                  {score}
                </span>
              )}

              {/* Indicator */}
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