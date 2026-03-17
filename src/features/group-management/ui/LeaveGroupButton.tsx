import { LogOut } from 'lucide-react'
import { useLeaveGroupMutation } from '../../../entities/group'
import { useUIStore } from '../../../shared/store/uiStore'

interface Props {
  groupId: string
  groupName: string
}

export function LeaveGroupButton({ groupId, groupName }: Props) {
  const leaveGroupM = useLeaveGroupMutation()
  const setConfirmModal = useUIStore(s => s.setConfirmModal)
  const setActiveView = useUIStore(s => s.setActiveView)
  const setActiveGroup = useUIStore(s => s.setActiveGroup)

  const handleLeave = () => {
    setConfirmModal({
      title: 'Leave Group',
      message: `Are you sure you want to leave "${groupName}"?`,
      dangerous: true,
      confirmLabel: 'Leave',
      onConfirm: () => {
        leaveGroupM.mutate(groupId, {
          onSuccess: () => {
            setActiveGroup(null)
            setActiveView('home')
            setConfirmModal(null)
          }
        })
      },
      onCancel: () => setConfirmModal(null)
    })
  }

  return (
    <button 
      onClick={handleLeave} 
      disabled={leaveGroupM.isPending}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all disabled:opacity-50"
    >
      <LogOut size={16} /> {leaveGroupM.isPending ? 'Leaving...' : 'Leave Group'}
    </button>
  )
}