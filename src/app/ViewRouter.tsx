// src/app/ViewRouter.tsx

import { useAuth }                                from '../features/auth'
import { HomePage as HomeView }                   from '../pages/home'
import { AdminBuilderPage as AdminBuilderView }   from '../pages/admin'
import { BracketPage as BracketView }             from '../pages/bracket'
import { GroupPage }                              from '../pages/group'
import { SettingsPage }                           from '../pages/settings'
import { useUIStore }                             from '../shared/store/uiStore'

export default function ViewRouter() {
  const { profile } = useAuth()
  const activeView  = useUIStore((s) => s.activeView)

  if (!profile) return null

  // Strict enum mapping enforces isolation of the activeView state.
  // The previous ambiguous fallback (selectedTournamentId ? BracketView : HomeView)
  // caused the router to hijack the 'home' view when context IDs were preserved.
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
      return <HomeView />
  }
}