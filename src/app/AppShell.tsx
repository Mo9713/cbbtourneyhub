// src/app/AppShell.tsx
import { useCallback } from 'react'
import { PanelLeftOpen } from 'lucide-react'

import { useTournamentContext }    from '../features/tournament/model/TournamentContext'
import SnoopModal                  from '../features/bracket/ui/SnoopModal'
import AddTournamentModal          from '../features/tournament/AddTournamentModal'

import {
  Sidebar, MobileHeader, Toaster, ConfirmModal,
} from '../shared/ui'
import { useTheme }        from '../shared/lib/theme'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { useHashRouter }   from './hooks/useHashRouter'
import { useUIStore }      from '../shared/store/uiStore'

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

  const { createTournament } = useTournamentContext()

  useRealtimeSync()
  useHashRouter()

  const handleCreateTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount?: number,
  ) => {
    pushToast('Creating tournament…', 'info')
    const err = await createTournament(name, template, teamCount)
    if (err) pushToast(err, 'error')
    else     pushToast(`"${name}" created!`, 'success')
  }, [createTournament, pushToast])

  return (
    // Root shell: always dark slate, text-white. theme.appBg is for panels/cards,
    // not the root wrapper — using theme.bg here caused the flashbang (it's an
    // accent tint like bg-orange-600/10, not a background color).
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
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
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
        {/* Added overflow-y-auto and scrollbar-thin to fix the Home/Leaderboard bars */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <ViewRouter />
        </main>
      </div>

      {/* Global overlays */}
      {snoopTargetId && (
        <SnoopModal
          targetId={snoopTargetId}
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