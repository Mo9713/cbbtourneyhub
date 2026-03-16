// src/app/AppShell.tsx
//
// INVITE LINK RACE CONDITION FIX:
// Previously, the useEffect that consumed pendingInviteCode called both
// openJoinGroup() and setPendingInviteCode(null) in the same synchronous
// block. React batches these state writes, so by the time JoinGroupModal
// actually mounted, pendingInviteCode was already null and initialCode
// arrived as undefined — the auto-submit never fired.
//
// Fix: pendingInviteCode is first captured into local component state
// (capturedInviteCode) before being cleared from the store. The modal
// receives capturedInviteCode as initialCode, which is stable across
// the render cycle where the store value is being cleared. The store
// value is then cleared in a setTimeout(0) — one tick after openJoinGroup
// has caused a re-render — so there is no window where both values are
// null simultaneously.
//
// capturedInviteCode is reset to null when the modal closes, ready for
// the next invite link navigation.

import { useCallback, useEffect, useState } from 'react'
import { PanelLeftOpen }                    from 'lucide-react'

import { SnoopModal }                       from '../widgets/snoop-modal'
import { AddTournamentModal }               from '../features/tournament'
import { CreateGroupModal, JoinGroupModal } from '../features/group-management'

import { Sidebar }                          from '../widgets/sidebar'
import { MobileHeader, Toaster, ConfirmModal } from '../shared/ui'
import { useTheme }                         from '../shared/lib/theme'
import { useRealtimeSync }                  from './hooks/useRealtimeSync'
import { useHashRouter }                    from './hooks/useHashRouter'
import { useUIStore }                       from '../shared/store/uiStore'
import { useCreateTournamentMutation }      from '../entities/tournament/model/queries'

import ViewRouter                           from './ViewRouter'
import type { TemplateKey }                 from '../shared/types'

export default function AppShell() {
  const theme = useTheme()

  const {
    sidebarOpen,       setSidebarOpen,
    mobileMenuOpen,    setMobileMenuOpen,
    showAddTournament, closeAddTournament,
    isCreateGroupOpen, closeCreateGroup,
    isJoinGroupOpen,   closeJoinGroup,   openJoinGroup,
    snoopTargetId,     closeSnoop,
    confirmModal,
    toasts,            pushToast,
    pendingInviteCode, setPendingInviteCode,
  } = useUIStore()

  const createTournamentM = useCreateTournamentMutation()

  useRealtimeSync()
  useHashRouter()

  // ── Race-condition-safe invite code capture ────────────────
  // This local state is the stable value passed to JoinGroupModal as
  // initialCode. It is set before the store value is cleared, so the
  // modal always receives a non-null string when launched from a link.
  const [capturedInviteCode, setCapturedInviteCode] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingInviteCode) return

    // 1. Capture the code locally so the modal prop stays stable.
    setCapturedInviteCode(pendingInviteCode)

    // 2. Open the modal — this triggers a re-render where isJoinGroupOpen
    //    becomes true and JoinGroupModal mounts with capturedInviteCode.
    openJoinGroup()

    // 3. Clear the store value one tick later. The setTimeout(0) ensures
    //    the modal has fully mounted and read its initialCode prop before
    //    pendingInviteCode becomes null in the store. Without this delay,
    //    React batches the clear with the openJoinGroup write and the
    //    modal sees initialCode={undefined} on its first render.
    setTimeout(() => setPendingInviteCode(null), 0)
  }, [pendingInviteCode, openJoinGroup, setPendingInviteCode])

  const handleJoinModalClose = useCallback(() => {
    closeJoinGroup()
    // Reset captured code so it doesn't persist to a manually opened modal.
    setCapturedInviteCode(null)
  }, [closeJoinGroup])

  const handleCreateTournament = useCallback(async (
    name:       string,
    template:   TemplateKey,
    teamCount?: number,
    gameType?:  'bracket' | 'survivor',
    groupId?:   string | null,
    teamsData?: any[],
  ) => {
    pushToast('Creating tournament…', 'info')
    try {
      const tournament = await createTournamentM.mutateAsync({
        name,
        template,
        teamCount,
        game_type: gameType,
        group_id:  groupId,
        teamsData,
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

      {/* ── Global overlays ── */}
      {snoopTargetId && (
        <SnoopModal targetId={snoopTargetId} onClose={closeSnoop} />
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

      {/* capturedInviteCode (not pendingInviteCode from the store) is passed
          as initialCode. It is set before the store value is cleared, so the
          modal always receives a non-null string when opened via an invite link.
          Manually opened modals receive capturedInviteCode=null → no auto-submit. */}
      {isJoinGroupOpen && (
        <JoinGroupModal
          onClose={handleJoinModalClose}
          initialCode={capturedInviteCode ?? undefined}
        />
      )}

      {confirmModal && <ConfirmModal {...confirmModal} />}
      <Toaster toasts={toasts} />
    </div>
  )
}