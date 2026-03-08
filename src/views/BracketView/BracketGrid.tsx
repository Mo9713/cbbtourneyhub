// src/views/BracketView/BracketGrid.tsx
import MatchupColumn from './MatchupColumn'
import type { Game, Pick, Tournament } from '../../types'

interface Props {
  rounds:         [number, Game[]][]
  picks:          Pick[]
  effectiveNames: Record<string, { team1: string; team2: string }>
  tournament:     Tournament
  isLocked:       boolean
  readOnly:       boolean
  ownerName?:     string
  onPick:         (game: Game, team: string) => void
}

export default function BracketGrid({
  rounds, picks, effectiveNames,
  tournament, isLocked, readOnly, ownerName, onPick,
}: Props) {
  const maxRound = rounds.length > 0 ? Math.max(...rounds.map(([r]) => r)) : 1

  return (
    // Outer: fills remaining vertical space and scrolls horizontally
    // Inner: flex-row keeps the top-aligned column layout intact
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-start gap-6 w-max min-h-full">
        {rounds.map(([round, games]) => (
          <MatchupColumn
            key={round}
            round={round}
            games={games}
            maxRound={maxRound}
            picks={picks}
            effectiveNames={effectiveNames}
            tournament={tournament}
            isLocked={isLocked}
            readOnly={readOnly}
            ownerName={ownerName}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  )
}
