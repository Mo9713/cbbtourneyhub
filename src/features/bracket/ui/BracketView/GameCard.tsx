// src/features/bracket/ui/BracketView/GameCard.tsx
//
// Purely presentational. No async calls.
//
// ── Fixes in this version ────────────────────────────────────────────────────
// Fix 2: data-in1/in2 are 0×0 absolute divs at left-0 top-1/2 of each row
//        (was spread on the full-width row div — SVG lines hit card center).
// Fix 3: isDeadPick no longer requires isPicked. Any slot whose effective
//        `predicted` name is in eliminatedTeams shows ✕ across all rounds.
// Fix 6: Seed span inherits the same color as the team name (winner/dead/default).
// Fix 7: Card border glows emerald when game has a winner. ✓ appears when
//        isWinner && isPicked (mirrors ✕ dead-pick pattern on the right side).

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

  // ── Card-level winner states ──────────────────────────────────────────────
  const hasWinner = !!game.actual_winner

  // Fix 7: emerald glow on the whole card when a winner is confirmed
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

      {/* ── Output anchor — 0×0 at right edge center (unchanged) ─────── */}
      <div
        data-out={game.id}
        className="absolute w-0 h-0 top-1/2"
        style={{ right: 0 }}
        aria-hidden
      />

      {/* ── Floating game number ─────────────────────────────────────── */}
      <div className="absolute -top-4 left-0 flex items-center gap-1">
        <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-none">
          #{String(gameNum).padStart(2, '0')}
        </span>
        <span className="text-[9px] text-slate-700 leading-none">·</span>
        <span className="text-[9px] text-slate-600 leading-none">{pointValue}pt</span>
      </div>

      {/* ── Card body ────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col w-full bg-[#11141d] border rounded-none ${cardBorderCls}`}
        style={cardShadowStyle}
      >
        {rows.map(({ actual, predicted, seed, score, inKey }, idx) => {
          const isTBD = isTBDName(predicted)

          // Winner: this team actually won this game
          const isWinner = hasWinner && (
            game.actual_winner === actual || game.actual_winner === predicted
          )

          // isPicked: user has an explicit pick for this game AND it's this team
          const isPicked = userPick?.predicted_winner === predicted

          // Fix 3: dead pick — any slot whose predicted team is eliminated shows ✕.
          // No isPicked gate: covers every round via effectiveNames propagation,
          // even when the user didn't make an explicit pick for later rounds.
          const isDeadPick = !isWinner && !isTBD && eliminatedTeams.has(predicted)

          // ── Name color ────────────────────────────────────────────────
          let nameClass: string
          if (isWinner) {
            nameClass = 'text-emerald-400 font-black'
          } else if (isDeadPick) {
            nameClass = 'line-through text-rose-600 decoration-rose-600 decoration-2'
          } else if (isTBD) {
            nameClass = 'text-slate-600 italic'
          } else {
            nameClass = 'text-slate-200'
          }

          // Fix 6: seed inherits same color + strikethrough as the team name
          const seedColorCls = isWinner
            ? 'text-emerald-400'
            : isDeadPick
              ? 'text-rose-600 line-through decoration-rose-600 decoration-2'
              : 'text-slate-500'

          const scoreCls = isWinner ? 'text-emerald-400 font-black' : 'text-slate-400'
          const rowBg    = isWinner ? 'bg-[#022c22]' : ''
          const canPick  = !isTBD && !isLocked && !readOnly

          return (
            <div
              key={idx}
              // Fix 2: row must be `relative` so the 0×0 anchor can be absolute inside it
              className={`
                relative flex items-center justify-between h-8 px-2
                border-b border-[#2a303c] last:border-b-0
                ${rowBg}
                ${canPick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                transition-colors duration-75
              `}
              onClick={() => canPick && onPick(game, predicted)}
            >
              {/* Fix 2: 0×0 input anchor strictly at the card's left border */}
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
                {/* Fix 7: ✓ when user correctly picked this winner */}
                {isWinner && isPicked && (
                  <span className="text-[10px] font-black text-emerald-400 leading-none">✓</span>
                )}
                {/* ✕ for any eliminated team in the predicted chain */}
                {isDeadPick && (
                  <span className="text-[10px] font-black text-rose-600 leading-none">✕</span>
                )}
                {/* Sky dot for active non-winning pick */}
                {isPicked && !isWinner && !isDeadPick && (
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