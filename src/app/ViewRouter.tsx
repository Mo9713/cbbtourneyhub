// src/app/ViewRouter.tsx

import { useAuth }                                from '../features/auth'
import { HomePage as HomeView }                   from '../pages/home'
import { AdminBuilderPage as AdminBuilderView }   from '../pages/admin'
import { BracketPage as BracketView }             from '../pages/bracket'
import { GroupPage }                              from '../pages/group'
import { SettingsPage }                           from '../pages/settings'

import { useUIStore }                             from '../shared/store/uiStore'

export default function ViewRouter() {
  const { profile }              = useAuth()
  const activeView               = useUIStore((s) => s.activeView)
  const selectedTournamentId     = useUIStore((s) => s.selectedTournamentId)

  if (!profile) return null

  switch (activeView) {
    case 'admin':
      return profile.is_admin ? <AdminBuilderView /> : <BracketView />

    // FIX: Global Leaderboard route purged. Replaced by contextual Bracket Standings tabs.
    case 'leaderboard':
    case 'settings':
      return <SettingsPage />

    case 'bracket':
      return <BracketView />

    case 'group':
      return <GroupPage />

    case 'home':
    default:
      return selectedTournamentId ? <BracketView /> : <HomeView />
  }
}