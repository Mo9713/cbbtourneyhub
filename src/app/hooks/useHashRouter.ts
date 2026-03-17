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

export function useHashRouter(): void {
  const activeView    = useUIStore(s => s.activeView)
  const setActiveView = useUIStore(s => s.setActiveView)
  const activeGroupId = useUIStore(s => s.activeGroupId)
  const setActiveGroup = useUIStore(s => s.setActiveGroup)
  const fromPopState  = useRef(false)

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

  // ── hashchange ──
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash
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
  }, [setActiveView, setActiveGroup])

  // ── popstate (Back/Forward) ──
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

  // ── Mount: Initial Sync ──
  useEffect(() => {
    const hash       = window.location.hash
    const groupMatch = hash.match(/#\/?group\/([^/?]+)/)
    const hashView   = fromHash(hash)

    if (groupMatch?.[1]) {
      fromPopState.current = true
      setActiveGroup(groupMatch[1])
      setActiveView('group')
    } else if (hashView && hashView !== activeView) {
      fromPopState.current = true
      setActiveView(hashView)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}