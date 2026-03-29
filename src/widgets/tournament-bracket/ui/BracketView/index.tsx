import { useState, useMemo, useCallback, useEffect }       from 'react'
import { Lock }                                            from 'lucide-react'
import { useTheme }                                        from '../../../../shared/lib/theme'
import { isPicksLocked, getActiveSurvivorRound }           from '../../../../shared/lib/time'
import { BD_REGIONS, getRoundLabel }                       from '../../../../shared/lib/helpers'
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
import { useLeaderboardRaw }                   from '../../../../entities/leaderboard/model/queries'
import { computeLeaderboard }                  from '../../../../features/leaderboard/model/selectors'
import { buildPickMap, sortedRounds, getChampGame }   from '../../../../features/bracket/model/selectors'
import { useGames, useTournamentListQuery }    from '../../../../entities/tournament/model/queries'
import {
  useMakeSurvivorPickMutation,
  isEndEarlyResolved,
  getIsEliminated,
  getSurvivorWinner
}                                              from '../../../../features/survivor'
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
  overrideUserId?:     string
  adminOverride?:      boolean
}

export default function BracketView({
  readOnly          = false,
  ownerName,
  overridePicks,
  overrideTournament,
  overrideGames,
  overrideUserId,
  adminOverride     = false,
}: BracketViewProps) {
  const theme = useTheme()

  const { profile }                = useAuth()
  const { data: tournaments = [] } = useTournamentListQuery()
  const selectedTournamentId       = useUIStore((s) => s.selectedTournamentId)

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const selectedTournament = useMemo(
    () => tournaments.find((t: Tournament) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  )

  const tournament = overrideTournament ?? selectedTournament

  const { data: _games = [] }  = useGames(tournament?.id ?? null)
  const { data: _picks = [] }  = useMyPicks(tournament?.id ?? null, _games)

  const games = overrideGames ?? _games
  const picks = overridePicks ?? _picks

  const { data: raw } = useLeaderboardRaw()

  const allTournamentPicks = useMemo<Pick[] | undefined>(() => {
    if (!tournament || tournament.game_type !== 'survivor' || readOnly) return undefined
    const gameIdSet = new Set(games.map((g: Game) => g.id))
    return (raw?.allPicks ?? []).filter((p: Pick) => gameIdSet.has(p.game_id))
  }, [raw, tournament, games, readOnly])

  const isLocked = tournament && profile
    ? isPicksLocked(tournament, profile.is_admin)
    : false

  const isSurvivor = tournament?.game_type === 'survivor'
  const isBigDance = useMemo(() => games.some((g: Game) => g.region), [games])

  // ── AUTOMATIC PHASE DETECTION: Force Final Four Logic ──
  const forceFinalFour = useMemo(() => {
    if (isSurvivor || !games.length) return false;
    const e8Games = games.filter(g => g.round_num === 4);
    // CHANGED: Now uses .some() instead of .every()! 
    // If EVEN ONE Elite 8 game is finished, and the tournament is open, it locks the UI.
    const e8StartedOrDone = e8Games.length > 0 && e8Games.some(g => !!g.actual_winner);
    return e8StartedOrDone && !isLocked;
  }, [isSurvivor, games, isLocked]);

  useEffect(() => {
    if (forceFinalFour) {
      setSelectedRegion('Final Four')
    } else if (selectedRegion === 'Final Four' && !forceFinalFour && !isBigDance) {
      setSelectedRegion(null)
    }
  }, [selectedTournamentId, forceFinalFour, isBigDance])

  const pickMap         = useMemo(() => buildPickMap(picks),                                     [picks])
  const rounds          = useMemo(() => sortedRounds(games, isBigDance ? selectedRegion : null), [games, isBigDance, selectedRegion])
  const effectiveNames  = useMemo<EffectiveNames>(() => deriveEffectiveNames(games, picks),      [games, picks])

  const champion        = useMemo(() => deriveChampion(games, picks, effectiveNames),            [games, picks, effectiveNames])
  const champGame       = useMemo(() => getChampGame(games),                                     [games])
  const actualChampion  = useMemo(() => champGame?.actual_winner ?? null,                        [champGame])

  const gameNumbers     = useMemo(() => computeGameNumbers(games),                               [games])
  const eliminatedTeams = useMemo(() => deriveEliminatedTeams(games, effectiveNames),            [games, effectiveNames])

  const score = useMemo(() => {
    if (!tournament) return { current: 0, max: 0 }
    return calculateLocalScore(games, picks, effectiveNames, tournament)
  }, [games, picks, effectiveNames, tournament])

  const champPick = useMemo(
    () => (champGame ? (picks.find((p: Pick) => p.game_id === champGame.id) ?? null) : null),
    [champGame, picks],
  )

  const gameIds = useMemo(() => games.map((g: Game) => g.id), [games])

  // ── SURVIVOR ROUND LOGIC ──
  const activeRound = tournament ? getActiveSurvivorRound(tournament) : 0
  const activeRoundLabel = getRoundLabel(activeRound, 6, tournament?.round_names ?? null)
  
  const prevRound = activeRound > 1 ? activeRound - 1 : 0
  const prevRoundLabel = prevRound > 0 ? getRoundLabel(prevRound, 6, tournament?.round_names ?? null) : ''

  const currentRoundPickTeam = useMemo(() => {
    if (!isSurvivor || !tournament || activeRound === 0) return null
    const pick = picks.find((p: Pick) => {
      const g = games.find((game: Game) => game.id === p.game_id)
      return g?.round_num === activeRound
    })
    if (!pick) return null
    const game = games.find((g: Game) => g.id === pick.game_id)
    if (!game) return null
    if (pick.predicted_winner === 'team1') return game.team1_name
    if (pick.predicted_winner === 'team2') return game.team2_name
    return pick.predicted_winner
  }, [isSurvivor, tournament, picks, games, activeRound])

  const prevRoundPickTeam = useMemo(() => {
    if (!isSurvivor || !tournament || prevRound === 0) return null
    const pick = picks.find((p: Pick) => {
      const g = games.find((game: Game) => game.id === p.game_id)
      return g?.round_num === prevRound
    })
    if (!pick) return null
    const game = games.find((g: Game) => g.id === pick.game_id)
    if (!game) return null
    if (pick.predicted_winner === 'team1') return game.team1_name
    if (pick.predicted_winner === 'team2') return game.team2_name
    return pick.predicted_winner
  }, [isSurvivor, tournament, picks, games, prevRound])

  const isTournamentOver = useMemo(() => {
    if (!tournament || !isSurvivor || !allTournamentPicks) return false
    return isEndEarlyResolved(allTournamentPicks, games, tournament)
  }, [tournament, isSurvivor, allTournamentPicks, games])

  const isEliminated = useMemo(() => {
    if (!tournament || !isSurvivor || !allTournamentPicks) return false
    return getIsEliminated(picks, games, allTournamentPicks, tournament)
  }, [picks, games, allTournamentPicks, tournament, isSurvivor])

  const winnerId = useMemo(() => {
    if (!tournament || !isSurvivor || !allTournamentPicks) return null
    return getSurvivorWinner(allTournamentPicks, games, tournament)
  }, [allTournamentPicks, games, tournament, isSurvivor])

  const winnerProfile = winnerId ? raw?.allProfiles.find((p: any) => p.id === winnerId) : null;

  const leaderboard = useMemo(() => {
    if (!raw || !tournament || !isSurvivor) return []
    const tMap = new Map([[tournament.id, tournament]])
    const tGames = raw.allGames.filter((g: Game) => g.tournament_id === tournament.id)
    const tGameIds = new Set(tGames.map((g: Game) => g.id))
    const tPicks = raw.allPicks.filter((p: Pick) => tGameIds.has(p.game_id))
    const userIds = new Set(tPicks.map((p: Pick) => p.user_id))
    const activeProfiles = raw.allProfiles.filter((p: any) => userIds.has(p.id))
    return computeLeaderboard(tPicks, tGames, raw.allGames, activeProfiles, tMap)
  }, [raw, tournament, isSurvivor])

  const myEntry = leaderboard.find(e => e.profile.id === profile?.id)
  const firstPlace = leaderboard[0]

  const { mutateAsync: makePick }       = useMakePick()
  const { mutate: makeSurvivorPick }    = useMakeSurvivorPickMutation()
  const { mutateAsync: saveTiebreaker } = useSaveTiebreaker()

  const handlePick = useCallback(async (game: Game, team: string) => {
    if (!tournament || readOnly || (isLocked && !adminOverride)) return
    
    // Prevent changing previous rounds during the Final Four re-pick phase
    if (forceFinalFour && game.round_num < 5 && !adminOverride) {
      return;
    }

    const existingPick = pickMap.get(game.id)
    await makePick({ game, team, tournamentId: tournament.id, games, existingPick, overrideUserId })
  }, [tournament, readOnly, isLocked, adminOverride, pickMap, makePick, games, overrideUserId, forceFinalFour])

  const handleSurvivorPick = useCallback((
    gameId: string, teamName: string | null, roundNum: number,
  ) => {
    if (!tournament || readOnly || (isLocked && !adminOverride)) return
    const roundGameIds = games.filter(g => g.round_num === roundNum).map(g => g.id)
    makeSurvivorPick({ 
      tournamentId: tournament.id, 
      gameId, 
      predictedWinner: teamName, 
      roundNum, 
      tournamentGameIds: gameIds,
      roundGameIds,
      overrideUserId 
    })
  }, [tournament, readOnly, isLocked, adminOverride, makeSurvivorPick, gameIds, games, overrideUserId])

  const handleTiebreaker = useCallback(async (
    gameId: string, predictedWinner: string, score: number,
  ): Promise<string | null> => {
    if (!tournament) return 'No active tournament'
    try {
      await saveTiebreaker({ gameId, predictedWinner, score, tournamentId: tournament.id, gameIds, overrideUserId })
      return null
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Failed to save tiebreaker'
    }
  }, [saveTiebreaker, tournament, gameIds, overrideUserId])

  const bracketViewValue = useMemo(() => ({
    isLocked:           (isLocked && !adminOverride) || readOnly,
    readOnly,
    adminOverride,
    ownerName,
    onPick:             handlePick,
    onSurvivorPick:     isSurvivor ? handleSurvivorPick : undefined,
    allTournamentPicks,
    isTournamentOver,
    showGameNumbers:    tournament?.show_game_numbers ?? false,
    theme,
  }), [isLocked, adminOverride, readOnly, ownerName, handlePick, isSurvivor, handleSurvivorPick, allTournamentPicks, isTournamentOver, tournament, theme])

  const elite8Games = useMemo(() => games.filter(g => g.round_num === 4), [games])
  const elite8Picks = useMemo(() => picks.filter(p => elite8Games.some(g => g.id === p.game_id)), [picks, elite8Games])
  const canPickFinalFour = readOnly || (elite8Games.length > 0 && elite8Picks.length === elite8Games.length)

  const regionProgress = useMemo(() => {
    const regionGames = selectedRegion
      ? (selectedRegion === 'Final Four' ? games.filter(g => g.round_num >= 5) : games.filter(g => g.region === selectedRegion))
      : games;
    const regionTotal = regionGames.length;
    const regionPicked = picks.filter(p => regionGames.some(g => g.id === p.game_id)).length;
    const pct = regionTotal > 0 ? Math.round((regionPicked / regionTotal) * 100) : 0;
    return { picked: regionPicked, total: regionTotal, pct };
  }, [games, picks, selectedRegion])

  if (!tournament || !profile) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-8 ${theme.appBg}`}>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500 opacity-50">Tournament Not Found</p>
      </div>
    )
  }

  return (
    <BracketViewProvider {...bracketViewValue}>
      <div className="flex flex-col min-h-full w-full pb-12">
        
        <BracketHeader
          tournament={tournament}
          readOnly={readOnly}
          ownerName={ownerName}
          score={score}
          // Survivor Props
          isSurvivor={isSurvivor}
          survivorScore={myEntry?.seedScore ?? 0}
          survivorFirstPlace={firstPlace?.seedScore ?? 0}
          isEliminated={isEliminated}
          survivorWinnerName={winnerProfile?.display_name}
          isMassElimination={isTournamentOver && !winnerId}
        />
        
        {/* ── STICKY NAV BAR ── */}
        <div className="sticky top-0 z-40 w-full flex flex-col md:flex-row md:items-center justify-between bg-white/95 dark:bg-[#0a0e17]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1a2332] shadow-sm">
          
          <div className="flex w-full md:w-auto justify-between px-2 sm:px-4">
            {/* LEFT: Tabs */}
            <div className="flex items-end h-12 md:h-14 overflow-x-auto scrollbar-none flex-1">
              <div className="flex gap-1 h-full items-end">
                {isBigDance && (
                  <>
                    <button
                      disabled={forceFinalFour}
                      onClick={() => !forceFinalFour && setSelectedRegion(null)}
                      className={`px-3 sm:px-4 py-2.5 md:py-3 text-[11px] sm:text-xs font-bold rounded-t-xl transition-all border-b-[3px] flex-shrink-0 flex items-center gap-1
                        ${forceFinalFour ? 'opacity-40 cursor-not-allowed' : ''}
                        ${!selectedRegion
                          ? `${theme.accent} border-current bg-amber-500/10`
                          : `${theme.textMuted} border-transparent hover:${theme.textBase} hover:bg-slate-800/50`
                        }`}
                    >
                      All
                      {forceFinalFour && <Lock size={10} className="mb-[1px]" />}
                    </button>
                    {BD_REGIONS.map((r) => {
                      const isFF = r === 'Final Four'
                      const isDisabled = forceFinalFour ? !isFF : (isFF && !canPickFinalFour)
                      return (
                        <button
                          key={r}
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setSelectedRegion(r)}
                          className={`px-3 sm:px-4 py-2.5 md:py-3 text-[11px] sm:text-xs font-bold rounded-t-xl transition-all border-b-[3px] flex-shrink-0 flex items-center gap-1
                            ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                            ${selectedRegion === r
                              ? `${theme.accent} border-current bg-amber-500/10`
                              : `${theme.textMuted} border-transparent hover:${theme.textBase} hover:bg-slate-800/50`
                            }`}
                        >
                          {r}
                          {isDisabled && <Lock size={10} className="mb-[1px]" />}
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            </div>

            {/* PROGRESS (Mobile Right Aligned) */}
            <div className="hidden sm:flex md:hidden items-center justify-end flex-shrink-0 pl-4 h-12 md:h-14">
              {!isLocked && tournament.status === 'open' ? (
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#111622] border border-slate-200 dark:border-[#1a2332] rounded-xl px-2.5 py-1.5 shadow-inner">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    {isSurvivor ? 'Progress:' : (selectedRegion || 'Total:')}
                  </span>
                  <span className={`text-[11px] font-black ${isSurvivor ? (currentRoundPickTeam ? 'text-emerald-500' : theme.accent) : (regionProgress.pct === 100 ? 'text-emerald-500' : theme.accent)}`}>
                    {isSurvivor ? (currentRoundPickTeam ? 1 : 0) : regionProgress.picked} / {isSurvivor ? 1 : regionProgress.total}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Picks Locked</span>
              )}
            </div>
          </div>

          {/* BOTTOM ROW (Mobile) / CENTER (Desktop) : Picks Display */}
          <div className="w-full md:absolute md:left-1/2 md:-translate-x-1/2 md:w-auto flex items-center justify-center gap-4 py-2 md:py-0 border-t border-slate-200/50 md:border-none">
            
            {isSurvivor && prevRound > 0 && (
              <div className="flex items-center opacity-60">
                <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mr-1.5">
                  {prevRoundLabel}:
                </span>
                <span className={`text-[10px] sm:text-xs font-black truncate max-w-[100px] ${prevRoundPickTeam ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {prevRoundPickTeam || 'None'}
                </span>
              </div>
            )}

            <div className="flex items-center">
              <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mr-1.5">
                {isSurvivor ? (activeRound > 0 ? `${activeRoundLabel}:` : 'Pick:') : 'Champ:'}
              </span>
              <span className={`text-[10px] sm:text-xs font-black truncate max-w-[120px] sm:max-w-[200px] ${(isSurvivor ? currentRoundPickTeam : champion) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {(isSurvivor ? currentRoundPickTeam : champion) || 'None'}
              </span>
            </div>
          </div>

          {/* PROGRESS (Desktop Right Aligned) */}
          <div className="hidden md:flex flex-1 items-center justify-end px-4 h-14">
            {!isLocked && tournament.status === 'open' ? (
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-[#111622] border border-slate-200 dark:border-[#1a2332] rounded-xl px-3 py-1.5 shadow-inner">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {isSurvivor ? 'Progress:' : (selectedRegion || 'Total:')}
                </span>
                <div className="flex flex-col items-end">
                  <span className={`text-[11px] font-black leading-none ${isSurvivor ? (currentRoundPickTeam ? 'text-emerald-500' : theme.accent) : (regionProgress.pct === 100 ? 'text-emerald-500' : theme.accent)}`}>
                    {isSurvivor ? (currentRoundPickTeam ? 1 : 0) : regionProgress.picked} / {isSurvivor ? 1 : regionProgress.total}
                  </span>
                  <div className="w-12 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isSurvivor ? (currentRoundPickTeam ? 'bg-emerald-500 w-full' : 'w-0') : (regionProgress.pct === 100 ? 'bg-emerald-500' : theme.btn.split(' ')[0])}`} 
                      style={{ width: isSurvivor ? (currentRoundPickTeam ? '100%' : '0%') : `${regionProgress.pct}%` }} 
                    />
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Picks Locked</span>
            )}
          </div>
        </div>

        <div className="w-full min-h-[100vh] flex flex-col">
          <BracketGrid
            rounds={rounds}
            pickMap={pickMap}
            effectiveNames={effectiveNames}
            tournament={tournament}
            gameNumbers={gameNumbers}
            eliminatedTeams={eliminatedTeams}
            champion={champion}
            actualChampion={actualChampion}
            readOnly={readOnly}
            ownerName={ownerName}
            selectedRegion={selectedRegion}
            onRegionSelect={setSelectedRegion}
          />

          {!readOnly && !isSurvivor && tournament.requires_tiebreaker && champGame && champPick && (
            <TiebreakerPanel
              champGame={champGame}
              champPick={champPick}
              championName={champion}
              isLocked={isLocked}
              onSave={handleTiebreaker}
            />
          )}
        </div>
      </div>
    </BracketViewProvider>
  )
}