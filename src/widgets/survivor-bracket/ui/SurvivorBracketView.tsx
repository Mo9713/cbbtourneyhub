import { useMemo }       from 'react'
import { useTheme }      from '../../../shared/lib/theme'
import { isPicksLocked } from '../../../shared/lib/time'
import { getRoundLabel } from '../../../shared/lib/helpers'
import {
  useTournamentListQuery,
  useGames,
}                        from '../../../entities/tournament/model/queries'
import { useMyPicks }    from '../../../entities/pick/model/queries'
import { useLeaderboardRaw } from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard } from '../../../features/leaderboard/model/selectors'
import { getActiveSurvivorRound } from '../../../shared/lib/time'
import {
  getUsedTeams,
  getIsEliminated,
  isEndEarlyResolved,
  getSurvivorWinner,
  useMakeSurvivorPickMutation,
  SurvivorGameCard,
}                        from '../../../features/survivor'
import { useAuth }       from '../../../features/auth'
import BracketHeader     from '../../tournament-bracket/ui/BracketView/BracketHeader'
import type { Game, Pick, Tournament } from '../../../shared/types'

interface Props {
  tournamentId: string
}

export function SurvivorBracketView({ tournamentId }: Props) {
  const theme       = useTheme()
  const { profile } = useAuth()

  const { data: tournaments = [] } = useTournamentListQuery()
  const tournament = tournaments.find((t: Tournament) => t.id === tournamentId) ?? null

  const { data: games = [] } = useGames(tournamentId)
  const { data: picks = [] } = useMyPicks(tournamentId, games)
  const { data: raw }        = useLeaderboardRaw()

  const pickMutation = useMakeSurvivorPickMutation()

  const gameIds = useMemo(() => games.map((g: Game) => g.id), [games])

  const allTournamentPicks = useMemo<Pick[]>(() => {
    const gameIdSet = new Set(gameIds)
    return (raw?.allPicks ?? []).filter((p: Pick) => gameIdSet.has(p.game_id))
  }, [raw, gameIds])

  const activeRound = getActiveSurvivorRound(tournament)
  const prevRound   = activeRound > 1 ? activeRound - 1 : 0

  const activeRoundLabel = getRoundLabel(activeRound, 6, tournament?.round_names ?? null)
  const prevRoundLabel   = prevRound > 0 ? getRoundLabel(prevRound, 6, tournament?.round_names ?? null) : ''

  const currentRoundPickTeam = useMemo(() => {
    if (activeRound === 0) return null;
    const pick = picks.find((p: Pick) => {
      const g = games.find((game: Game) => game.id === p.game_id)
      return g?.round_num === activeRound
    })
    if (!pick) return null;
    const game = games.find((g: Game) => g.id === pick.game_id)
    if (!game) return null;
    if (pick.predicted_winner === 'team1') return game.team1_name;
    if (pick.predicted_winner === 'team2') return game.team2_name;
    return pick.predicted_winner;
  }, [picks, games, activeRound])

  const prevRoundPickTeam = useMemo(() => {
    if (prevRound === 0) return null;
    const pick = picks.find((p: Pick) => {
      const g = games.find((game: Game) => game.id === p.game_id)
      return g?.round_num === prevRound
    })
    if (!pick) return null;
    const game = games.find((g: Game) => g.id === pick.game_id)
    if (!game) return null;
    if (pick.predicted_winner === 'team1') return game.team1_name;
    if (pick.predicted_winner === 'team2') return game.team2_name;
    return pick.predicted_winner;
  }, [picks, games, prevRound])

  const usedTeams = useMemo(
    () => getUsedTeams(picks, games),
    [picks, games],
  )

  const isEliminated = useMemo(() => {
    if (!tournament) return false
    return getIsEliminated(picks, games, allTournamentPicks, tournament)
  }, [picks, games, allTournamentPicks, tournament])

  const winnerId = useMemo(() => {
    if (!tournament) return null
    return getSurvivorWinner(allTournamentPicks, games, tournament)
  }, [allTournamentPicks, games, tournament])

  const isTournamentOver = useMemo(() => {
    if (!tournament) return false
    const endedEarly = isEndEarlyResolved(allTournamentPicks, games, tournament)
    return endedEarly || winnerId !== null
  }, [allTournamentPicks, games, tournament, winnerId])

  const isLocked = tournament && profile
    ? isPicksLocked(tournament, profile.is_admin)
    : false

  const leaderboard = useMemo(() => {
    if (!raw || !tournament) return []
    const tMap = new Map([[tournament.id, tournament]])
    const tGames = raw.allGames.filter((g: Game) => g.tournament_id === tournament.id)
    const tGameIds = new Set(tGames.map((g: Game) => g.id))
    const tPicks = raw.allPicks.filter((p: Pick) => tGameIds.has(p.game_id))
    const userIds = new Set(tPicks.map((p: Pick) => p.user_id))
    const activeProfiles = raw.allProfiles.filter((p: any) => userIds.has(p.id))
    return computeLeaderboard(tPicks, tGames, raw.allGames, activeProfiles, tMap)
  }, [raw, tournament])

  const myEntry = leaderboard.find(e => e.profile.id === profile?.id)
  const firstPlace = leaderboard[0]

  const southGames   = games.filter((g: Game) => g.region === 'South'   && g.round_num <= 4)
  const westGames    = games.filter((g: Game) => g.region === 'West'    && g.round_num <= 4)
  const eastGames    = games.filter((g: Game) => g.region === 'East'    && g.round_num <= 4)
  const midwestGames = games.filter((g: Game) => g.region === 'Midwest' && g.round_num <= 4)
  const finalGames   = games.filter((g: Game) => g.round_num >= 5)

  const handleMakePick = (gameId: string, teamName: string | null, roundNum: number) => {
    const roundGameIds = games.filter(g => g.round_num === roundNum).map(g => g.id)
    pickMutation.mutate({ 
      tournamentId, 
      gameId, 
      predictedWinner: teamName, 
      roundNum, 
      tournamentGameIds: gameIds,
      roundGameIds
    })
  }

  const renderRegion = (
    name:        string,
    regionGames: Game[],
    align:       'left' | 'right' | 'center',
  ) => {
    const rounds = align === 'center' ? [5, 6] : [1, 2, 3, 4]
    return (
      <div className="flex flex-col w-full gap-4">
        <h3 className={`text-xl font-black uppercase tracking-wider ${theme.textBase} ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        }`}>
          {name}
        </h3>
        <div className={`flex w-full gap-6 overflow-x-auto pb-4 scrollbar-thin ${
          align === 'right' ? 'flex-row-reverse' : 'flex-row'
        } ${align === 'center' ? 'justify-center' : 'justify-between'}`}>
          {rounds.map(r => (
            <div key={r} className="flex flex-col gap-3 w-44 shrink-0">
              <div className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted} mb-1 ${
                align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
              }`}>
                Round {r}
              </div>
              {regionGames
                .filter((g: Game) => g.round_num === r)
                .sort((a: Game, b: Game) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((g: Game) => (
                  <SurvivorGameCard
                    key={g.id}
                    game={g}
                    currentPick={picks.find((p: Pick) => p.game_id === g.id)}
                    usedTeams={usedTeams}
                    activeRound={activeRound}
                    isEliminated={isEliminated}
                    isTournamentOver={isTournamentOver}
                    onMakePick={handleMakePick}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!tournament) return null

  const winnerProfile = winnerId 
    ? raw?.allProfiles.find(p => p.id === winnerId) 
    : null;

  return (
    <div className={`w-full min-h-full flex flex-col pb-12 ${theme.appBg}`}>
      
      <BracketHeader
        tournament={tournament}
        readOnly={false}
        isSurvivor={true}
        survivorScore={myEntry?.seedScore ?? 0}
        survivorFirstPlace={firstPlace?.seedScore ?? 0}
        isEliminated={isEliminated}
        survivorWinnerName={winnerProfile?.display_name}
        isMassElimination={isTournamentOver && !winnerId}
      />

      {/* ── 1-LINE STICKY BAR ── */}
      <div className="sticky top-0 z-40 w-full h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-[#1a2332] bg-white/95 dark:bg-[#0a0e17]/95 backdrop-blur-md shadow-sm">
        
        {/* LEFT: Spacer */}
        <div className="flex-1 hidden sm:block"></div>

        {/* CENTER: Picks Display */}
        <div className="flex-shrink-0 flex items-center justify-center gap-4 md:gap-8 mx-auto">
          
          {/* Previous Round Pick */}
          {prevRound > 0 && (
            <div className="hidden sm:flex items-center opacity-60">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mr-2">
                {prevRoundLabel}:
              </span>
              <span className={`text-xs font-black truncate max-w-[120px] ${prevRoundPickTeam ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {prevRoundPickTeam || 'None'}
              </span>
            </div>
          )}

          {/* Current Round Pick */}
          <div className="flex items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mr-2">
              {activeRound > 0 ? `${activeRoundLabel}:` : 'Pick:'}
            </span>
            <span className={`text-xs sm:text-sm font-black truncate max-w-[150px] sm:max-w-[200px] ${currentRoundPickTeam ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {currentRoundPickTeam || 'None'}
            </span>
          </div>

        </div>

        {/* RIGHT: Progress Bar (0/1 or 1/1, ONLY SHOWS WHEN OPEN & NOT LOCKED) */}
        <div className="flex-1 flex items-center justify-end">
          {!isLocked && tournament.status === 'open' ? (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#111622] border border-slate-200 dark:border-[#1a2332] rounded-xl px-2.5 py-1.5 shadow-inner">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Progress:</span>
              <div className="flex flex-col items-end">
                <span className={`text-[11px] font-black leading-none ${currentRoundPickTeam ? 'text-emerald-500' : theme.accent}`}>
                  {currentRoundPickTeam ? 1 : 0} / 1
                </span>
                <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${currentRoundPickTeam ? 'bg-emerald-500 w-full' : 'w-0'}`} />
                </div>
              </div>
            </div>
          ) : (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Picks Locked</span>
          )}
        </div>

      </div>

      {/* ── BRACKET GRID ── */}
      <div className="flex flex-col min-h-[100vh] w-full px-4 md:px-8 py-8">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <div className="flex flex-col gap-10 min-w-max">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-6">
              <div className="flex flex-col gap-10">
                {renderRegion('South', southGames, 'left')}
                {renderRegion('West', westGames, 'left')}
              </div>
              <div className="flex flex-col items-center justify-center">
                {renderRegion('Final Four', finalGames, 'center')}
              </div>
              <div className="flex flex-col gap-10">
                {renderRegion('East', eastGames, 'right')}
                {renderRegion('Midwest', midwestGames, 'right')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}