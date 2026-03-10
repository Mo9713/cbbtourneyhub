// src/features/bracket/ui/BracketView/MatchupColumn.tsx

// Renders one bracket round as a flex column.
// Receives a pre-built SlotItem[] from BracketGrid that already includes
// 'ghost' entries for bye slots is what drives the geometric centering.

import { getRoundLabel, getScore }    from '../../../../shared/lib/helpers'
import GameCard                        from './GameCard'
import type { Game, Pick, Tournament } from '../../../../shared/types'
import type { EffectiveNames }         from '../../../../shared/lib/bracketMath'

// ── Slot type (exported so BracketGrid can build the grid) ────────────────────

export type SlotItem =
  | { type: 'game';  game: Game }
  | { type: 'ghost' }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  round:           number
  maxRound:        number
  slots:           SlotItem[]
  pickMap:         Map<string, Pick>
  effectiveNames:  EffectiveNames
  tournament:      Tournament
  gameNumbers:     Record<string, number>
  eliminatedTeams: Set<string>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchupColumn({
  round, maxRound, slots,
  pickMap, effectiveNames, tournament, gameNumbers, eliminatedTeams,
}: Props) {
  const label = tournament.round_names?.[round - 1] || getRoundLabel(round, maxRound)
  const pts   = tournament.scoring_config?.[String(round)] ?? getScore(round)

  return (
    <div className="flex flex-col h-full w-52 flex-shrink-0">

      {/* ── Fixed-height column header (h-12 = 48 px) ─────────────────── */}
      <div className="h-12 flex-shrink-0 flex flex-col items-center justify-center
                      border-b border-slate-700/50 mb-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
          {label}
        </span>
        <span className="text-[9px] text-slate-600 mt-0.5">
          {slots.filter(s => s.type === 'game').length} game
          {slots.filter(s => s.type === 'game').length !== 1 ? 's' : ''}
          {' · '}{pts}pt
        </span>
      </div>

      {/* ── Slots area — flex-1 fills the remaining column height ──────── */}
      <div className="flex flex-col flex-1 min-h-0">
        {slots.map((slot, i) => {
          if (slot.type === 'ghost') {
            // Ghost: invisible spacer that takes its fair share of the flex space.
            // No visible content — just maintains geometric proportions.
            return (
              <div key={`ghost-${i}`} className="flex-1 min-h-0" aria-hidden />
            )
          }

          const game = slot.game
          const eff  = effectiveNames[game.id] ?? {
            team1: { actual: game.team1_name, predicted: game.team1_name },
            team2: { actual: game.team2_name, predicted: game.team2_name },
          }

          return (
            // Each game slot stretches to its flex-1 share; the card itself is
            // vertically centered within that space via items-center.
            <div
              key={game.id}
              className="flex-1 flex items-center min-h-0 px-1"
            >
              <GameCard
                game={game}
                gameNum={gameNumbers[game.id] ?? 0}
                pointValue={pts}
                eliminatedTeams={eliminatedTeams}
                userPick={pickMap.get(game.id)}
                effectiveTeam1={eff.team1}
                effectiveTeam2={eff.team2}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}