// src/features/bracket/ui/BracketView/MatchupColumn.tsx
//
// Renders one bracket round as a flex column.
// Header height is driven by the inline style (matching BracketGrid's HEADER_H=80px)
// so the round label never bleeds into game cards regardless of bracket size.
//
// Slot layout:
//   • Header  — fixed 80px, flex-shrink-0
//   • Slots   — flex-1, subdivided into equal flex-1 chunks (games + ghosts)
//   • Ghosts  — invisible flex-1 spacers that hold geometric proportions

import { getRoundLabel, getScore }    from '../../../../shared/lib/helpers'
import GameCard                        from './GameCard'
import type { Game, Pick, Tournament } from '../../../../shared/types'
import type { EffectiveNames }         from '../../../../shared/lib/bracketMath'

// ── Slot type ─────────────────────────────────────────────────────────────────

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

// Mirrors BracketGrid constant — keep in sync if BracketGrid changes HEADER_H.
const HEADER_H = 80   // px

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchupColumn({
  round, maxRound, slots,
  pickMap, effectiveNames, tournament, gameNumbers, eliminatedTeams,
}: Props) {
  const label    = tournament.round_names?.[round - 1] || getRoundLabel(round, maxRound)
  const pts      = tournament.scoring_config?.[String(round)] ?? getScore(round)
  const gameCount = slots.filter(s => s.type === 'game').length

  return (
    <div className="flex flex-col h-full w-52 flex-shrink-0">

      {/* ── Column header — hard 80px ceiling ────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col items-start justify-end pb-2 px-1 border-b border-slate-700/60"
        style={{ height: HEADER_H }}
      >
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-200 leading-tight">
          {label}
        </span>
        <span className="text-[9px] text-slate-600 mt-0.5 leading-none">
          {gameCount} game{gameCount !== 1 ? 's' : ''} · {pts}pt
        </span>
      </div>

      {/* ── Slots area ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">
        {slots.map((slot, i) => {
          if (slot.type === 'ghost') {
            // Invisible spacer — holds its share of flex height, no visual output
            return <div key={`ghost-${i}`} className="flex-1 min-h-0" aria-hidden />
          }

          const game = slot.game
          const eff  = effectiveNames[game.id] ?? {
            team1: { actual: game.team1_name, predicted: game.team1_name },
            team2: { actual: game.team2_name, predicted: game.team2_name },
          }

          return (
            // flex-1: game slot takes its equal share; card centered vertically inside
            <div key={game.id} className="flex-1 flex items-center min-h-0 px-1">
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