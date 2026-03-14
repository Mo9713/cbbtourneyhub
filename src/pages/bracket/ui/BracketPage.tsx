// src/pages/bracket/ui/BracketPage.tsx

import { TournamentBracket } from '../../../widgets/tournament-bracket'
import { useUIStore } from '../../../shared/store/uiStore'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useTheme } from '../../../shared/lib/theme'

export function BracketPage() {
  const theme = useTheme()
  const tournamentId = useUIStore(s => s.selectedTournamentId)
  
  const { isLoading } = useTournamentListQuery()

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

  return <TournamentBracket />
}