// src/App.tsx
// ─────────────────────────────────────────────────────────────
// Provider stack + AppShell.
//
// ── Provider tree ─────────────────────────────────────────────
//
//   <AuthProvider>
//     <TournamentProvider>
//       <BracketProvider>
//         <AppShell>                   ← owns layout + snoop state
//           <LeaderboardProvider>      ← receives snoopTargetId prop
//             <AppShellContent />      ← can safely read all contexts
//           </LeaderboardProvider>
//         </AppShell>
//       </BracketProvider>
//     </TournamentProvider>
//   </AuthProvider>
//
// ── What AppShell owns ────────────────────────────────────────
//   • useLayoutState  — sidebarOpen, mobileMenuOpen,
//                       showAddTournament (pure UI toggles that
//                       must NOT live in a data context)
//   • snoopTargetId   — which user's bracket is being viewed
//                       (open/close must NOT cause leaderboard
//                        context to broadcast to all subscribers)
//   • Toast queue      — ephemeral, no subscribers
//   • ConfirmModal     — imperative dialog, no subscribers
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useMemo } from 'react'

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
import { LeaderboardProvider } from './context/LeaderboardContext'

import { useAuthContext }                              from './context/AuthContext'
import { useTournamentContext, useTournamentList }     from './context/TournamentContext'
import { useBracketContext, useGameMutations }         from './context/BracketContext'
import { useLeaderboardData }                          from './context/LeaderboardContext'

import { useRealtimeSync }   from './hooks/useRealtimeSync'
import { useTheme }          from './utils/theme'

import HomeView          from './views/HomeView'
import SettingsView      from './views/SettingsView'
import LeaderboardView   from './views/LeaderboardView'
import BracketView       from './views/BracketView'
import AdminBuilderView  from './views/AdminBuilderView'

import type { Game, ToastMsg, ConfirmModalCfg, TemplateKey } from './types'

// ─────────────────────────────────────────────────────────────
// § 1. Local-state hooks (no context involvement)
// ─────────────────────────────────────────────────────────────

/** Ephemeral toast queue — no subscribers, no context needed. */
function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, text, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])
  return { toasts, push }
}

/**
 * Pure UI layout toggles. Previously lived in TournamentContext,
 * causing every sidebar toggle to broadcast a context update to
 * all tournament data subscribers. They belong here.
 */
function useLayoutState() {
  const [sidebarOpen,       setSidebarOpen]       = useState(true)
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false)
  const [showAddTournament, setShowAddTournament] = useState(false)

  const openAddTournament  = useCallback(() => setShowAddTournament(true),  [])
  const closeAddTournament = useCallback(() => setShowAddTournament(false), [])
  const openMobileMenu     = useCallback(() => setMobileMenuOpen(true),     [])
  const closeMobileMenu    = useCallback(() => setMobileMenuOpen(false),    [])

  return {
    sidebarOpen,   setSidebarOpen,
    mobileMenuOpen, openMobileMenu, closeMobileMenu,
    showAddTournament, openAddTournament, closeAddTournament,
  }
}

// ─────────────────────────────────────────────────────────────
// § 2. AppShell — owns layout + snoop state, mounts LeaderboardProvider
// ─────────────────────────────────────────────────────────────

function AppShell() {
  const layout = useLayoutState()
  const [snoopTargetId, setSnoopTargetId] = useState<string | null>(null)

  return (
    <LeaderboardProvider snoopTargetId={snoopTargetId}>
      <AppShellContent
        layout={layout}
        snoopTargetId={snoopTargetId}
        setSnoopTargetId={setSnoopTargetId}
      />
    </LeaderboardProvider>
  )
}

// ─────────────────────────────────────────────────────────────
// § 3. AppShellContent — all hooks that need full context access
// ─────────────────────────────────────────────────────────────

interface AppShellContentProps {
  layout:           ReturnType<typeof useLayoutState>
  snoopTargetId:    string | null
  setSnoopTargetId: (id: string | null) => void
}

function AppShellContent({ layout, snoopTargetId, setSnoopTargetId }: AppShellContentProps) {
  const theme            = useTheme()
  const { toasts, push } = useToasts()
  const [confirmModal, setConfirmModal] = useState<ConfirmModalCfg | null>(null)

  // ── Context reads ─────────────────────────────────────────
  const { profile, user, setProfile }             = useAuthContext()
  const {
    activeView, selectedTournament, gamesCache,
    selectTournament, createTournament, deleteTournament,
  }                                               = useTournamentContext()
  const { tournaments }                           = useTournamentList()
  const { deleteGame }                            = useGameMutations()
  const { allMyPicks }                            = useBracketContext()
  const { allProfiles, allPicks, allGames }       = useLeaderboardData()

  // Realtime channel — reads snoopTargetId from AppShell (not LeaderboardContext)
  useRealtimeSync(snoopTargetId)

  // ── Confirm modal handlers ────────────────────────────────

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
        const gameIds = (gamesCache[selectedTournament.id] ?? []).map(g => g.id)
        const err = await deleteTournament(gameIds)
        if (err) push(err, 'error'); else push('Tournament deleted', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }, [selectedTournament, gamesCache, deleteTournament, push])

  const handleCreateTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount?: number
  ) => {
    push('Creating tournament…', 'info')
    const err = await createTournament(name, template, teamCount)
    if (err) push(err, 'error'); else push(`"${name}" created!`, 'success')
  }, [createTournament, push])

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
      case 'leaderboard':
        return <LeaderboardView onSnoop={setSnoopTargetId} />
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
        return selectedTournament
          ? <BracketView />
          : <HomeView
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
      {layout.sidebarOpen && (
        <div className="hidden md:flex">
          <Sidebar
            onClose={() => {}}
            onOpenAddTournament={layout.openAddTournament}
          />
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {layout.mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={layout.closeMobileMenu}
          />
          <div className="relative z-50">
            <Sidebar
              onClose={layout.closeMobileMenu}
              onOpenAddTournament={layout.openAddTournament}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader
          onMenuOpen={layout.openMobileMenu}
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
      {layout.showAddTournament && (
        <AddTournamentModal
          onClose={layout.closeAddTournament}
          onCreate={handleCreateTournament}
        />
      )}
      {confirmModal && <ConfirmModal {...confirmModal} />}
      <Toaster toasts={toasts} />

    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// § 4. Root — provider stack
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