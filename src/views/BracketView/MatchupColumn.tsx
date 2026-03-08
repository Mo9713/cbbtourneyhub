// src/views/BracketView/MatchupColumn.tsx
import { useTheme }          from '../../utils/theme'
import { getRoundLabel, getScore }     from '../../utils/helpers'
import GameCard              from '../../components/GameCard'
import type { Game, Pick, Tournament } from '../../types'

interface Props {
  round:          number
  games:          Game[]
  maxRound:       number
  picks:          Pick[]
  effectiveNames: Record<string, { team1: string; team2: string }>
  tournament:     Tournament
}

export default function MatchupColumn({
  round, games, maxRound, picks, effectiveNames, tournament,
}: Props) {
  const theme   = useTheme()
  const pickMap = new Map(picks.map(p => [p.game_id, p]))
  const label   = tournament.round_names?.[round - 1] || getRoundLabel(round, maxRound)

  // Strictly uses the imported helper or the live database config
  const pts = tournament.scoring_config?.[String(round)] ?? getScore(round)

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
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            userPick={pickMap.get(game.id)}
            effectiveTeam1={effectiveNames[game.id]?.team1 ?? game.team1_name}
            effectiveTeam2={effectiveNames[game.id]?.team2 ?? game.team2_name}
          />
        ))}
      </div>
    </div>
  )
}