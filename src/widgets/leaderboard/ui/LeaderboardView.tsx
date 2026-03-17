// src/widgets/leaderboard/ui/LeaderboardView.tsx
//
// FSD Refactor (Phase 1): All inline DOM mapping has been stripped out. 
// This Widget now strictly composes data from entities/leaderboard and 
// passes it to the features/leaderboard/ui presentational tables.

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

  const isAdmin        = profile?.is_admin ?? false
  const currentId      = profile?.id ?? ''
  const isSurvivorMode = tournament.game_type === 'survivor'
  
  // Only show the tiebreaker chip column for standard bracket tournaments
  // that have requires_tiebreaker enabled.
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
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto h-full">
          {isSurvivorMode ? (
            <SurvivorStandingsTable 
              title="Survivor Standings"
              board={leaderboard}
              isMe={isMe}
              isAdmin={isAdmin}
              variant="full"
            />
          ) : (
            <StandardStandingsTable 
              title="Tournament Standings"
              board={leaderboard}
              isMe={isMe}
              isAdmin={isAdmin}
              showTiebreaker={showTiebreaker}
              variant="full"
            />
          )}
        </div>
      </div>
    </div>
  )
}