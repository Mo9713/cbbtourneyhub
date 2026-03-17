import { useCallback, useEffect, useRef }   from 'react' // ── ADDED useRef ──
import { SnoopModal }                       from '../widgets/snoop-modal'
import { AddTournamentModal }               from '../features/tournament'
import { CreateGroupModal, JoinGroupModal } from '../features/group-management'
import { Navbar }                           from '../widgets/navbar'
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
    setPendingInviteCode,
  } = useUIStore()

  const createTournamentM = useCreateTournamentMutation()
  const joinGroupM        = useJoinGroupMutation()

  useRealtimeSync()
  useHashRouter()

  // ── THE EXECUTION GUARD ──
  // This prevents the infinite loop by ensuring we only try to join once.
  const joinAttempted = useRef(false)

  useEffect(() => {
    const storedInvite = localStorage.getItem('tourneyhub-invite')
    
    // Only proceed if we have a code AND we haven't tried joining in this session yet
    if (storedInvite && !joinAttempted.current) {
      joinAttempted.current = true // Lock it immediately
      
      pushToast(`Joining group ${storedInvite}...`, 'info')

      joinGroupM.mutate(storedInvite, {
        onSuccess: (groupId) => {
          pushToast('Successfully joined group!', 'success')
          useUIStore.getState().setActiveGroup(groupId)
          useUIStore.getState().setActiveView('group')
        },
        onError: (err: any) => {
          // Ignore if already a member, otherwise show error
          if (!err.message?.toLowerCase().includes('already a member')) {
            pushToast(err.message || 'Failed to join.', 'error')
          }
        },
        onSettled: () => {
          // Clean up localStorage so it doesn't trigger on future refreshes
          localStorage.removeItem('tourneyhub-invite')
          setPendingInviteCode(null)
        }
      })
    }
  }, [joinGroupM, pushToast, setPendingInviteCode])

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
        name, template, teamCount, game_type: gameType, group_id: groupId, teamsData,
      })
      useUIStore.getState().selectTournament(tournament.id)
      useUIStore.getState().setActiveView('admin')
      pushToast(`"${name}" created!`, 'success')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Create failed.', 'error')
    }
  }, [createTournamentM, pushToast])

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${theme.appBg} text-slate-900 dark:text-white transition-colors duration-300`}>
      <Navbar />
      
      <main className="flex-1 overflow-y-auto scrollbar-thin relative min-h-0">
        <ViewRouter />
      </main>

      {/* ── Global Overlays ── */}
      {snoopTargetId && (
        <SnoopModal 
          targetId={snoopTargetId} 
          initialTid={useUIStore.getState().snoopTournamentId}
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