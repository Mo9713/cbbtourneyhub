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

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) ?? null,
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

  // N-04 FIX: Hook is initialised once at this level, not inside every
  // MatchupColumn render. Rules of Hooks requires it to be called
  // unconditionally — the handler is passed into context only when the
  // tournament is Survivor mode, so Standard bracket columns receive
  // undefined and never invoke it.
  const { mutate: makeSurvivorPick } = useMakeSurvivorPickMutation()

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const isLocked = tournament && profile
    ? isPicksLocked(tournament, profile.is_admin)
        || tournament.status === 'draft'
        || tournament.status === 'locked'
    : false

  const isSurvivor = tournament?.game_type === 'survivor'
  const isBigDance = useMemo(() => games.some((g) => g.region), [games])

  const pickMap         = useMemo(() => buildPickMap(picks),                                            [picks])
  const rounds          = useMemo(() => sortedRounds(games, isBigDance ? selectedRegion : null),        [games, isBigDance, selectedRegion])
  const effectiveNames  = useMemo<EffectiveNames>(() => deriveEffectiveNames(games, picks),             [games, picks])
  const champion        = useMemo(() => deriveChampion(games, picks, effectiveNames),                   [games, picks, effectiveNames])
  const champGame       = useMemo(() => getChampGame(games),                                            [games])
  const gameNumbers     = useMemo(() => computeGameNumbers(games),                                      [games])
  const eliminatedTeams = useMemo(() => deriveEliminatedTeams(games, effectiveNames),                   [games, effectiveNames])

  const score = useMemo(() => {
    if (!tournament) return { current: 0, max: 0 }
    return calculateLocalScore(games, picks, effectiveNames, tournament)
  }, [games, picks, effectiveNames, tournament])

  const champPick = useMemo(
    () => (champGame ? (picks.find((p) => p.game_id === champGame.id) ?? null) : null),
    [champGame, picks],
  )

  // Stable game ID array for the survivor handler — derived from the
  // already-cached games list, eliminating the C-06 N+1 DB fetch.
  const gameIds = useMemo(() => games.map((g) => g.id), [games])

  const handlePick = useCallback(async (game: Game, team: string) => {
    if (!tournament || readOnly || isLocked) return
    const existingPick = pickMap.get(game.id)
    await makePick({ game, team, tournamentId: tournament.id, games, existingPick })
  }, [tournament, readOnly, isLocked, pickMap, makePick, games])

  // Only wired into the context value when isSurvivor is true.
  // Standard bracket columns receive undefined from context and skip
  // the SurvivorGameCard render path entirely.
  const handleSurvivorPick = useCallback((
    gameId:          string,
    teamName:        string | null,
    roundNum:        number,
  ) => {
    if (!tournament || readOnly || isLocked) return
    makeSurvivorPick({
      tournamentId:    tournament.id,
      gameId,
      predictedWinner: teamName,
      roundNum,
      gameIds,
    })
  }, [tournament, readOnly, isLocked, makeSurvivorPick, gameIds])

  const handleTiebreaker = useCallback(async (
    gameId: string, predictedWinner: string, score: number,
  ): Promise<string | null> => {
    if (!tournament) return 'No active tournament'
    try {
      await saveTiebreaker({ gameId, predictedWinner, score, tournamentId: tournament.id })
      return null
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Failed to save tiebreaker'
    }
  }, [saveTiebreaker, tournament])

  const bracketViewValue = useMemo(() => ({
    isLocked:       isLocked || readOnly,
    readOnly,
    ownerName,
    onPick:         handlePick,
    // Populate onSurvivorPick only for Survivor tournaments so that
    // MatchupColumn can guard on its presence without an explicit
    // isSurvivor prop.
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
      </div>
    </BracketViewProvider>
  )
}