// src/app/ViewRouter.tsx

import { useAuth, SettingsView }          from '../features/auth'
import { HomeView, AdminBuilderView }     from '../features/tournament'
import { BracketView }                    from '../features/bracket'
import { LeaderboardView }                from '../features/leaderboard'

import { useTournamentListQuery }         from '../entities/tournament/model/queries'
import { useUIStore }                     from '../shared/store/uiStore'

export default function ViewRouter() {
  const { profile, user, setProfile } = useAuth()
  const { openSnoop, pushToast }      = useUIStore()
  
  const activeView           = useUIStore((s) => s.activeView)
  const selectedTournamentId = useUIStore((s) => s.selectedTournamentId)

  const { data: tournaments = [] } = useTournamentListQuery()
  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId) ?? null

  if (!profile) return null

  switch (activeView) {
    case 'admin':
      return profile.is_admin ? <AdminBuilderView /> : <BracketView />

    case 'leaderboard':
      return <LeaderboardView onSnoop={openSnoop} />

    case 'settings':
      return (
        <SettingsView
          profile={profile}
          userEmail={user?.email ?? ''}
          onProfileUpdate={setProfile}
          push={pushToast}
        />
      )

    case 'bracket':
      return <BracketView />

    case 'home':
    default:
      return selectedTournament ? <BracketView /> : <HomeView />
  }
}