// src/pages/bracket/ui/BracketPage.tsx

import { TournamentBracket } from '../../../widgets/tournament-bracket'
import { SurvivorBracketView } from '../../../widgets/survivor-bracket'
import { useUIStore } from '../../../shared/store/uiStore'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useTheme } from '../../../shared/lib/theme'

export function BracketPage() {
  const theme = useTheme()
  const tournamentId = useUIStore(s => s.selectedTournamentId)
  
  const { data: tournaments, isLoading } = useTournamentListQuery()
  const tournament = tournaments?.find(t => t.id === tournamentId)

  if (!tournamentId) {
    return (
      <div className={`flex items-center justify-center w-full h-full min-h-screen ${theme.appBg}`}>
        <p className={theme.textMuted}>No tournament selected.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center w-full h-full min-h-screen ${theme.appBg}`}>
        <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin border-amber-500`}></div>
      </div>
    )
  }

  // Route to the specialized layout if it's a Survivor pool
  if (tournament?.game_type === 'survivor') {
    return <SurvivorBracketView tournamentId={tournamentId} />
  }

  // Fallback to the standard bracket layout
  return <TournamentBracket />
}