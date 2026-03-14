// src/widgets/survivor-bracket/ui/SurvivorBracketView.tsx
//
// C-03 FIX: getIsEliminated now receives allTournamentPicks (all
// participants' picks) and the tournament object so it can correctly
// evaluate the revive_all elimination rule.
//
// MOD-02 FIX: LeaderboardView is now imported from the leaderboard
// widget's public index.ts rather than directly from its internal ui/.

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
  getAggregateSeedScore,
  useMakeSurvivorPickMutation,
  SurvivorGameCard,
}                                from '../../../features/survivor'
// MOD-02 FIX: Import via the public slice API, not the internal ui/ directory.
import { LeaderboardView }       from '../../leaderboard'
import Countdown                 from '../../../shared/ui/Countdown'
import { useAuth }               from '../../../features/auth'
import type { Game, Pick, Tournament } from '../../../shared/types'

interface Props {
  tournamentId: string
}

export function SurvivorBracketView({ tournamentId }: Props) {
  const theme   = useTheme()
  const { profile } = useAuth()

  const { data: tournaments = [] } = useTournamentListQuery()
  const tournament = tournaments.find((t: Tournament) => t.id === tournamentId) ?? null

  const [viewMode, setViewMode] = useState<'bracket' | 'standings'>('bracket')

  const { data: games = [] } = useGames(tournamentId)
  const { data: picks = [] } = useMyPicks(tournamentId, games)
  const { data: raw }        = useLeaderboardRaw()

  const pickMutation = useMakeSurvivorPickMutation()

  const gameIds = useMemo(() => games.map((g: Game) => g.id), [games])

  // C-03 FIX: Derive all tournament participants' picks from the leaderboard
  // raw cache for revive_all evaluation. This ensures getIsEliminated has
  // the global context required to detect mass-elimination events.
  const allTournamentPicks = useMemo<Pick[]>(() => {
    const gameIdSet = new Set(gameIds)
    return (raw?.allPicks ?? []).filter((p: Pick) => gameIdSet.has(p.game_id))
  }, [raw, gameIds])

  const activeRound = getActiveSurvivorRound(tournament)
  const usedTeams   = getUsedTeams(picks)
  const seedScore   = getAggregateSeedScore(picks, games)

  // C-03 FIX: Pass allTournamentPicks and tournament to enable revive_all.
  const isEliminated = useMemo(() => {
    if (!tournament) return false
    return getIsEliminated(picks, games, allTournamentPicks, tournament)
  }, [picks, games, allTournamentPicks, tournament])

  const southGames   = games.filter((g: Game) => g.region === 'South'   && g.round_num <= 4)
  const westGames    = games.filter((g: Game) => g.region === 'West'    && g.round_num <= 4)
  const eastGames    = games.filter((g: Game) => g.region === 'East'    && g.round_num <= 4)
  const midwestGames = games.filter((g: Game) => g.region === 'Midwest' && g.round_num <= 4)
  const finalGames   = games.filter((g: Game) => g.round_num >= 5)

  const handleMakePick = (gameId: string, teamName: string | null, roundNum: number) => {
    pickMutation.mutate({ tournamentId, gameId, predictedWinner: teamName, roundNum, gameIds })
  }

  const renderRegion = (name: string, regionGames: Game[], align: 'left' | 'right' | 'center') => {
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
      <div className={`flex flex-col xl:flex-row items-center justify-between p-4 md:p-6 rounded-2xl border shadow-sm mb-6 flex-shrink-0 ${theme.panelBg} ${theme.borderBase}`}>
        <div className="flex flex-col items-center xl:items-start text-center xl:text-left">
          <h1 className={`text-2xl font-black ${theme.textBase}`}>{tournament.name}</h1>
          <span className={`text-sm font-bold uppercase tracking-widest ${theme.textMuted}`}>Survivor Mode</span>
        </div>

        <div className="flex gap-2 bg-black/10 dark:bg-white/5 p-1.5 rounded-xl mt-4 xl:mt-0">
          <button
            onClick={() => setViewMode('bracket')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
              viewMode === 'bracket' ? `${theme.bg} ${theme.border} ${theme.accentB} shadow-sm` : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            My Picks
          </button>
          <button
            onClick={() => setViewMode('standings')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
              viewMode === 'standings' ? `${theme.bg} ${theme.border} ${theme.accentB} shadow-sm` : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Standings
          </button>
        </div>

        <div className="flex gap-3 mt-4 xl:mt-0 items-center">
          <Countdown tournament={tournament} isAdmin={profile?.is_admin ?? false} timezone={profile?.timezone ?? null} />
          <div className={`flex flex-col items-center px-4 py-1.5 rounded-lg ${theme.bgMd}`}>
            <span className={`text-xs font-bold uppercase ${theme.textMuted}`}>Active Rd</span>
            <span className={`text-lg font-black ${theme.accent}`}>{activeRound > 0 ? activeRound : 'Locked'}</span>
          </div>
          <div className={`flex flex-col items-center px-4 py-1.5 rounded-lg ${theme.bgMd}`}>
            <span className={`text-xs font-bold uppercase ${theme.textMuted}`}>Seed Score</span>
            <span className={`text-lg font-black ${theme.textBase}`}>{seedScore}</span>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {viewMode === 'bracket' ? (
        <div className="flex-1 overflow-y-auto pr-2">
          {isEliminated && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-4 rounded-xl flex items-center gap-3 mb-8 shadow-sm">
              <Ban size={24} />
              <div>
                <h3 className="font-bold text-lg">Eliminated</h3>
                <p className="text-sm opacity-90">One of your picked teams lost. You are out of this survivor pool.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-12">
            {renderRegion('South',   southGames,   'left')}
            {renderRegion('West',    westGames,    'left')}
            {renderRegion('East',    eastGames,    'right')}
            {renderRegion('Midwest', midwestGames, 'right')}
            {renderRegion('Finals',  finalGames,   'center')}
          </div>
        </div>
      ) : (
        <div className={`flex-1 rounded-2xl border overflow-hidden shadow-xl ${theme.borderBase} bg-white dark:bg-slate-950`}>
          <LeaderboardView tournament={tournament} />
        </div>
      )}
    </div>
  )
}