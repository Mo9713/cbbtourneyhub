// src/app/ViewRouter.tsx
//
// FIX: The dead 'leaderboard' case has been removed.
// 'leaderboard' has been purged from the ActiveView type union, so this
// switch statement no longer needs a case for it. All leaderboard UX
// is delivered through the contextual Standings tab inside BracketView
// and SurvivorBracketView.

import { useAuth }                                from '../features/auth'
import { HomePage as HomeView }                   from '../pages/home'
import { AdminBuilderPage as AdminBuilderView }   from '../pages/admin'
import { BracketPage as BracketView }             from '../pages/bracket'
import { GroupPage }                              from '../pages/group'
import { SettingsPage }                           from '../pages/settings'
import { useUIStore }                             from '../shared/store/uiStore'

export default function ViewRouter() {
  const { profile }          = useAuth()
  const activeView           = useUIStore((s) => s.activeView)
  const selectedTournamentId = useUIStore((s) => s.selectedTournamentId)

  if (!profile) return null

  switch (activeView) {
    case 'admin':
      return profile.is_admin ? <AdminBuilderView /> : <BracketView />

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