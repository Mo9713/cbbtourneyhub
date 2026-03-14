// src/widgets/tournament-bracket/ui/BracketView/index.tsx

import { useState, useMemo, useCallback }      from 'react'
import { useTheme }                            from '../../../../shared/lib/theme'
import { isPicksLocked }                       from '../../../../shared/lib/time'
import { BD_REGIONS }                          from '../../../../shared/lib/helpers'
import {
  deriveEffectiveNames,
  deriveChampion,
  deriveEliminatedTeams,
  calculateLocalScore,
  computeGameNumbers,
  type EffectiveNames,
}                                              from '../../../../shared/lib/bracketMath'
import { useAuth }                             from '../../../../features/auth'
import { useUIStore }                          from '../../../../shared/store/uiStore'
import { BracketViewProvider }                 from './BracketViewContext'
import { useMyPicks, useMakePick, useSaveTiebreaker } from '../../../../entities/pick/model/queries'
import { buildPickMap, sortedRounds, getChampGame }   from '../../../../features/bracket/model/selectors'
import { useGames, useTournamentListQuery }    from '../../../../entities/tournament/model/queries'
import { useMakeSurvivorPickMutation }         from '../../../../features/survivor'
import BracketHeader                           from './BracketHeader'
import BracketGrid                             from './BracketGrid'
import TiebreakerPanel                         from './TiebreakerPanel'
import LeaderboardView                         from '../../../leaderboard/ui/LeaderboardView'
import type { Game, Pick, Tournament }         from '../../../../shared/types'

export interface BracketViewProps {
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

  const { profile }                = useAuth()
  const { data: tournaments = [] } = useTournamentListQuery()
  const selectedTournamentId       = useUIStore((s) => s.selectedTournamentId)

  const [viewMode, setViewMode] = useState<'bracket' | 'standings'>('bracket')

