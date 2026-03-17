// src/app/AppShell.tsx
import { useCallback, useEffect }           from 'react'
import { SnoopModal }                       from '../widgets/snoop-modal'
import { AddTournamentModal }               from '../features/tournament'
import { CreateGroupModal, JoinGroupModal } from '../features/group-management'
import { Navbar }                           from '../widgets/navbar' // ── NEW NAVBAR IMPORT ──
import { Toaster, ConfirmModal }            from '../shared/ui'
import { useTheme }                         from '../shared/lib/theme'
import { useRealtimeSync }                  from './hooks/useRealtimeSync'
import { useHashRouter }                    from './hooks/useHashRouter'
import { useUIStore }                       from '../shared/store/uiStore'
import { useCreateTournamentMutation }      from '../entities/tournament/model/queries'
import { useJoinGroupMutation }             from '../entities/group'

import ViewRouter                           from './ViewRouter'
import type { TemplateKey }                 from '../shared/types'

export default function AppShell() {
  const theme = useTheme()

  const {
    showAddTournament, closeAddTournament,
    isCreateGroupOpen, closeCreateGroup,
    isJoinGroupOpen,   closeJoinGroup,
    snoopTargetId,     closeSnoop,
    confirmModal,
    toasts,            pushToast,
    pendingInviteCode, setPendingInviteCode,
  } = useUIStore()

  const createTournamentM = useCreateTournamentMutation()
  const joinGroupM        = useJoinGroupMutation()

  useRealtimeSync()
  useHashRouter()

  // ── Invisible Auto-Join Flow ─────────────────────────────────
  useEffect(() => {
    if (!pendingInviteCode) return

    pushToast('Joining group...', 'info')

    joinGroupM.mutate(pendingInviteCode, {
      onSuccess: (groupId) => {
        pushToast('Successfully joined the group!', 'success')
        useUIStore.getState().setActiveGroup(groupId)
        useUIStore.getState().setActiveView('group')
      },
      onError: (err: any) => {
        pushToast(err.message || 'Failed to join group. Invalid code.', 'error')
      },
      onSettled: () => {
        setPendingInviteCode(null)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode]) 

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
    // ── LAYOUT CHANGED TO FLEX-COL ──
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${theme.appBg} text-slate-900 dark:text-white transition-colors duration-300`}>
      
      {/* ── TOP NAV ── */}
      <Navbar />

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 overflow-y-auto scrollbar-thin relative min-h-0">
        <ViewRouter />
      </main>

      {/* ── Global overlays ── */}
      {snoopTargetId && (
        <SnoopModal 
          targetId={snoopTargetId} 
          initialTid={useUIStore.getState().snoopTournamentId} // ── ADD THIS ──
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