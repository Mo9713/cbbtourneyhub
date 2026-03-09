// src/components/ViewRouter.tsx
import { useCallback } from 'react'

import { useAuthContext, SettingsView }   from '../features/auth'
import { useTournamentContext, HomeView,
         AdminBuilderView }               from '../features/tournament'
import { BracketView, useGameMutations }  from '../features/bracket'
import { LeaderboardView }                from '../features/leaderboard'

import { useUIStore } from '../store/uiStore'
import type { Game }  from '../shared/types'

export default function ViewRouter() {
  const { profile, user, setProfile }   = useAuthContext()
  const { activeView, selectedTournament,
          gamesCache, deleteTournament } = useTournamentContext()
  const { deleteGame }                  = useGameMutations()
  const { openSnoop, setConfirmModal,
          pushToast }                   = useUIStore()

  if (!profile) return null

  // FIX: Was `useCallback((id: string) => openSnoop(id), [openSnoop])`.
  // Zustand action creators are stable by contract — the store guarantees
  // referential equality across renders (same function object, always).
  // Wrapping a stable function in useCallback adds overhead (hook call,
  // dependency tracking, memory for the memoized ref) with zero benefit.
  // Direct assignment is both more accurate and more readable.
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