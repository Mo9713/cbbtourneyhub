// src/widgets/survivor-bracket/ui/SurvivorBracketView.tsx

import { useMemo, useState }     from 'react'
import { Ban }                   from 'lucide-react'
import { useTheme }              from '../../../shared/lib/theme'
import {
  useTournamentListQuery,
  useGames,
}                                from '../../../entities/tournament/model/queries'
import { useMyPicks }            from '../../../entities/pick/model/queries'
import { useLeaderboardRaw }     from '../../../entities/leaderboard/model/queries'
import { getActiveSurvivorRound } from '../../../shared/lib/time'
import {
  getUsedTeams,
  getIsEliminated,
  isEndEarlyResolved,
  useMakeSurvivorPickMutation,
  SurvivorGameCard,
}                                from '../../../features/survivor'
import { LeaderboardView }       from '../../leaderboard'
import Countdown                 from '../../../shared/ui/Countdown'
import { useAuth }               from '../../../features/auth'
import type { Game, Pick, Tournament } from '../../../shared/types'

interface Props {
  tournamentId: string
}

export function SurvivorBracketView({ tournamentId }: Props) {
  const theme       = useTheme()
  const { profile } = useAuth()

  const { data: tournaments = [] } = useTournamentListQuery()
  const tournament = tournaments.find((t: Tournament) => t.id === tournamentId) ?? null

  const [viewMode, setViewMode] = useState<'bracket' | 'standings'>('bracket')

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

  const usedTeams = useMemo(
    () => getUsedTeams(picks, games),
    [picks, games],
  )

  const isEliminated = useMemo(() => {
    if (!tournament) return false
    return getIsEliminated(picks, games, allTournamentPicks, tournament)
  }, [picks, games, allTournamentPicks, tournament])

  const isTournamentOver = useMemo(() => {
    if (!tournament) return false
    return isEndEarlyResolved(allTournamentPicks, games, tournament)
  }, [allTournamentPicks, games, tournament])

  const southGames   = games.filter((g: Game) => g.region === 'South'   && g.round_num <= 4)
  const westGames    = games.filter((g: Game) => g.region === 'West'    && g.round_num <= 4)
  const eastGames    = games.filter((g: Game) => g.region === 'East'    && g.round_num <= 4)
  const midwestGames = games.filter((g: Game) => g.region === 'Midwest' && g.round_num <= 4)
  const finalGames   = games.filter((g: Game) => g.round_num >= 5)

  const handleMakePick = (gameId: string, teamName: string | null, roundNum: number) => {
    pickMutation.mutate({ tournamentId, gameId, predictedWinner: teamName, roundNum, gameIds })
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

  return (
    <div className={`w-full h-full flex flex-col p-4 md:p-8 ${theme.appBg} overflow-hidden`}>
      {/* ── Dashboard Banner ── */}
      <div className={`flex flex-col xl:flex-row items-center justify-between p-4 md:p-6 rounded-2xl border shadow-sm mb-6 flex-shrink-0 gap-4 ${theme.panelBg} ${theme.borderBase}`}>
        
        {/* Left: Titles */}
        <div className="flex flex-col items-center xl:items-start text-center xl:text-left">
          <h1 className={`text-2xl font-black ${theme.textBase}`}>{tournament.name}</h1>
          <span className={`text-sm font-bold uppercase tracking-widest ${theme.textMuted}`}>Survivor Mode</span>
          {isTournamentOver && (
            <span className="mt-1 text-xs font-bold text-rose-400 uppercase tracking-widest">
              Pool Concluded — Mass Elimination
            </span>
          )}
        </div>

        {/* Middle: Custom Progress Bar for Survivor */}
        {!isTournamentOver && !isEliminated && activeRound > 0 && (
          <div className="w-full xl:flex-1 max-w-sm bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-3.5 shadow-inner">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                Current Round Pick:
                {currentRoundPickTeam && (
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 normal-case tracking-normal">
                    {currentRoundPickTeam}
                  </span>
                )}
              </span>
              <span className={`text-xs font-black ${currentRoundPickTeam ? 'text-emerald-500' : theme.accent}`}>
                {currentRoundPickTeam ? '1' : '0'} / 1
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${currentRoundPickTeam ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] w-full' : 'w-0'}`}
              />
            </div>
          </div>
        )}

        {/* Right: Actions & Countdown */}
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex gap-2 bg-black/10 dark:bg-white/5 p-1.5 rounded-xl">
            <button
              onClick={() => setViewMode('bracket')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'bracket'
                  ? `${theme.bg} ${theme.border} ${theme.accentB} shadow-sm`
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              My Picks
            </button>
            <button
              onClick={() => setViewMode('standings')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'standings'
                  ? `${theme.bg} ${theme.border} ${theme.accentB} shadow-sm`
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Standings
            </button>
          </div>

          <div className="flex gap-3 items-center">
            <Countdown
              tournament={tournament}
              isAdmin={profile?.is_admin ?? false}
              timezone={profile?.timezone ?? null}
            />
            {isEliminated && !isTournamentOver && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <Ban size={12} className="text-rose-400" />
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Eliminated</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'bracket' ? (
        <div className="flex-1 overflow-auto scrollbar-thin">
          <div className="flex flex-col gap-10 min-w-max">
            {/* Regional grid */}
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
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin">
          <LeaderboardView tournament={tournament} />
        </div>
      )}
    </div>
  )
}