// src/App.tsx
// ─────────────────────────────────────────────────────────────
// The only responsibilities of this file:
//   1. Mount the ErrorBoundary
//   2. Stack the 4 Providers
//   3. Render AppShell (view router + global overlays)
//
// All data, mutations, and navigation live in the Providers.
// AppShell owns only what cannot live in a context:
//   • Toast state  (ephemeral UI notifications, no subscriber)
//   • ConfirmModal (imperative dialog triggered by AdminBuilderView)
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useMemo }    from 'react'

import ErrorBoundary       from './components/ErrorBoundary'
import Sidebar             from './components/Sidebar'
import MobileHeader        from './components/MobileHeader'
import Toaster             from './components/Toaster'
import ConfirmModal        from './components/ConfirmModal'
import SnoopModal          from './components/SnoopModal'
import AddTournamentModal  from './components/AddTournamentModal'

import { useBracketContext, useGameMutations } from './context/BracketContext'
import { AuthProvider }        from './context/AuthContext'
import { TournamentProvider }  from './context/TournamentContext'
import { BracketProvider }     from './context/BracketContext'
import { LeaderboardProvider } from './context/LeaderboardContext'

import { useAuthContext }        from './context/AuthContext'
import { useTournamentContext }  from './context/TournamentContext'
import { useTournamentList }     from './context/TournamentContext'
import { useSnoopTarget }        from './context/LeaderboardContext'

import { useRealtimeSync }   from './hooks/useRealtimeSync'
import { useTheme }          from './utils/theme'

import HomeView          from './views/HomeView'
import SettingsView      from './views/SettingsView'
import LeaderboardView   from './views/LeaderboardView'
import BracketView       from './views/BracketView'
import AdminBuilderView  from './views/AdminBuilderView'

import type { Game, ToastMsg, ConfirmModalCfg, TemplateKey } from './types'

// ── Ephemeral toast queue ─────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, text, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])
  return { toasts, push }
}

// ── AppShell ──────────────────────────────────────────────────
// Rendered inside all 4 Providers. Handles layout, view routing,
// and the two global imperative overlays (ConfirmModal, SnoopModal).
function AppShell() {
  const theme = useTheme()
  const { toasts, push } = useToasts()
  const [confirmModal, setConfirmModal] = useState<ConfirmModalCfg | null>(null)

  // ── Context reads ─────────────────────────────────────────
  const { profile, user, setProfile } = useAuthContext()
  const {
    activeView, selectedTournament, gamesCache,
    sidebarOpen, mobileMenuOpen, showAddTournament,
    setSidebarOpen, setMobileMenuOpen, setShowAddTournament,
    selectTournament, createTournament, deleteTournament,
  } = useTournamentContext()
  const { tournaments }  = useTournamentList()
  const { deleteGame } = useGameMutations()
  const { allMyPicks } = useBracketContext()
  const { snoopTargetId, setSnoopTargetId,
          allProfiles, allPicks, allGames } = useSnoopTarget()

  // Realtime channel — zero-arg, self-wiring via contexts
  useRealtimeSync()

  // ── ConfirmModal handlers passed to AdminBuilderView ──────
  const handleDeleteGame = useCallback((game: Game) => {
    setConfirmModal({
      title:        'Delete Game',
      message:      `Delete Round ${game.round_num} game (${game.team1_name} vs ${game.team2_name})? Associated picks will also be removed.`,
      confirmLabel: 'Delete',
      dangerous:    true,
      onConfirm: async () => {
        setConfirmModal(null)
        const err = await deleteGame(game)
        if (err) push(err, 'error'); else push('Game deleted', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }, [deleteGame, push])

  const handleDeleteTournament = useCallback(() => {
    if (!selectedTournament) return
    setConfirmModal({
      title:        'Delete Tournament',
      message:      `Permanently delete "${selectedTournament.name}"? All games and picks will also be deleted.`,
      confirmLabel: 'Delete Forever',
      dangerous:    true,
      onConfirm: async () => {
        setConfirmModal(null)
        
        // Get all games for this tournament from the cache, or an empty array if none exist
        const tournamentGames = gamesCache[selectedTournament.id] || []
        const gameIds = tournamentGames.map(g => g.id)
        
        const err = await deleteTournament(gameIds) 
        
        if (err) push(err, 'error'); else push('Tournament deleted', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }, [selectedTournament, gamesCache, deleteTournament, push]) // <-- Make sure gamesCache is in the dependency array

  const handleCreateTournament = async (name: string, template: TemplateKey, teamCount?: number) => {
    push('Creating tournament…', 'info')
    const err = await createTournament(name, template, teamCount)
    if (err) push(err, 'error'); else push(`"${name}" created!`, 'success')
  }

  // ── Snoop modal data ──────────────────────────────────────
  const snoopProfile = useMemo(
    () => snoopTargetId ? (allProfiles.find(p => p.id === snoopTargetId) ?? null) : null,
    [snoopTargetId, allProfiles]
  )

  // ── View router ───────────────────────────────────────────
  const renderView = () => {
    if (!profile) return null
    switch (activeView) {
      case 'admin':
        return profile.is_admin
          ? <AdminBuilderView
              onDeleteGame={handleDeleteGame}
              onDeleteTournament={handleDeleteTournament}
            />
          : <BracketView />
      case 'leaderboard': return <LeaderboardView />
      case 'settings':
        return <SettingsView
          profile={profile}
          userEmail={user?.email ?? ''}
          onProfileUpdate={setProfile}
          push={push}
        />
      case 'home':
        return <HomeView
          tournaments={tournaments}
          profile={profile}
          allGames={gamesCache}
          picks={allMyPicks}
          onSelectTournament={selectTournament}
        />
      default:
        return selectedTournament ? <BracketView /> : <HomeView
          tournaments={tournaments}
          profile={profile}
          allGames={gamesCache}
          picks={allMyPicks}
          onSelectTournament={selectTournament}
        />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">

      {/* Desktop sidebar */}
      {sidebarOpen && (
        <div className="hidden md:flex">
          <Sidebar onClose={() => {}} /> {/* <-- Pass an empty function here! */}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50">
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader
          onMenuOpen={() => setMobileMenuOpen(true)}
          sidebarBg={theme.sidebarBg}
          logo={theme.logo}
        />
        <main className="flex-1 overflow-hidden">
          {renderView()}
        </main>
      </div>

      {/* ── Global overlays ── */}
      {snoopTargetId && snoopProfile && (
        <SnoopModal
          targetProfile={snoopProfile}
          tournaments={tournaments.filter(t => t.status !== 'draft')}
          gamesCache={gamesCache}
          allPicks={allPicks}
          onClose={() => setSnoopTargetId(null)}
        />
      )}
      {showAddTournament && (
        <AddTournamentModal
          onClose={() => setShowAddTournament(false)}
          onCreate={handleCreateTournament}
        />
      )}
      {confirmModal && <ConfirmModal {...confirmModal} />}
      <Toaster toasts={toasts} />

    </div>
  )
}

// ── Provider stack ────────────────────────────────────────────
// AuthProvider owns the auth gate (shows spinner / AuthForm when
// unauthenticated) so AppShell only mounts with a resolved profile.
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TournamentProvider>
          <BracketProvider>
            <LeaderboardProvider>
              <AppShell />
            </LeaderboardProvider>
          </BracketProvider>
        </TournamentProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}