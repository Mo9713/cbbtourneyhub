// src/features/group-management/ui/JoinGroupModal.tsx

import React, { useState } from 'react'
import { useJoinGroupMutation } from '../../../entities/group'
import { useUIStore }           from '../../../shared/store/uiStore'
import { useTheme }             from '../../../shared/lib/theme'

interface Props {
  onClose: () => void
}

export function JoinGroupModal({ onClose }: Props) {
  const theme     = useTheme()
  const pushToast = useUIStore((s) => s.pushToast)

  const [inviteCode, setInviteCode] = useState('')
  const { mutate, isPending }       = useJoinGroupMutation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inviteCode.trim()) {
      pushToast('Please enter an invite code.', 'error')
      return
    }

    mutate(inviteCode.trim(), {
      onSuccess: () => {
        pushToast('Successfully joined the group!', 'success')
        onClose()
      },
      onError: (error: Error) => {
        pushToast(error.message || 'Failed to join group.', 'error')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
        <div className={`px-6 py-4 border-b ${theme.borderBase} ${theme.headerBg}`}>
          <h2 className={`text-xl font-bold ${theme.textBase}`}>Join a Group</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="joinCode" className={`text-sm font-semibold ${theme.textBase}`}>
              Invite Code
            </label>
            <input
              id="joinCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter code here..."
              className={`w-full px-4 py-2 rounded-lg border font-mono uppercase focus:outline-none focus:ring-2 transition-colors ${theme.inputBg} ${theme.borderBase} ${theme.textBase} focus:ring-amber-500`}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${theme.textMuted}`}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2 rounded-lg font-bold transition-all ${theme.btn} ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isPending}
            >
              {isPending ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}