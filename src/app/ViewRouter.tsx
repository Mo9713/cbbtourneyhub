// src/app/ViewRouter.tsx

import { useCallback } from 'react'

import { useAuthContext, SettingsView }   from '../features/auth'
import { useTournamentContext, HomeView,
         AdminBuilderView }               from '../features/tournament'
import { BracketView, useGameMutations }  from '../features/bracket'
import { LeaderboardView }                from '../features/leaderboard'

import { useUIStore } from '../shared/store/uiStore'
import type { Game }  from '../shared/types'

export default function ViewRouter() {
  const { profile, user, setProfile }           = useAuthContext()
  const { selectedTournament,
          gamesCache, deleteTournament }         = useTournamentContext()
  const { deleteGame }                          = useGameMutations()
  const { openSnoop, setConfirmModal, pushToast } = useUIStore()

  // activeView is read directly from Zustand — NOT from TournamentContext.
  // TournamentContext no longer exposes activeView because it changed on
  // every navigation, causing the entire consumer subtree to re-render.
  const activeView = useUIStore(s => s.activeView)

  if (!profile) return null

  const handleSnoop = openSnoop

  const handleDeleteGame = useCallback((game: Game) => {
    setConfirmModal({
      title:        'Delete Game',
      message:      `Delete Round ${game.round_num} game (${game.team1_name} vs ${game.team2_name})?`,
      dangerous:    true,
      confirmLabel: 'Delete',
      onCancel:  () => setConfirmModal(null),
      onConfirm: async () => {
        setConfirmModal(null)
        const err = await deleteGame(game)
        if (err) pushToast(err, 'error')
      },
    })
  }, [deleteGame, setConfirmModal, pushToast])

  const handleDeleteTournament = useCallback(() => {
    if (!selectedTournament) return
    const gameIds = (gamesCache[selectedTournament.id] ?? []).map(g => g.id)
    setConfirmModal({
      title:        'Delete Tournament',
      message:      `Permanently delete "${selectedTournament.name}" and all its games?`,
      dangerous:    true,
      confirmLabel: 'Delete',
      onCancel:  () => setConfirmModal(null),
      onConfirm: async () => {
        setConfirmModal(null)
        const err = await deleteTournament(gameIds)
        if (err) pushToast(err, 'error')
      },
    })
  }, [selectedTournament, gamesCache, deleteTournament, setConfirmModal, pushToast])

  switch (activeView) {
    case 'admin':
      return profile.is_admin
        ? <AdminBuilderView
            onDeleteGame={handleDeleteGame}
            onDeleteTournament={handleDeleteTournament}
          />
        : <BracketView />

    case 'leaderboard':
      return <LeaderboardView onSnoop={handleSnoop} />

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