  const selectedTournament = useMemo(
    () => tournaments.find((t: Tournament) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  )

  const tournament = overrideTournament ?? selectedTournament

  const { data: queriedGames = [] } = useGames(
    overrideGames ? null : (tournament?.id ?? null),
  )
  const games = overrideGames ?? queriedGames

  const { data: queryPicks = [] } = useMyPicks(tournament?.id ?? null, games)
  const picks                     = overridePicks ?? queryPicks

  const { mutateAsync: makePick }       = useMakePick()
  const { mutateAsync: saveTiebreaker } = useSaveTiebreaker()
  const { mutate: makeSurvivorPick }    = useMakeSurvivorPickMutation()

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const isLocked = tournament && profile
    ? isPicksLocked(tournament, profile.is_admin)
        || tournament.status === 'draft'
        || tournament.status === 'locked'
    : false

  const isSurvivor = tournament?.game_type === 'survivor'
  const isBigDance = useMemo(() => games.some((g: Game) => g.region), [games])

  const pickMap         = useMemo(() => buildPickMap(picks),                                         [picks])
  const rounds          = useMemo(() => sortedRounds(games, isBigDance ? selectedRegion : null),     [games, isBigDance, selectedRegion])
  const effectiveNames  = useMemo<EffectiveNames>(() => deriveEffectiveNames(games, picks),          [games, picks])
  const champion        = useMemo(() => deriveChampion(games, picks, effectiveNames),                [games, picks, effectiveNames])
  const champGame       = useMemo(() => getChampGame(games),                                         [games])
  const gameNumbers     = useMemo(() => computeGameNumbers(games),                                   [games])
  const eliminatedTeams = useMemo(() => deriveEliminatedTeams(games, effectiveNames),                [games, effectiveNames])

  const score = useMemo(() => {
    if (!tournament) return { current: 0, max: 0 }
    return calculateLocalScore(games, picks, effectiveNames, tournament)
  }, [games, picks, effectiveNames, tournament])

  const champPick = useMemo(
    () => (champGame ? (picks.find((p: Pick) => p.game_id === champGame.id) ?? null) : null),
    [champGame, picks],
  )

  const gameIds = useMemo(() => games.map((g: Game) => g.id), [games])

  const handlePick = useCallback(async (game: Game, team: string) => {
    if (!tournament || readOnly || isLocked) return
    const existingPick = pickMap.get(game.id)
    await makePick({ game, team, tournamentId: tournament.id, games, existingPick })
  }, [tournament, readOnly, isLocked, pickMap, makePick, games])

  const handleSurvivorPick = useCallback((
    gameId: string, teamName: string | null, roundNum: number,
  ) => {
    if (!tournament || readOnly || isLocked) return
    makeSurvivorPick({ tournamentId: tournament.id, gameId, predictedWinner: teamName, roundNum, gameIds })
  }, [tournament, readOnly, isLocked, makeSurvivorPick, gameIds])

  const handleTiebreaker = useCallback(async (
    gameId: string, predictedWinner: string, score: number,
  ): Promise<string | null> => {
    if (!tournament) return 'No active tournament'
    try {
      // FIX: Claude's TS contract requires gameIds to be passed here for the exact cache key!
      await saveTiebreaker({ gameId, predictedWinner, score, tournamentId: tournament.id, gameIds })
      return null
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Failed to save tiebreaker'
    }
  }, [saveTiebreaker, tournament, gameIds])

  const bracketViewValue = useMemo(() => ({
    isLocked:       isLocked || readOnly,
    readOnly,
    ownerName,
    onPick:         handlePick,
    onSurvivorPick: isSurvivor ? handleSurvivorPick : undefined,
  }), [isLocked, readOnly, ownerName, handlePick, isSurvivor, handleSurvivorPick])

  if (!tournament || !profile) return null

  return (
    <BracketViewProvider {...bracketViewValue}>
      <div className="flex flex-col h-full overflow-hidden">
        <BracketHeader
          tournament={tournament}
          pickedCount={picks.length}
          totalGames={games.length}
          readOnly={readOnly}
          ownerName={ownerName}
          score={score}
        />

        {!readOnly && (
          <div className={`flex justify-center border-b ${theme.borderBase} bg-black/10 flex-shrink-0 pt-2`}>
            <div className="flex gap-2 px-4 mb-2">
              <button
                onClick={() => setViewMode('bracket')}
                className={`px-6 py-1.5 rounded-lg font-bold text-sm transition-all ${
                  viewMode === 'bracket' ? `${theme.bg} ${theme.border} ${theme.accentB} shadow-sm` : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                My Bracket
              </button>
              <button
                onClick={() => setViewMode('standings')}
                className={`px-6 py-1.5 rounded-lg font-bold text-sm transition-all ${
                  viewMode === 'standings' ? `${theme.bg} ${theme.border} ${theme.accentB} shadow-sm` : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Standings
              </button>
            </div>
          </div>
        )}

        {viewMode === 'bracket' ? (
          <>
            {isBigDance && (
              <div className={`flex gap-1 px-4 pt-2 pb-0 border-b ${theme.borderBase} flex-shrink-0 overflow-x-auto`}>
                <button
                  onClick={() => setSelectedRegion(null)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                    ${!selectedRegion
                      ? `${theme.accent} border-current`
                      : `${theme.textMuted} border-transparent hover:${theme.textBase}`
                    }`}
                >
                  All
                </button>
                {BD_REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRegion(r)}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                      ${selectedRegion === r
                        ? `${theme.accent} border-current`
                        : `${theme.textMuted} border-transparent hover:${theme.textBase}`
                      }`}
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
              gameNumbers={gameNumbers}
              eliminatedTeams={eliminatedTeams}
              champion={champion}
              readOnly={readOnly}
              ownerName={ownerName}
            />

            {!readOnly && tournament.requires_tiebreaker && champGame && champPick && (
              <TiebreakerPanel
                champGame={champGame}
                champPick={champPick}
                isLocked={isLocked}
                onSave={handleTiebreaker}
              />
            )}
          </>
        ) : (
          <LeaderboardView tournament={tournament} />
        )}
      </div>
    </BracketViewProvider>
  )
}