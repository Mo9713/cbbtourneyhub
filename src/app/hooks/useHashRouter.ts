// src/app/hooks/useHashRouter.ts

import { useEffect, useRef } from 'react'
import { useUIStore }        from '../../shared/store/uiStore'
import type { ActiveView }   from '../../shared/types'

const VALID: ReadonlySet<string> = new Set([
  'home', 'bracket', 'admin', 'settings', 'group', 'standings'
])

function fromHash(hash: string): ActiveView | null {
  const v = hash.replace(/^#\/?/, '').split('/')[0]
  return VALID.has(v) ? (v as ActiveView) : null
}

function handleJoinHash(
  hash:                 string,
  setPendingInviteCode: (code: string | null) => void,
  setActiveView:        (v: ActiveView) => void,
): boolean {
  const joinMatch = hash.match(/#\/?join\/([^/?]+)/)
  if (!joinMatch?.[1]) return false

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
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash

      if (handleJoinHash(hash, setPendingInviteCode, setActiveView)) return

      const groupMatch = hash.match(/#\/?group\/([^/?]+)/)
      if (groupMatch?.[1]) {
        fromPopState.current = true
        setActiveGroup(groupMatch[1])
        setActiveView('group')
        return
      }

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

    // 1. Check URL hash first (for already logged in users)
    if (handleJoinHash(hash, setPendingInviteCode, setActiveView)) return

    // 2. Check localStorage (for NEW users returning from an email confirmation new tab)
    const storedInvite = localStorage.getItem('tourneyhub-invite')
    if (storedInvite) {
      localStorage.removeItem('tourneyhub-invite')
      setPendingInviteCode(storedInvite)
      history.replaceState({ view: 'home' }, '', '#/home')
      setActiveView('home')
      return
    }

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