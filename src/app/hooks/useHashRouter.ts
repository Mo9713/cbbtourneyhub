// src/app/hooks/useHashRouter.ts
//
// FIX: 'leaderboard' removed from the VALID set.
// It was purged from the ActiveView type union; a hash of #/leaderboard
// arriving via a stale bookmark will now be ignored (falls through to
// the default home render) rather than navigating to a ghost state.
//
// INVITE LINK (mount): #/join/CODE detected on first render. The invite
// code is stored in pendingInviteCode (UIStore) and the hash is replaced
// with #/home. AppShell then consumes pendingInviteCode to open
// JoinGroupModal pre-filled with the code.
//
// INVITE LINK (active tab): a hashchange listener now mirrors the mount
// logic. When a user pastes a #/join/CODE link into a tab that is already
// open, the browser fires hashchange but NOT a page reload, so the mount
// effect never re-runs. The listener catches this case and triggers the
// same join flow.

import { useEffect, useRef } from 'react'
import { useUIStore }        from '../../shared/store/uiStore'
import type { ActiveView }   from '../../shared/types'

const VALID: ReadonlySet<string> = new Set([
  'home', 'bracket', 'admin', 'settings', 'group',
])

function fromHash(hash: string): ActiveView | null {
  const v = hash.replace(/^#\/?/, '').split('/')[0]
  return VALID.has(v) ? (v as ActiveView) : null
}

// Extracted so both the mount effect and the hashchange listener share
// the exact same detection and dispatch logic.
function handleJoinHash(
  hash:                 string,
  setPendingInviteCode: (code: string | null) => void,
  setActiveView:        (v: ActiveView) => void,
): boolean {
  const joinMatch = hash.match(/#\/?join\/([^/?]+)/)
  if (!joinMatch?.[1]) return false

  // Normalise to uppercase — codes are stored uppercase in the DB.
  setPendingInviteCode(joinMatch[1].toUpperCase())
  history.replaceState({ view: 'home' }, '', '#/home')
  setActiveView('home')
  return true
}

export function useHashRouter(): void {
  const activeView           = useUIStore(s => s.activeView)
  const setActiveView        = useUIStore(s => s.setActiveView)
  const activeGroupId        = useUIStore(s => s.activeGroupId)
  const setActiveGroup       = useUIStore(s => s.setActiveGroup)
  const setPendingInviteCode = useUIStore(s => s.setPendingInviteCode)
  const fromPopState         = useRef(false)

  // ── activeView + activeGroupId → URL ──────────────────────
  useEffect(() => {
    if (fromPopState.current) {
      fromPopState.current = false
      return
    }

    const target = activeView === 'group' && activeGroupId
      ? `#/group/${activeGroupId}`
      : `#/${activeView}`

    if (window.location.hash !== target) {
      history.pushState({ view: activeView, groupId: activeGroupId }, '', target)
    }
  }, [activeView, activeGroupId])

  // ── hashchange — fires when user pastes a link into an open tab ──
  // The mount effect never re-runs in this case, so without this listener
  // a pasted #/join/CODE link would silently redirect to #/home without
  // opening the modal.
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash

      // Handle invite links first — they take priority over all other routes.
      if (handleJoinHash(hash, setPendingInviteCode, setActiveView)) return

      // Handle group deep-links.
      const groupMatch = hash.match(/#\/?group\/([^/?]+)/)
      if (groupMatch?.[1]) {
        fromPopState.current = true
        setActiveGroup(groupMatch[1])
        setActiveView('group')
        return
      }

      // Handle standard view links.
      const view = fromHash(hash)
      if (view) {
        fromPopState.current = true
        setActiveView(view)
      }
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [setActiveView, setActiveGroup, setPendingInviteCode])

  // ── popstate (Back/Forward) → activeView ──────────────────
  useEffect(() => {
    const onPop = () => {
      const hash       = window.location.hash
      const groupMatch = hash.match(/#\/?group\/([^/?]+)/)

      fromPopState.current = true

      if (groupMatch?.[1]) {
        setActiveGroup(groupMatch[1])
        setActiveView('group')
      } else {
        const view = fromHash(hash)
        if (view) setActiveView(view)
      }
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveView, setActiveGroup])

  // ── Mount: stamp the initial history entry ─────────────────
  useEffect(() => {
    const hash       = window.location.hash
    const groupMatch = hash.match(/#\/?group\/([^/?]+)/)
    const hashView   = fromHash(hash)

    // Invite link on mount — must be checked before all other patterns.
    if (handleJoinHash(hash, setPendingInviteCode, setActiveView)) return

    if (groupMatch?.[1]) {
      fromPopState.current = true
      setActiveGroup(groupMatch[1])
      setActiveView('group')
      history.replaceState({ view: 'group', groupId: groupMatch[1] }, '', hash)
    } else if (hashView && hashView !== activeView) {
      fromPopState.current = true
      setActiveView(hashView)
      history.replaceState({ view: hashView }, '', hash)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}