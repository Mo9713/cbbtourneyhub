// src/features/bracket/ui/BracketView/GameCard.tsx
//
// "TeamRankings" style overhaul:
//   • Stark edges (rounded-none) and high-contrast borders.
//   • Game number (#X) integrated into a bold left column inside the card.
//   • Bold, uppercase team names for high readability.
//   • Full-box emerald glow for winning teams.
//   • Cascading 'X' logic for eliminated picks.

import { Check }          from 'lucide-react'
import { useBracketView } from './BracketViewContext'
import type { Game, Pick } from '../../../../shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const isTBDName = (n: string) =>
  !n || n === 'TBD' || n === 'BYE' || n.startsWith('Winner of Game')

// ── Props ─────────────────────────────────────────────────────────────────────

interface GameCardProps {
  game:            Game
  gameNum:         number
  pointValue:      number
  eliminatedTeams: Set<string>
  userPick:        Pick | undefined
  effectiveTeam1:  { actual: string; predicted: string }
  effectiveTeam2:  { actual: string; predicted: string }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GameCard({
  game,
  gameNum,
  eliminatedTeams,
  userPick,
  effectiveTeam1,
  effectiveTeam2,
}: GameCardProps) {
  const { isLocked, readOnly, onPick } = useBracketView()

  const teams = [
    {
      actual:    effectiveTeam1.actual,
      predicted: effectiveTeam1.predicted,
      inAttr:    'data-in1' as const,
    },
    {
      actual:    effectiveTeam2.actual,
      predicted: effectiveTeam2.predicted,
      inAttr:    'data-in2' as const,
    },
  ]

  return (
    <div className="relative w-full" style={{ overflow: 'visible' }}>

      {/* ── Output connector anchor ────────────────────────────────────── */}
      <div
        data-out={game.id}
        className="absolute w-0 h-0 top-1/2"
        style={{ right: 0 }}
        aria-hidden
      />

      {/* ── Team rows with 2px gap ────────────────────────────────── */}
      <div className="flex flex-col gap-[2px] w-full">
        {teams.map(({ actual, predicted, inAttr }, idx) => {
          const isTBD    = isTBDName(predicted)
          const isPicked = userPick?.predicted_winner === predicted

          const isWinner = !!game.actual_winner && (
            game.actual_winner === actual || game.actual_winner === predicted
          )
          const isConfirmedLoser = !!game.actual_winner && !isWinner
          const isEliminated = !isTBD && eliminatedTeams.has(actual)

          const showWin  = isWinner
          const showLoss = isPicked && (isConfirmedLoser || isEliminated)
          const showPick = isPicked && !showWin && !showLoss

          const canClick = !isTBD && !isLocked && !readOnly

          // Stark Styling: Replaced rounded-md with rounded-none
          let rowBg     = 'bg-[#131720] border-slate-800'
          let textColor = isTBD ? 'text-slate-600 italic'
            : (isConfirmedLoser || isEliminated) ? 'text-slate-600'
            : 'text-slate-200'

          if (showWin) {
            rowBg     = 'bg-emerald-950/70 border-emerald-500'
            textColor = 'text-emerald-300'
          } else if (showPick) {
            rowBg     = 'bg-sky-950/50 border-sky-600/60'
            textColor = 'text-sky-200'
          }

          return (
            <div key={inAttr} className="relative">
              {/* Input connector anchor */}
              <div
                {...{ [inAttr]: game.id }}
                className="absolute w-0 h-0 top-1/2 left-0"
                aria-hidden
              />

              {/* Team row — Stark, Bold Box */}
              <div
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
                onClick={() => canClick && onPick(game, predicted)}
                onKeyDown={e => canClick && e.key === 'Enter' && onPick(game, predicted)}
                className={`
                  flex items-center h-8 w-full border
                  ${rowBg} rounded-none transition-all duration-150
                  ${canClick ? 'cursor-pointer hover:brightness-110 active:brightness-125' : 'cursor-default'}
                `}
              >
                {/* STARK Game Num Column: Only shown on the first team row */}
                <div className="w-6 h-full flex items-center justify-center bg-slate-900 border-r border-slate-800 text-[9px] font-black text-slate-500 flex-shrink-0">
                  {idx === 0 ? `#${gameNum}` : ''}
                </div>

                {/* Team Name: BOLD, Uppercase, and Tracking Tight */}
                <span className={`pl-2 text-[11px] font-bold uppercase tracking-tight flex-1 truncate ${textColor}`}>
                  {isTBD ? '—' : predicted}
                </span>

                {/* Indicators Area */}
                <span className="flex-shrink-0 w-6 flex items-center justify-end pr-2">
                  {showWin && (
                    <Check size={11} className="text-emerald-400" strokeWidth={3} />
                  )}
                  {showPick && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  )}
                  {showLoss && (
                    <span className="text-[10px] font-black leading-none text-rose-500">✕</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}