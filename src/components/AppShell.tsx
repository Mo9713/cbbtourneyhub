// src.components.AppShell.tsx — Atomic Layout. View-agnostic skeleton.
import { useCallback, useMemo } from 'react'
import { PanelLeftOpen }        from 'lucide-react'

import { useAuthContext }                           from '../features/auth'
import { useTournamentContext, useTournamentList }  from '../features/tournament'
import { useGameMutations }                         from '../features/bracket'
import { SnoopModal }                               from '../features/bracket'
import { AddTournamentModal }                       from '../features/tournament'
import { useLeaderboardRaw }                        from '../features/leaderboard'

import {
  Sidebar, MobileHeader, Toaster, ConfirmModal,
} from '../shared/components'
import { useTheme }        from '../shared/utils'
import { useRealtimeSync } from '../shared/hooks'
import { useUIStore }      from '../store/uiStore'

import ViewRouter from './ViewRouter'
import type { TemplateKey } from '../shared/types'

export default function AppShell() {
  const theme = useTheme()

  const {
    sidebarOpen,       setSidebarOpen,
    mobileMenuOpen,    setMobileMenuOpen,
    showAddTournament, closeAddTournament,
    snoopTargetId,     closeSnoop,
    confirmModal,
    toasts,            pushToast,
  } = useUIStore()

  const { selectedTournament, gamesCache, createTournament } = useTournamentContext()
  const { tournaments }  = useTournamentList()
  const { data: lbRaw }  = useLeaderboardRaw()
  const allProfiles      = lbRaw?.allProfiles ?? []
  const allPicks         = lbRaw?.allPicks    ?? []

  useRealtimeSync()

  const handleCreateTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount?: number,
  ) => {
    pushToast('Creating tournament…', 'info')
    const err = await createTournament(name, template, teamCount)
    if (err) pushToast(err, 'error')
    else     pushToast(`"${name}" created!`, 'success')
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

      {/* Main content area */}
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

      {/* Global overlays */}
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


