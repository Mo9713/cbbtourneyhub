// src/app/ViewRouter.tsx

import { useAuth, SettingsView }                  from '../features/auth'
import { HomePage as HomeView }                   from '../pages/home'
import { AdminBuilderPage as AdminBuilderView }   from '../pages/admin'
import { BracketPage as BracketView }             from '../pages/bracket'
import { LeaderboardPage as LeaderboardView }     from '../pages/leaderboard'
import { GroupPage }                              from '../pages/group'

import { useTournamentListQuery }                 from '../entities/tournament/model/queries'
import { useUIStore }                             from '../shared/store/uiStore'
import type { Tournament }                        from '../shared/types'

export default function ViewRouter() {
  const { profile, user, setProfile } = useAuth()
  const { openSnoop, pushToast }      = useUIStore()

  const activeView           = useUIStore((s) => s.activeView)
  const selectedTournamentId = useUIStore((s) => s.selectedTournamentId)

  const { data: tournaments = [] } = useTournamentListQuery()
  // Explicit Tournament type annotation — `t` was implicit `any` when
  // unwrap.ts failed to load as a module, breaking query return inference.
  const selectedTournament = tournaments.find((t: Tournament) => t.id === selectedTournamentId) ?? null

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

    case 'group':
      return <GroupPage />

    case 'home':
    default:
      return selectedTournament ? <BracketView /> : <HomeView />
  }
}