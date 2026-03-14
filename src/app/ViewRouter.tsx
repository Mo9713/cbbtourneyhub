// src/app/ViewRouter.tsx

import { useAuth }                                from '../features/auth'
import { HomePage as HomeView }                   from '../pages/home'
import { AdminBuilderPage as AdminBuilderView }   from '../pages/admin'
import { BracketPage as BracketView }             from '../pages/bracket'
import { LeaderboardPage as LeaderboardView }     from '../pages/leaderboard'
import { GroupPage }                              from '../pages/group'
import { SettingsPage }                           from '../pages/settings'

import { useUIStore }                             from '../shared/store/uiStore'

export default function ViewRouter() {
  const { profile }              = useAuth()
  const { openSnoop }            = useUIStore()
  const activeView               = useUIStore((s) => s.activeView)
  
  // N-08 FIX: Removed tournament list query. Router shouldn't fetch data.
  // We only need the ID to conditionally render BracketView or HomeView.
  const selectedTournamentId     = useUIStore((s) => s.selectedTournamentId)

  if (!profile) return null

  switch (activeView) {
    case 'admin':
      return profile.is_admin ? <AdminBuilderView /> : <BracketView />

    case 'leaderboard':
      return <LeaderboardView onSnoop={openSnoop} />

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