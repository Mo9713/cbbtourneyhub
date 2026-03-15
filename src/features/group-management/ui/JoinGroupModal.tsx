// src/features/group-management/ui/JoinGroupModal.tsx
//
// BUG FIX (B-1): inviteCode value is now normalised to uppercase before
// being passed to the mutation. Previously the input had CSS
// `text-transform: uppercase` which transforms the visual display only —
// the raw React state value remained as typed (lowercase), causing a
// case-sensitive mismatch against the DB's uppercase invite codes.
//
// CAPS LOCK INDICATOR: A visible warning badge appears when the OS
// CapsLock key is active, tracked via KeyboardEvent.getModifierState.
// This helps users understand why their code looks correct but is
// actually being sent in the wrong case if they somehow bypass the
// .toUpperCase() normalisation (e.g. via a password manager).
//
// INVITE LINK AUTO-FILL: accepts an optional `initialCode` prop.
// When provided (from AppShell after a #/join/CODE URL is detected),
// the input is pre-filled and the join is auto-submitted immediately.
// The user sees a brief "Joining..." state before being navigated to
// their new group on success.

import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle }        from 'lucide-react'
import { useJoinGroupMutation } from '../../../entities/group'
import { useUIStore }           from '../../../shared/store/uiStore'
import { useTheme }             from '../../../shared/lib/theme'

interface Props {
  onClose:       () => void
  // Pre-filled code from a #/join/CODE invite URL. When present the
  // modal auto-submits so the user doesn't have to click anything.
  initialCode?:  string
}

export function JoinGroupModal({ onClose, initialCode }: Props) {
  const theme     = useTheme()
  const pushToast = useUIStore((s) => s.pushToast)
  const setActiveGroup = useUIStore(s => s.setActiveGroup)
  const setActiveView  = useUIStore(s => s.setActiveView)

  // Seed state from initialCode so the input is pre-filled immediately.
  const [inviteCode, setInviteCode] = useState(initialCode ?? '')
  const [capsLockOn, setCapsLockOn] = useState(false)
  const { mutate, isPending }       = useJoinGroupMutation()

  // Auto-submit when a code arrives from an invite URL, but only once.
  const hasAutoSubmitted = useRef(false)
  useEffect(() => {
    if (initialCode && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true
      submitCode(initialCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode])

  // Detect CapsLock state from any key event while the modal is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      setCapsLockOn(e.getModifierState('CapsLock'))
    }
    window.addEventListener('keyup',   handler)
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keyup',   handler)
      window.removeEventListener('keydown', handler)
    }
  }, [])

  function submitCode(code: string) {
    const normalised = code.trim().toUpperCase() // BUG FIX B-1
    if (!normalised) {
      pushToast('Please enter an invite code.', 'error')
      return
    }

    mutate(normalised, {
      onSuccess: (groupId) => {
        pushToast('Successfully joined the group!', 'success')
        setActiveGroup(groupId)
        setActiveView('group')
        onClose()
      },
      onError: (error: Error) => {
        pushToast(error.message || 'Failed to join group.', 'error')
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitCode(inviteCode)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
        <div className={`px-6 py-4 border-b ${theme.borderBase} ${theme.headerBg}`}>
          <h2 className={`text-xl font-bold ${theme.textBase}`}>Join a Group</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="joinCode" className={`text-sm font-semibold ${theme.textBase}`}>
                Invite Code
              </label>
              {/* Caps lock badge — only visible when CapsLock is active */}
              {capsLockOn && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={9} />
                  Caps Lock On
                </span>
              )}
            </div>

            <input
              id="joinCode"
              type="text"
              value={inviteCode}
              // Store the value as typed but display uppercase via CSS.
              // The actual .toUpperCase() normalisation happens at submit
              // time so the DB match is always correct regardless of input.
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter code here..."
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`w-full px-4 py-2 rounded-lg border font-mono uppercase tracking-widest focus:outline-none focus:ring-2 transition-colors ${theme.inputBg} ${theme.borderBase} ${theme.textBase} focus:ring-amber-500`}
              disabled={isPending}
            />

            <p className={`text-xs ${theme.textMuted}`}>
              Codes are not case-sensitive — type freely.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-2">
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
              {isPending ? 'Joining…' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}