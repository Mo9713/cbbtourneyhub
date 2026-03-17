import { Trash2 } from 'lucide-react'
import { useDeleteGroupMutation } from '../../../entities/group'
import { useUIStore } from '../../../shared/store/uiStore'

interface Props {
  groupId: string
  groupName: string
}

export function DeleteGroupButton({ groupId, groupName }: Props) {
  const deleteGroupM = useDeleteGroupMutation()
  const setConfirmModal = useUIStore(s => s.setConfirmModal)
  const setActiveView = useUIStore(s => s.setActiveView)
  const setActiveGroup = useUIStore(s => s.setActiveGroup)

  const handleDelete = () => {
    setConfirmModal({
      title: 'Delete Group',
      message: `Are you sure you want to delete "${groupName}"? This action cannot be undone.`,
      dangerous: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        deleteGroupM.mutate(groupId, {
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
      onClick={handleDelete} 
      disabled={deleteGroupM.isPending}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all disabled:opacity-50"
    >
      <Trash2 size={16} /> {deleteGroupM.isPending ? 'Deleting...' : 'Delete Group'}
    </button>
  )
}