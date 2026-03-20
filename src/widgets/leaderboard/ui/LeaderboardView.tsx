import { useMemo }                    from 'react'
import { useAuth }                    from '../../../features/auth'
import { useLeaderboardRaw }          from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }         from '../../../features/leaderboard/model/selectors'
import { StandardStandingsTable }     from '../../../features/leaderboard/ui/StandardStandingsTable'
import { SurvivorStandingsTable }     from '../../../features/leaderboard/ui/SurvivorStandingsTable'
import type { Game, Tournament, Pick } from '../../../shared/types'

export interface LeaderboardViewProps {
  tournament: Tournament
}

export default function LeaderboardView({ tournament }: LeaderboardViewProps) {
  const { profile } = useAuth()
  const { data: raw, isLoading } = useLeaderboardRaw()

  const leaderboard = useMemo(() => {
    if (!raw || !raw.allProfiles.length) return []

    const tournamentMap  = new Map<string, Tournament>([[tournament.id, tournament]])
    const scopedGames    = raw.allGames.filter((g: Game) => g.tournament_id === tournament.id)
    const scopedGameIds  = new Set(scopedGames.map(g => g.id))
    const scopedPicks    = raw.allPicks.filter((p: Pick) => scopedGameIds.has(p.game_id))

    // Only score and display users who have actively made picks.
    const activeParticipantIds = new Set(scopedPicks.map(p => p.user_id))
    const participants         = raw.allProfiles.filter(p => activeParticipantIds.has(p.id))

    return computeLeaderboard(
      scopedPicks,
      scopedGames,
      raw.allGames,
      participants,
      tournamentMap,
    )
  }, [raw, tournament])

  const currentId      = profile?.id ?? ''
  const isSurvivorMode = tournament.game_type === 'survivor'
  
  // Only show the tiebreaker chip column for standard bracket tournaments
  const showTiebreaker = !isSurvivorMode && (tournament.requires_tiebreaker === true)
  const isMe           = (userId: string) => userId === currentId

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm animate-pulse">
        <span>Loading Standings...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 md:py-8 scrollbar-thin">
        <div className="max-w-[79rem] mx-auto h-full">
          {isSurvivorMode ? (
            <SurvivorStandingsTable 
              title="Survivor Standings"
              board={leaderboard}
              isMe={isMe}
              tournamentId={tournament.id}
              variant="full"
            />
          ) : (
            <StandardStandingsTable 
              title="Tournament Standings"
              board={leaderboard}
              isMe={isMe}
              showTiebreaker={showTiebreaker}
              tournamentId={tournament.id}
              variant="full"
            />
          )}
        </div>
      </div>
    </div>
  )
}