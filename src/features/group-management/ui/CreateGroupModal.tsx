// src/features/group-management/ui/CreateGroupModal.tsx

import React, { useState }        from 'react'
import { useCreateGroupMutation } from '../../../entities/group'
import { useUIStore }             from '../../../shared/store/uiStore'
import { useTheme }               from '../../../shared/lib/theme'

interface Props {
  onClose: () => void
}

export function CreateGroupModal({ onClose }: Props) {
  const theme     = useTheme()
  const pushToast = useUIStore((s) => s.pushToast)

  const [name, setName]             = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const { mutate, isPending } = useCreateGroupMutation()

  const handleGenerateCode = () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    setInviteCode(code)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !inviteCode.trim()) {
      pushToast('Group Name and Invite Code are required.', 'error')
      return
    }

    mutate(
      { name: name.trim(), invite_code: inviteCode.trim() },
      {
        onSuccess: (group) => {
          // `group` is correctly typed as Group — no longer unknown.
          // N-11 FIX: setActiveGroup + setActiveView instead of direct hash write.
          pushToast('Group created successfully!', 'success')
          useUIStore.getState().setActiveGroup(group.id)
          useUIStore.getState().setActiveView('group')
          onClose()
        },
        onError: (error: Error) => {
          pushToast(error.message || 'Failed to create group.', 'error')
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
        <div className={`px-6 py-4 border-b ${theme.borderBase} ${theme.headerBg}`}>
          <h2 className={`text-xl font-bold ${theme.textBase}`}>Create a Group</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="groupName" className={`text-sm font-semibold ${theme.textBase}`}>
              Group Name
            </label>
            <input
              id="groupName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Office Pool 2026"
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${theme.inputBg} ${theme.borderBase} ${theme.textBase} focus:ring-amber-500`}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="inviteCode" className={`text-sm font-semibold ${theme.textBase}`}>
              Invite Code
            </label>
            <div className="flex gap-2">
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Unique code..."
                className={`flex-1 px-4 py-2 rounded-lg border font-mono focus:outline-none focus:ring-2 transition-colors ${theme.inputBg} ${theme.borderBase} ${theme.textBase} focus:ring-amber-500`}
                disabled={isPending}
              />
              <button
                type="button"
                onClick={handleGenerateCode}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme.btnSm}`}
                disabled={isPending}
              >
                Auto
              </button>
            </div>
            <p className={`text-xs ${theme.textMuted}`}>
              Share this code with users you want to invite.
            </p>
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
              {isPending ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}