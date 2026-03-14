// src/widgets/tournament-bracket/ui/BracketView/MatchupColumn.tsx
//
// C-03 FIX: allTournamentPicks is now read from BracketViewContext and
// passed to getIsEliminated. This enables the revive_all elimination
// rule to evaluate whether a mass-elimination event has occurred by
// checking all participants' picks, not just the current user's.
// allTournamentPicks is undefined for standard brackets and readOnly
// contexts; getIsEliminated handles the undefined case by falling back
// to current-user-only evaluation (pre-existing behavior).

import { useMemo }                        from 'react'
import { getRoundLabel, getScore }        from '../../../../shared/lib/helpers'
import { getActiveSurvivorRound }         from '../../../../shared/lib/time'
import { useTheme }                       from '../../../../shared/lib/theme'
import { useBracketView }                 from './BracketViewContext'
import GameCard                           from './GameCard'
import { SurvivorGameCard, getUsedTeams, getIsEliminated } from '../../../../features/survivor'
import type { Game, Pick, Tournament }    from '../../../../shared/types'
import type { EffectiveNames }            from '../../../../shared/lib/bracketMath'

export type SlotItem =
  | { type: 'game';  game: Game }
  | { type: 'ghost' }

interface Props {
  round:           number
  maxRound:        number
  slots:           SlotItem[]
  pickMap:         Map<string, Pick>
  effectiveNames:  EffectiveNames
  tournament:      Tournament
  gameNumbers:     Record<string, number>
  eliminatedTeams: Set<string>
  allGames:        Game[]
}

const HEADER_H = 80  // px

export default function MatchupColumn({
  round, maxRound, slots,
  pickMap, effectiveNames, tournament, gameNumbers, eliminatedTeams, allGames,
}: Props) {
  const theme = useTheme()

  const { onSurvivorPick, allTournamentPicks } = useBracketView()

  const label     = tournament.round_names?.[round - 1] || getRoundLabel(round, maxRound)
  const pts       = tournament.scoring_config?.[String(round)] ?? getScore(round)
  const gameCount = slots.filter(s => s.type === 'game').length

  const isSurvivor  = !!onSurvivorPick
  const activeRound = isSurvivor ? getActiveSurvivorRound(tournament) : 0

  const userPicks = useMemo(() => Array.from(pickMap.values()), [pickMap])
  const usedTeams = useMemo(() => isSurvivor ? getUsedTeams(userPicks) : [], [isSurvivor, userPicks])

  // C-03 FIX: allTournamentPicks from context (all participants' picks)
  // is passed alongside the user's picks. getIsEliminated uses this to
  // evaluate the revive_all rule. For undefined allTournamentPicks
  // (standard brackets, snoop readOnly), the function falls back to
  // user-picks-only behavior, which is correct in those contexts.
  const isEliminated = useMemo(() => {
    if (!isSurvivor) return false
    return getIsEliminated(
      userPicks,
      allGames,
      allTournamentPicks ?? userPicks,
      tournament,
    )
  }, [isSurvivor, userPicks, allGames, allTournamentPicks, tournament])

  return (
    <div className="flex flex-col h-full w-52 flex-shrink-0 relative z-10">
      <div
        className={`flex-shrink-0 flex flex-col items-start justify-end pb-2 px-1 border-b ${theme.borderBase}`}
        style={{ height: HEADER_H }}
      >
        <span className={`text-[11px] font-black uppercase tracking-widest leading-tight ${theme.textBase}`}>
          {label}
        </span>
        <span className={`text-[9px] mt-0.5 leading-none ${theme.textMuted}`}>
          {gameCount} game{gameCount !== 1 ? 's' : ''} · {isSurvivor ? '1 pick' : `${pts}pt`}
        </span>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {slots.map((slot, i) => {
          if (slot.type === 'ghost') {
            return <div key={`ghost-${i}`} className="flex-1 min-h-0" aria-hidden />
          }

          const game = slot.game
          const eff  = effectiveNames[game.id] ?? {
            team1: { actual: game.team1_name, predicted: game.team1_name },
            team2: { actual: game.team2_name, predicted: game.team2_name },
          }

          return (
            <div key={game.id} className="flex-1 flex items-center min-h-0 px-1 pt-5 relative">
              {isSurvivor && onSurvivorPick ? (
                <SurvivorGameCard
                  game={game}
                  currentPick={pickMap.get(game.id)}
                  usedTeams={usedTeams}
                  activeRound={activeRound}
                  isEliminated={isEliminated}
                  onMakePick={onSurvivorPick}
                />
              ) : (
                <GameCard
                  game={game}
                  gameNum={gameNumbers[game.id] ?? 0}
                  pointValue={pts}
                  eliminatedTeams={eliminatedTeams}
                  userPick={pickMap.get(game.id)}
                  effectiveTeam1={eff.team1}
                  effectiveTeam2={eff.team2}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}