// src/views/BracketView/BracketGrid.tsx
import MatchupColumn from './MatchupColumn'
import type { Game, Pick, Tournament } from '../../types'

interface Props {
  rounds:         [number, Game[]][]
  pickMap:        Map<string, Pick>
  effectiveNames: Record<string, { team1: string; team2: string }>
  tournament:     Tournament
}

export default function BracketGrid({ rounds, pickMap, effectiveNames, tournament }: Props) {
  const maxRound = rounds.length > 0 ? Math.max(...rounds.map(([r]) => r)) : 1

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-start gap-6 w-max min-h-full">
        {rounds.map(([round, games]) => (
          <MatchupColumn
            key={round}
            round={round}
            games={games}
            maxRound={maxRound}
            pickMap={pickMap}
            effectiveNames={effectiveNames}
            tournament={tournament}
          />
        ))}
      </div>
    </div>
  )
}