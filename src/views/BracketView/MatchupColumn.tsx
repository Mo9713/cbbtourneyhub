// src/views/BracketView/MatchupColumn.tsx
import { useTheme }   from '../../utils/theme'
import { getRoundLabel } from '../../utils/helpers'
import GameCard          from '../../components/GameCard'
import type { Game, Pick, Tournament } from '../../types'

interface Props {
  round:         number
  games:         Game[]
  maxRound:      number
  picks:         Pick[]
  effectiveNames: Record<string, { team1: string; team2: string }>
  tournament:    Tournament
  isLocked:      boolean
  readOnly:      boolean
  ownerName?:    string
  onPick:        (game: Game, team: string) => void
}

export default function MatchupColumn({
  round, games, maxRound, picks, effectiveNames,
  tournament, isLocked, readOnly, ownerName, onPick,
}: Props) {
  const theme     = useTheme()
  const pickMap   = new Map(picks.map(p => [p.game_id, p]))
  const label     = tournament.round_names?.[round - 1] || getRoundLabel(round, maxRound)

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">

      {/* Round label */}
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-lg ${theme.bg} ${theme.accent}`}>
        {label}
      </div>

      {/* Game cards — top-aligned, no spacer gymnastics */}
      <div className="flex flex-col gap-4">
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            userPick={pickMap.get(game.id)}
            effectiveTeam1={effectiveNames[game.id]?.team1 ?? game.team1_name}
            effectiveTeam2={effectiveNames[game.id]?.team2 ?? game.team2_name}
            isLocked={isLocked}
            onPick={onPick}
            readOnly={readOnly}
            ownerName={ownerName}
          />
        ))}
      </div>

    </div>
  )
}
