// src/App.tsx
import { useCallback, useMemo } from 'react'
import { PanelLeftOpen }        from 'lucide-react'

import ErrorBoundary       from './components/ErrorBoundary'
import Sidebar             from './components/Sidebar'
import MobileHeader        from './components/MobileHeader'
import Toaster             from './components/Toaster'
import ConfirmModal        from './components/ConfirmModal'
import SnoopModal          from './components/SnoopModal'
import AddTournamentModal  from './components/AddTournamentModal'

import { AuthProvider }        from './context/AuthContext'
import { TournamentProvider }  from './context/TournamentContext'
import { BracketProvider }     from './context/BracketContext'

import { useAuthContext }                          from './context/AuthContext'
import { useTournamentContext, useTournamentList } from './context/TournamentContext'
import { useGameMutations }                        from './context/BracketContext'

import { useUIStore }        from './store/uiStore'
import { useRealtimeSync }   from './hooks/useRealtimeSync'
import { useTheme }          from './utils/theme'
import { useLeaderboardRaw } from './features/leaderboard/queries'

import HomeView         from './views/HomeView'
import SettingsView     from './views/SettingsView'
import LeaderboardView  from './views/LeaderboardView'
import BracketView      from './views/BracketView'
import AdminBuilderView from './views/AdminBuilderView'

import type { Game, TemplateKey } from './types'

// ─────────────────────────────────────────────────────────────
// § 1. ViewRouter
// ─────────────────────────────────────────────────────────────

function ViewRouter() {
  const { profile, user, setProfile }      = useAuthContext()
  const { activeView, selectedTournament } = useTournamentContext()
  const { openSnoop, setConfirmModal }     = useUIStore()

  if (!profile) return null

  const handleSnoop = (id: string | null) => id ? openSnoop(id) : useUIStore.getState().closeSnoop()

  switch (activeView) {
    case 'admin':
      return profile.is_admin
        ? <AdminBuilderView
            onDeleteGame={(game) => setConfirmModal({
              title:   'Delete Game',
              message: `Delete Round ${game.round_num} game (${game.team1_name} vs ${game.team2_name})?`,
              dangerous:    true,
              confirmLabel: 'Delete',
              onCancel:  () => setConfirmModal(null),
              onConfirm: async () => {
                setConfirmModal(null)
                // deleteGame called via AdminBuilderView's own handler
              },
            })}
            onDeleteTournament={() => {/* handled in AppShellContent */}}
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
          push={useUIStore.getState().pushToast}
        />
      )
    case 'home':
      return <HomeView />
    default:
      return selectedTournament ? <BracketView /> : <HomeView />
  }
}

// ─────────────────────────────────────────────────────────────
// § 2. AppShell
// ─────────────────────────────────────────────────────────────

function AppShell() {
  return <AppShellContent />
}

// ─────────────────────────────────────────────────────────────
// § 3. AppShellContent
// ─────────────────────────────────────────────────────────────

function AppShellContent() {
  const theme = useTheme()

  // All layout + modal + toast state from the store
  const {
    sidebarOpen,    setSidebarOpen,
    mobileMenuOpen, setMobileMenuOpen,
    showAddTournament, closeAddTournament,
    snoopTargetId,  closeSnoop,
    confirmModal,   setConfirmModal,
    toasts,         pushToast,
  } = useUIStore()

  const { profile }                                  = useAuthContext()
  const { selectedTournament, gamesCache,
          createTournament, deleteTournament }        = useTournamentContext()
  const { tournaments }                              = useTournamentList()
  const { deleteGame }                               = useGameMutations()
  
  // Leaderboard data now comes from TanStack Query
  const { data: lbRaw } = useLeaderboardRaw()
  const allProfiles = lbRaw?.allProfiles ?? []
  const allPicks    = lbRaw?.allPicks    ?? []

  useRealtimeSync()

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
  }, [deleteGame, pushToast, setConfirmModal])

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
  }, [selectedTournament, gamesCache, deleteTournament, pushToast, setConfirmModal])

  const handleCreateTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount?: number,
  ) => {
    pushToast('Creating tournament…', 'info')
    const err = await createTournament(name, template, teamCount)
    if (err) pushToast(err, 'error'); else pushToast(`"${name}" created!`, 'success')
  }, [createTournament, pushToast])

  const snoopProfile = useMemo(
    () => snoopTargetId ? (allProfiles.find(p => p.id === snoopTargetId) ?? null) : null,
    [snoopTargetId, allProfiles],
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">

      {/* Desktop Sidebar — expanded */}
      {sidebarOpen && (
        <div className="hidden md:flex">
          <Sidebar
            onClose={() => {}}
            onOpenAddTournament={() => useUIStore.getState().openAddTournament()}
            onToggleDesktop={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Desktop Sidebar — minimised stub */}
      {!sidebarOpen && (
        <div className={`hidden md:flex flex-col items-center py-4 w-16 border-r border-slate-800 flex-shrink-0 ${theme.sidebarBg}`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}

      {/* Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50">
            <Sidebar
              onClose={() => setMobileMenuOpen(false)}
              onOpenAddTournament={() => useUIStore.getState().openAddTournament()}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        <MobileHeader
          onMenuOpen={() => setMobileMenuOpen(true)}
          sidebarBg={theme.sidebarBg}
          logo={theme.logo}
        />
        <main className="flex-1 overflow-hidden">
          <ViewRouter />
        </main>
      </div>

      {/* Modals */}
      {snoopTargetId && snoopProfile && (
        <SnoopModal
          targetProfile={snoopProfile}
          tournaments={tournaments.filter(t => t.status !== 'draft')}
          gamesCache={gamesCache}
          allPicks={allPicks}
          onClose={closeSnoop}
        />
      )}
      {showAddTournament && (
        <AddTournamentModal
          onClose={closeAddTournament}
          onCreate={handleCreateTournament}
        />
      )}
      {confirmModal && <ConfirmModal {...confirmModal} />}
      <Toaster toasts={toasts} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// § 4. Root
// ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TournamentProvider>
          <BracketProvider>
            <AppShell />
          </BracketProvider>
        </TournamentProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}