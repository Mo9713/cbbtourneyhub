// src/widgets/survivor-bracket/ui/SurvivorBracketView.tsx

import { Ban, ShieldAlert } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'
import { useTournamentListQuery, useGames } from '../../../entities/tournament/model/queries'
import { useMyPicks } from '../../../entities/pick/model/queries'
import { getActiveSurvivorRound } from '../../../shared/lib/time'
import { getUsedTeams, getIsEliminated, getAggregateSeedScore, useMakeSurvivorPickMutation, SurvivorGameCard } from '../../../features/survivor'
import type { Game, Pick } from '../../../shared/types'

interface Props {
  tournamentId: string
}

export function SurvivorBracketView({ tournamentId }: Props) {
  const theme = useTheme()
  
  const { data: tournaments = [] } = useTournamentListQuery()
  const tournament = tournaments.find(t => t.id === tournamentId) || null

  const { data: games = [] } = useGames(tournamentId)
  const { data: picks = [] } = useMyPicks(tournamentId, games)
  
  const pickMutation = useMakeSurvivorPickMutation()

  const activeRound  = getActiveSurvivorRound(tournament)
  const usedTeams    = getUsedTeams(picks)
  const isEliminated = getIsEliminated(picks, games)
  const seedScore    = getAggregateSeedScore(picks, games)

  const activeRoundPick = picks.find((p: Pick) => p.round_num === activeRound)

  // Safe region parsing with strict typing
  const southGames   = games.filter((g: Game) => g.region === 'South' && g.round_num <= 4)
  const westGames    = games.filter((g: Game) => g.region === 'West' && g.round_num <= 4)
  const eastGames    = games.filter((g: Game) => g.region === 'East' && g.round_num <= 4)
  const midwestGames = games.filter((g: Game) => g.region === 'Midwest' && g.round_num <= 4)
  const finalGames   = games.filter((g: Game) => g.round_num >= 5)

  const handleMakePick = (gameId: string, teamName: string | null, roundNum: number) => {
    pickMutation.mutate({ tournamentId, gameId, predictedWinner: teamName, roundNum })
  }

  const renderRegion = (name: string, regionGames: Game[], align: 'left' | 'right' | 'center') => {
    const rounds = align === 'center' ? [5, 6] : [1, 2, 3, 4]
    return (
      <div className="flex flex-col w-full gap-4">
        <h3 className={`text-xl font-black uppercase tracking-wider ${theme.textBase} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
          {name}
        </h3>
        {/* flex-row-reverse forces Round 1 to the far right side of the screen for the East/Midwest regions */}
        <div className={`flex w-full gap-6 overflow-x-auto pb-4 scrollbar-thin ${align === 'right' ? 'flex-row-reverse' : 'flex-row'} ${align === 'center' ? 'justify-center' : 'justify-between'}`}>
          {rounds.map(r => (
            <div key={r} className="flex flex-col gap-3 w-44 shrink-0">
              <div className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted} mb-1 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
                Round {r}
              </div>
              {regionGames
                .filter((g: Game) => g.round_num === r)
                .sort((a: Game, b: Game) => (a.sort_order || 0) - (b.sort_order || 0))
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

  return (
    <div className={`w-full h-full flex flex-col p-4 md:p-8 ${theme.appBg}`}>
      {/* ── Dashboard Banner ── */}
      <div className={`flex flex-col md:flex-row items-center justify-between p-4 md:p-6 rounded-2xl border shadow-sm mb-8 ${theme.panelBg} ${theme.borderBase}`}>
        <div className="flex flex-col">
          <h1 className={`text-2xl font-black ${theme.textBase}`}>{tournament?.name}</h1>
          <span className={`text-sm font-bold uppercase tracking-widest ${theme.textMuted}`}>Survivor Mode</span>
        </div>
        
        <div className="flex gap-4 mt-4 md:mt-0">
          <div className={`flex flex-col items-center px-6 py-2 rounded-lg ${theme.bgMd}`}>
            <span className={`text-xs font-bold uppercase ${theme.textMuted}`}>Active Round</span>
            <span className={`text-lg font-black ${theme.accent}`}>{activeRound > 0 ? activeRound : 'Locked'}</span>
          </div>
          <div className={`flex flex-col items-center px-6 py-2 rounded-lg ${theme.bgMd}`}>
            <span className={`text-xs font-bold uppercase ${theme.textMuted}`}>Seed Score</span>
            <span className={`text-lg font-black ${theme.textBase}`}>{seedScore}</span>
          </div>
        </div>
      </div>

      {isEliminated && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-4 rounded-xl flex items-center gap-3 mb-8 shadow-sm">
          <Ban size={24} />
          <div>
            <h3 className="font-bold text-lg">Eliminated</h3>
            <p className="text-sm opacity-90">One of your picked teams lost. You are no longer eligible to advance.</p>
          </div>
        </div>
      )}

      {/* Current Pick Status */}
      {!isEliminated && activeRound > 0 && (
        <div className={`flex items-center gap-3 px-6 py-3 rounded-xl border mb-8 ${theme.panelBg} ${theme.borderBase}`}>
          <ShieldAlert size={18} className={activeRoundPick ? theme.accent : theme.textMuted} />
          <span className={`text-sm font-bold ${theme.textBase}`}>
            Round {activeRound} Pick:
          </span>
          <span className={`text-sm font-black ${activeRoundPick ? theme.accent : theme.textMuted}`}>
            {activeRoundPick ? activeRoundPick.predicted_winner : 'None Selected'}
          </span>
        </div>
      )}

      {/* ── 4-Quadrant Visual Layout ── */}
      <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 w-full mt-4 min-w-[1200px]">
        
        {/* LEFT WING (South & West) */}
        <div className="flex flex-col gap-12 w-full xl:w-[40%]">
          {renderRegion('South', southGames, 'left')}
          {renderRegion('West', westGames, 'left')}
        </div>

        {/* CENTER (Final Four) */}
        <div className="flex flex-col gap-12 w-full xl:w-[20%] items-center justify-center border-y xl:border-y-0 xl:border-x border-slate-200/20 py-8 xl:py-0 px-4">
          {renderRegion('Championship', finalGames, 'center')}
        </div>

        {/* RIGHT WING (East & Midwest) */}
        <div className="flex flex-col gap-12 w-full xl:w-[40%]">
          {renderRegion('East', eastGames, 'right')}
          {renderRegion('Midwest', midwestGames, 'right')}
        </div>

      </div>
    </div>
  )
}