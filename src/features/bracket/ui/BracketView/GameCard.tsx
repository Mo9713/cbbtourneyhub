// src/features/bracket/ui/BracketView/GameCard.tsx
//
// Purely presentational. No async calls.
//
// ── Visual state matrix for team rows ────────────────────────────────────────
//
//  WINNER (not picked) : bg-[#022c22]  ring-2 ring-inset ring-emerald-500
//                        text-emerald-400 font-black
//
//  WINNER (user picked): same bg + ring PLUS ✓ on the far right
//
//  ELIMINATED (picked) : line-through text-rose-600 decoration-rose-600 decoration-2
//                        ✕ on the far right
//
//  ELIMINATED (not picked): text-slate-600 font-normal  ← fade only, NO strikethrough
//
//  PENDING (picked)    : text-sky-300 font-bold  +  sky blue dot on the far right
//
//  DEFAULT             : text-slate-200
//
// ── Connector anchors ────────────────────────────────────────────────────────
//  data-in1/data-in2 → 0×0 absolute left-0 top-1/2 inside each row.
//  data-out          → 0×0 absolute right-0 top-1/2 on the card wrapper.
//  Do not move these — the SVG measurement system depends on them.

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

  // Card-level: subtle emerald glow when game has a confirmed result
  const cardBorderCls   = hasWinner ? 'border-emerald-900/50' : 'border-[#2a303c]'
  const cardShadowStyle = hasWinner
    ? { boxShadow: '0 0 14px 2px rgba(6, 78, 59, 0.35)' }
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

      {/* ── Output anchor ── */}
      <div
        data-out={game.id}
        className="absolute w-0 h-0 top-1/2"
        style={{ right: 0 }}
        aria-hidden
      />

      {/* ── Floating game number ── */}
      <div className="absolute -top-4 left-0 flex items-center gap-1">
        <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-none">
          #{String(gameNum).padStart(2, '0')}
        </span>
        <span className="text-[9px] text-slate-700 leading-none">·</span>
        <span className="text-[9px] text-slate-600 leading-none">{pointValue}pt</span>
      </div>

      {/* ── Card body ── */}
      <div
        className={`flex flex-col w-full bg-[#11141d] border rounded-none ${cardBorderCls}`}
        style={cardShadowStyle}
      >
        {rows.map(({ actual, predicted, seed, score, inKey }, idx) => {
          const isTBD = isTBDName(predicted)

          // ── State derivation ────────────────────────────────────────────
          const isWinner     = hasWinner && !isTBD && (
            game.actual_winner === actual || game.actual_winner === predicted
          )
          const isPicked     = !isTBD && userPick?.predicted_winner === predicted
          const isEliminated = !isTBD && !isWinner && eliminatedTeams.has(predicted)

          // ── Row background + ring (winner only) ─────────────────────────
          const rowBg      = isWinner ? 'bg-[#022c22]'                  : ''
          const rowRingCls = isWinner ? 'ring-2 ring-inset ring-emerald-500 z-10' : ''

          // ── Name text class (exact 6-state matrix) ──────────────────────
          let nameClass: string
          let seedColorCls: string

          if (isWinner) {
            nameClass    = 'text-emerald-400 font-black'
            seedColorCls = 'text-emerald-400'
          } else if (isEliminated && isPicked) {
            // Picked AND lost → strikethrough rose
            nameClass    = 'line-through text-rose-600 decoration-rose-600 decoration-2'
            seedColorCls = 'text-rose-600 line-through decoration-rose-600 decoration-2'
          } else if (isEliminated && !isPicked) {
            // Lost but user didn't pick them → quiet fade, no decoration
            nameClass    = 'text-slate-600 font-normal'
            seedColorCls = 'text-slate-700'
          } else if (!hasWinner && isPicked) {
            // Active pick on a game not yet played → sky highlight
            nameClass    = 'text-sky-300 font-bold'
            seedColorCls = 'text-sky-400'
          } else if (isTBD) {
            nameClass    = 'text-slate-600 italic'
            seedColorCls = 'text-slate-700'
          } else {
            nameClass    = 'text-slate-200'
            seedColorCls = 'text-slate-500'
          }

          const scoreCls = isWinner ? 'text-emerald-400 font-black' : 'text-slate-400'
          const canPick  = !isTBD && !isLocked && !readOnly

          return (
            <div
              key={idx}
              className={`
                relative flex items-center justify-between h-8 px-2
                border-b border-[#2a303c] last:border-b-0
                ${rowBg} ${rowRingCls}
                ${canPick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                transition-colors duration-75
              `}
              onClick={() => canPick && onPick(game, predicted)}
            >
              {/* Input anchor — strictly at left-0 of row */}
              <div
                {...{ [inKey]: game.id }}
                className="absolute left-0 top-1/2 w-0 h-0"
                aria-hidden
              />

              {/* ── Seed badge ── */}
              {seed != null ? (
                <span className={`w-3.5 text-[9px] font-bold text-right mr-1.5 flex-shrink-0 tabular-nums ${seedColorCls}`}>
                  {seed}
                </span>
              ) : (
                <span className="w-3.5 mr-1.5 flex-shrink-0" aria-hidden />
              )}

              {/* ── Team name ── */}
              <span className={`flex-1 text-[11px] font-black uppercase tracking-tight truncate leading-none ${nameClass}`}>
                {isTBD ? '—' : predicted}
              </span>

              {/* ── Score ── */}
              {score != null && (
                <span className={`text-[11px] font-bold ml-2 flex-shrink-0 tabular-nums ${scoreCls}`}>
                  {score}
                </span>
              )}

              {/* ── Right indicator ── */}
              <div className="flex items-center justify-center w-5 flex-shrink-0">
                {/* WINNER + PICKED → emerald checkmark */}
                {isWinner && isPicked && (
                  <span className="text-[10px] font-black text-emerald-400 leading-none">✓</span>
                )}
                {/* ELIMINATED + PICKED → red ✕ */}
                {isEliminated && isPicked && (
                  <span className="text-[10px] font-black text-rose-600 leading-none">✕</span>
                )}
                {/* PENDING + PICKED → sky dot */}
                {!hasWinner && isPicked && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}