// src/app/hooks/useHashRouter.ts
//
// Syncs Zustand activeView ↔ window.location.hash so the browser's
// native back/forward buttons work without a full router library.
//
// Contract:
//   - When activeView changes in Zustand → pushState a new history entry (#view)
//   - When user presses Back/Forward   → popstate fires → setActiveView()
//   - On mount                         → read existing hash and honour it
//
// The fromPopState ref prevents a double-push loop: popstate sets activeView,
// which triggers the sync effect, which would push a duplicate entry without it.

import { useEffect, useRef } from 'react'
import { useUIStore }        from '../../shared/store/uiStore'
import type { ActiveView }   from '../../shared/types'

const VALID: ReadonlySet<string> = new Set([
  'home', 'bracket', 'leaderboard', 'admin', 'settings',
])

function fromHash(hash: string): ActiveView | null {
  const v = hash.replace(/^#/, '')
  return VALID.has(v) ? (v as ActiveView) : null
}

export function useHashRouter(): void {
  const activeView    = useUIStore(s => s.activeView)
  const setActiveView = useUIStore(s => s.setActiveView)
  const fromPopState  = useRef(false)

  // ── activeView → URL ───────────────────────────────────────
  useEffect(() => {
    if (fromPopState.current) {
      fromPopState.current = false
      return
    }
    const target = `#${activeView}`
    if (window.location.hash !== target) {
      history.pushState({ view: activeView }, '', target)
    }
  }, [activeView])

  // ── popstate (Back/Forward) → activeView ──────────────────
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const view =
        (e.state?.view as ActiveView | undefined) ??
        fromHash(window.location.hash)
      if (view) {
        fromPopState.current = true
        setActiveView(view)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveView])

  // ── Mount: stamp the initial history entry ─────────────────
  // If the user navigated directly to /#leaderboard, honour it.
  // Either way, replaceState stamps the initial entry so popstate
  // always has a .state.view to fall back on.
  useEffect(() => {
    const hashView = fromHash(window.location.hash)
    if (hashView && hashView !== activeView) {
      fromPopState.current = true
      setActiveView(hashView)
    }
    history.replaceState(
      { view: hashView ?? activeView },
      '',
      `#${hashView ?? activeView}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}