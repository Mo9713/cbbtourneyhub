// src/app/ViewRouter.tsx
import { useAuth }                                from '../features/auth'
import { HomePage as HomeView }                   from '../pages/home'
import { AdminBuilderPage as AdminBuilderView }   from '../pages/admin'
import { BracketPage as BracketView }             from '../pages/bracket'
import { GroupPage }                              from '../pages/group'
import { SettingsPage }                           from '../pages/settings'
import StandingsPage                              from '../pages/standings/ui/StandingsPage' // ── NEW IMPORT ──
import { useUIStore }                             from '../shared/store/uiStore'

export default function ViewRouter() {
  const { profile } = useAuth()
  const activeView  = useUIStore((s) => s.activeView)

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

    case 'standings':
      return <StandingsPage /> // ── NEW ROUTE ──

    case 'home':
    default:
      return <HomeView />
  }
}