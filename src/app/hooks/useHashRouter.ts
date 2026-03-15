// src/app/hooks/useHashRouter.ts
//
// FIX: 'leaderboard' removed from the VALID set.
// It was purged from the ActiveView type union; a hash of #/leaderboard
// arriving via a stale bookmark will now be ignored (falls through to
// the default home render) rather than navigating to a ghost state.
//
// INVITE LINK: #/join/CODE pattern detected on mount. When found, the
// invite code is stored in pendingInviteCode (UIStore) and the hash is
// replaced with #/home so the app renders the home view. AppShell then
// consumes pendingInviteCode and opens JoinGroupModal pre-filled with
// the code. This gives the user a confirmation step before being joined.

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

export function useHashRouter(): void {
  const activeView          = useUIStore(s => s.activeView)
  const setActiveView       = useUIStore(s => s.setActiveView)
  const activeGroupId       = useUIStore(s => s.activeGroupId)
  const setActiveGroup      = useUIStore(s => s.setActiveGroup)
  const setPendingInviteCode = useUIStore(s => s.setPendingInviteCode)
  const fromPopState        = useRef(false)

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

  // ── popstate (Back/Forward or Direct Entry) → activeView ──
  useEffect(() => {
    const onPop = () => {
      const hash       = window.location.hash
      const groupMatch = hash.match(/#\/?group\/([^/?]+)/)

      fromPopState.current = true

      if (groupMatch && groupMatch[1]) {
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
    const hash        = window.location.hash
    const groupMatch  = hash.match(/#\/?group\/([^/?]+)/)
    const hashView    = fromHash(hash)

    // INVITE LINK: detect #/join/CODE before any other pattern.
    // Store the code for AppShell to consume, then redirect to home.
    // .toUpperCase() normalises codes regardless of how they were typed
    // or generated, matching the uppercase codes stored in the DB.
    const joinMatch = hash.match(/#\/?join\/([^/?]+)/)
    if (joinMatch && joinMatch[1]) {
      fromPopState.current = true
      setPendingInviteCode(joinMatch[1].toUpperCase())
      history.replaceState({ view: 'home' }, '', '#/home')
      setActiveView('home')
      return
    }

    if (groupMatch && groupMatch[1]) {
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