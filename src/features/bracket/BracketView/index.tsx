// src/features/bracket/BracketView/index.tsx
import { useState, useMemo }       from 'react'
import { useTheme }                 from '../../../shared/utils/theme'
import { isPicksLocked }            from '../../../shared/utils/time'
import { BD_REGIONS }               from '../../../shared/utils/helpers'
import { deriveEffectiveNames, deriveChampion } from '../../../shared/utils/bracketMath'
import { useAuthContext }           from '../../auth'
import { useTournamentContext }     from '../../tournament'
import { useBracketContext }         from '..'
import { BracketViewProvider }      from '../BracketViewContext'
import { useMyPicks, useMakePick }  from '../queries'
import { buildPickMap, sortedRounds, getChampGame } from '../selectors'
import BracketHeader                from './BracketHeader'
import BracketGrid                  from './BracketGrid'
import ChampionCallout              from './ChampionCallout'
import TiebreakerPanel              from './TiebreakerPanel'
import type { Game, Pick, Tournament } from '../../../shared/types'


interface BracketViewProps {
  readOnly?:           boolean
  ownerName?:          string
  overridePicks?:      Pick[]
  overrideTournament?: Tournament
  overrideGames?:      Game[]
}

export default function BracketView({
  readOnly          = false,
  ownerName,
  overridePicks,
  overrideTournament,
  overrideGames,
}: BracketViewProps) {
  const theme = useTheme()

  const { profile }                        = useAuthContext()
  const { selectedTournament, gamesCache } = useTournamentContext()
  const { saveTiebreaker }                 = useBracketContext()

  const tournament = overrideTournament ?? selectedTournament
  const games      = overrideGames ?? (tournament ? (gamesCache[tournament.id] ?? []) : [])

  // Picks — from TanStack cache or override (snoop.read-only mode)
  const { data: queryPicks = [] } = useMyPicks(tournament?.id ?? null, games)
  const picks                     = overridePicks ?? queryPicks

  const { mutateAsync: makePick } = useMakePick()

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  if (!tournament || !profile) return null

  const isLocked   = isPicksLocked(tournament, profile.is_admin) || tournament.status === 'draft'
  const isBigDance = games.some(g => g.region)

  // ── Selectors computed once at the boundary ───────────────
  const pickMap      = useMemo(() => buildPickMap(picks),                               [picks])
  const rounds       = useMemo(() => sortedRounds(games, isBigDance ? selectedRegion : null), [games, isBigDance, selectedRegion])
  const effectiveNames = useMemo(() => deriveEffectiveNames(games, picks),              [games, picks])
  const champion     = useMemo(() => deriveChampion(games, picks, effectiveNames),      [games, picks, effectiveNames])
  const champGame    = useMemo(() => getChampGame(games),                               [games])
  const champPick    = champGame ? picks.find(p => p.game_id === champGame.id) ?? null : null

  const handlePick = async (game: Game, team: string) => {
    if (readOnly || isLocked) return
    const existingPick = pickMap.get(game.id)
    await makePick({ game, team, tournamentId: tournament.id, games, existingPick })
  }

  const handleTiebreaker = async (gameId: string, predictedWinner: string, score: number) => {
    return saveTiebreaker(gameId, predictedWinner, score)
  }

  return (
    <BracketViewProvider
      isLocked={isLocked || readOnly}
      readOnly={readOnly}
      ownerName={ownerName}
      onPick={handlePick}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <BracketHeader
          tournament={tournament}
          pickedCount={picks.length}
          totalGames={games.length}
          readOnly={readOnly}
          ownerName={ownerName}
        />

        {isBigDance && (
          <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => setSelectedRegion(null)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${!selectedRegion ? `${theme.accent} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'}`}
            >
              All
            </button>
            {BD_REGIONS.map(r => (
              <button
                key={r}
                onClick={() => setSelectedRegion(r)}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                  ${selectedRegion === r ? `${theme.accent} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <BracketGrid
          rounds={rounds}
          pickMap={pickMap}
          effectiveNames={effectiveNames}
          tournament={tournament}
        />

        {!readOnly && tournament.requires_tiebreaker && champGame && champPick && (
          <TiebreakerPanel
            champGame={champGame}
            champPick={champPick}
            isLocked={isLocked}
            onSave={handleTiebreaker}
          />
        )}

        <ChampionCallout
          champion={champion}
          readOnly={readOnly}
          ownerName={ownerName}
        />
      </div>
    </BracketViewProvider>
  )
}


