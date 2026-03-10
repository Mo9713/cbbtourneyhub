// src/features/bracket/BracketView/MatchupColumn.tsx
import { useTheme }              from '../../../shared/utils/theme'
import { getRoundLabel, getScore } from '../../../shared/utils/helpers'
import GameCard                  from '../GameCard'
import type { Game, Pick, Tournament } from '../../../shared/types'
import type { EffectiveNames }     from '../../../shared/utils/bracketMath'

interface Props {
  round:           number
  games:           Game[]
  maxRound:        number
  pickMap:         Map<string, Pick>
  effectiveNames:  EffectiveNames
  tournament:      Tournament
  gameNumbers:     Record<string, number>
  eliminatedTeams: Set<string>
}

export default function MatchupColumn({
  round, games, maxRound, pickMap, effectiveNames, tournament, gameNumbers, eliminatedTeams
}: Props) {
  const theme = useTheme()
  const label = tournament.round_names?.[round - 1] || getRoundLabel(round, maxRound)
  const pts   = tournament.scoring_config?.[String(round)] ?? getScore(round)

  return (
    <div className="flex flex-col items-center gap-3 flex-shrink-0 w-52">
      <div className="text-center pb-3 border-b border-slate-800/80 mb-2 w-full">
        <h3 className={`font-display text-sm font-bold uppercase tracking-widest ${theme.accent}`}>
          {label}
        </h3>
        <span className="text-[10px] text-slate-500">
          {games.length} game{games.length !== 1 ? 's' : ''} · {pts}pt
        </span>
      </div>

      <div className="flex flex-col gap-4 w-full">
        {games.map(game => {
          const eff = effectiveNames[game.id] || {
            team1: { actual: game.team1_name, predicted: game.team1_name },
            team2: { actual: game.team2_name, predicted: game.team2_name }
          }

          return (
            <GameCard
              key={game.id}
              game={game}
              gameNum={gameNumbers[game.id]}
              eliminatedTeams={eliminatedTeams}
              userPick={pickMap.get(game.id)}
              effectiveTeam1={eff.team1}
              effectiveTeam2={eff.team2}
            />
          )
        })}
      </div>
    </div>
  )
}