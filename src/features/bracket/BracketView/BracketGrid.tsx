// src/features/bracket/BracketView/BracketGrid.tsx
import MatchupColumn from './MatchupColumn'
import ChampionCallout from './ChampionCallout'
import { useTheme } from '../../../shared/utils/theme'
import type { Game, Pick, Tournament } from '../../../shared/types'
import type { EffectiveNames } from '../../../shared/utils/bracketMath'

interface Props {
  rounds:          [number, Game[]][]
  pickMap:         Map<string, Pick>
  effectiveNames:  EffectiveNames
  tournament:      Tournament
  gameNumbers:     Record<string, number>
  eliminatedTeams: Set<string>
  champion:        string | null
  readOnly:        boolean
  ownerName?:      string
}

export default function BracketGrid({ 
  rounds, pickMap, effectiveNames, tournament, gameNumbers, eliminatedTeams, champion, readOnly, ownerName
}: Props) {
  const theme = useTheme()
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
            gameNumbers={gameNumbers}
            eliminatedTeams={eliminatedTeams}
          />
        ))}

        {/* Inline Champion Node */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0 w-52">
          <div className="text-center pb-3 border-b border-slate-800/80 mb-2 w-full">
            <h3 className={`font-display text-sm font-bold uppercase tracking-widest ${theme.accent}`}>
              Champion
            </h3>
            <span className="text-[10px] text-transparent select-none">.</span>
          </div>
          <div className="flex flex-col gap-4 w-full h-full">
            <ChampionCallout champion={champion} readOnly={readOnly} ownerName={ownerName} />
          </div>
        </div>

      </div>
    </div>
  )
}