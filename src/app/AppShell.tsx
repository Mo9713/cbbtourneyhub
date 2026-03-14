// src/app/AppShell.tsx

import { useCallback }                  from 'react'
import { PanelLeftOpen }                from 'lucide-react'

import { SnoopModal }                   from '../widgets/snoop-modal'
import { AddTournamentModal }           from '../features/tournament'
import { CreateGroupModal, JoinGroupModal } from '../features/group-management'

import { Sidebar }                      from '../widgets/sidebar'
import {
  MobileHeader, Toaster, ConfirmModal,
} from '../shared/ui'
import { useTheme }                     from '../shared/lib/theme'
import { useRealtimeSync }              from './hooks/useRealtimeSync'
import { useHashRouter }                from './hooks/useHashRouter'
import { useUIStore }                   from '../shared/store/uiStore'
import { useCreateTournamentMutation }  from '../entities/tournament/model/queries'

import ViewRouter                       from './ViewRouter'
import type { TemplateKey }             from '../shared/types'

export default function AppShell() {
  const theme = useTheme()

  const {
    sidebarOpen,       setSidebarOpen,
    mobileMenuOpen,    setMobileMenuOpen,
    showAddTournament, closeAddTournament,
    isCreateGroupOpen, closeCreateGroup,
    isJoinGroupOpen,   closeJoinGroup,
    snoopTargetId,     closeSnoop,
    confirmModal,
    toasts,            pushToast,
  } = useUIStore()

  const createTournamentM = useCreateTournamentMutation()

  useRealtimeSync()
  useHashRouter()

  const handleCreateTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount?: number, gameType?: 'bracket' | 'survivor', groupId?: string | null
  ) => {
    pushToast('Creating tournament…', 'info')
    try {
      const tournament = await createTournamentM.mutateAsync({ 
        name, 
        template, 
        teamCount,
        game_type: gameType,
        group_id: groupId
      })
      useUIStore.getState().selectTournament(tournament.id)
      useUIStore.getState().setActiveView('admin')
      pushToast(`"${name}" created!`, 'success')
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'Create failed.',
        'error',
      )
    }
  }, [createTournamentM, pushToast])

  return (
    <div className={`flex h-screen overflow-hidden ${theme.appBg} text-slate-900 dark:text-white transition-colors duration-300`}>

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
        <div className={`hidden md:flex flex-col items-center py-4 w-16 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 ${theme.sidebarBg} transition-colors duration-300`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
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
      {isCreateGroupOpen && (
        <CreateGroupModal onClose={closeCreateGroup} />
      )}
      {isJoinGroupOpen && (
        <JoinGroupModal onClose={closeJoinGroup} />
      )}
      {confirmModal && <ConfirmModal {...confirmModal} />}
      <Toaster toasts={toasts} />
    </div>
  )
}