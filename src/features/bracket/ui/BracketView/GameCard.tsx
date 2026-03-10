// src/features/bracket/ui/BracketView/GameCard.tsx
//
// "Broadcast block" — exactly matches the Navy/Bucknell reference screenshot.
//
// Anatomy:
//   ┌──────────────────────────────────────────┐  ← no outer rounding
//   │ [gutter│ TEAM NAME                    ✓] │  ← winner: full emerald border + bg
//   ├──────────────────────────────────────────┤  ← 1px dark divider
//   │ [gutter│ TEAM NAME                      ] │  ← loser/default: dark bg, dimmed
//   └──────────────────────────────────────────┘
//
// The game label (#03) floats ABOVE the card as a tiny outside label,
// matching the reference exactly.  No gutter label per-row (no seed data yet).
// Cascading ✕: shown whenever isPicked AND team is in eliminatedTeams,
// even before THIS game has an actual_winner recorded.

import { Check }          from 'lucide-react'
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

  const teams = [
    { actual: effectiveTeam1.actual, predicted: effectiveTeam1.predicted, inAttr: 'data-in1' as const },
    { actual: effectiveTeam2.actual, predicted: effectiveTeam2.predicted, inAttr: 'data-in2' as const },
  ]

  return (
    // overflow:visible so the 0×0 anchor divs don't get clipped
    <div className="relative w-full" style={{ overflow: 'visible' }}>

      {/* ── Output connector anchor — 0×0, right edge, vertical center ─── */}
      <div
        data-out={game.id}
        className="absolute w-0 h-0 top-1/2"
        style={{ right: 0 }}
        aria-hidden
      />

      {/* ── Game number label — floats above the card, outside ────────── */}
      <div className="flex items-center gap-1 mb-[3px] px-[2px]">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
          #{String(gameNum).padStart(2, '0')}
        </span>
        <span className="text-[9px] text-slate-700 leading-none">·</span>
        <span className="text-[9px] text-slate-600 leading-none">{pointValue}pt</span>
      </div>

      {/* ── Card body — unified block, zero rounding ──────────────────── */}
      {/* bg-slate-800 acts as the 1px divider color between rows via gap-px */}
      <div className="flex flex-col gap-px bg-slate-800 border border-slate-700">
        {teams.map(({ actual, predicted, inAttr }, idx) => {
          const isTBD    = isTBDName(predicted)
          const isPicked = userPick?.predicted_winner === predicted

          // Winner: actual result confirmed this row advanced
          const isWinner = !!game.actual_winner && (
            game.actual_winner === actual || game.actual_winner === predicted
          )
          // Loser in THIS game
          const isConfirmedLoser = !!game.actual_winner && !isWinner
          // Eliminated in a PRIOR game (cascading X)
          const isEliminated = !isTBD && eliminatedTeams.has(actual)

          // Priority: win > wrong-pick (confirmed or cascading) > pending pick > default
          const showWin  = isWinner
          const showLoss = isPicked && (isConfirmedLoser || isEliminated)
          const showPick = isPicked && !showWin && !showLoss

          const canClick = !isTBD && !isLocked && !readOnly

          // ── Row-level colour decision ─────────────────────────────────
          // Winner:       thick emerald border, dark green fill
          // Pending pick: sky tint
          // Default/loss: near-black
          let rowBg   = 'bg-[#111827]'          // default — very dark blue-black
          let border  = ''                        // individual row override (winners)
          let textCls = isTBD
            ? 'text-slate-600 italic'
            : (isConfirmedLoser || isEliminated)
              ? 'text-slate-600'
              : 'text-slate-100'

          if (showWin) {
            rowBg   = 'bg-emerald-950/60'
            border  = 'ring-2 ring-inset ring-emerald-500 z-10 relative'
            textCls = 'text-emerald-300 font-black'
          } else if (showPick) {
            rowBg   = 'bg-sky-950/40'
            textCls = 'text-sky-200 font-bold'
          }

          return (
            <div key={inAttr} className={`${border}`}>
              {/* ── Input connector anchor — 0×0, left edge, row center ── */}
              <div
                {...{ [inAttr]: game.id }}
                className="absolute w-0 h-0 top-1/2 left-0"
                aria-hidden
              />

              {/* ── Team row ─────────────────────────────────────────── */}
              <div
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
                onClick={() => canClick && onPick(game, predicted)}
                onKeyDown={e => canClick && e.key === 'Enter' && onPick(game, predicted)}
                className={`
                  flex items-stretch h-9
                  ${rowBg}
                  ${canClick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                  transition-all duration-100
                `}
              >
                {/* Left gutter — dark sidebar with game index */}
                <div className={`
                  w-7 flex-shrink-0 flex flex-col items-center justify-center
                  border-r border-slate-700/80
                  ${showWin ? 'bg-emerald-950/80' : 'bg-slate-900/80'}
                `}>
                  <span className={`
                    text-[8px] font-black leading-none tabular-nums
                    ${showWin ? 'text-emerald-400' : 'text-slate-600'}
                  `}>
                    {idx + 1}
                  </span>
                </div>

                {/* Team name */}
                <div className="flex items-center flex-1 min-w-0 px-2">
                  <span className={`
                    text-[11px] font-black uppercase tracking-tighter truncate leading-none
                    ${textCls}
                  `}>
                    {isTBD ? '—' : predicted}
                  </span>
                </div>

                {/* Right indicator */}
                <div className="flex items-center justify-center w-7 flex-shrink-0 pr-1">
                  {showWin && (
                    <Check size={11} className="text-emerald-400" strokeWidth={3} />
                  )}
                  {showPick && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  )}
                  {showLoss && (
                    <span className="text-[10px] font-black text-rose-500 leading-none">✕</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}