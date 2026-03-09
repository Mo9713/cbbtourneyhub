// src/store/uiStore.ts
import { create } from 'zustand'
import type { ActiveView, ConfirmModalCfg, ToastMsg } from '../shared/types'

// ── Future Feature Placeholders ───────────────────────────────
// Feature 3: Visual Bracket Layout Engine
export type BracketLayoutMode = 'columns' | 'traditional' | 'compact'

// ── Helpers ───────────────────────────────────────────────────

function readNavSession(): { activeView: ActiveView; selectedTournamentId: string | null } {
  try {
    const raw = sessionStorage.getItem('app_nav_state')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { activeView: 'home', selectedTournamentId: null }
}

function writeNavSession(activeView: ActiveView, selectedTournamentId: string | null) {
  try {
    sessionStorage.setItem('app_nav_state', JSON.stringify({ activeView, selectedTournamentId }))
  } catch {}
}

// ── Store Shape ───────────────────────────────────────────────

interface UIStore {
  // Navigation (persisted to sessionStorage)
  activeView:            ActiveView
  selectedTournamentId:  string | null
  setActiveView:         (v: ActiveView) => void
  selectTournament:      (id: string) => void
  navigateHome:          () => void

  // Layout
  sidebarOpen:           boolean
  mobileMenuOpen:        boolean
  setSidebarOpen:        (v: boolean) => void
  setMobileMenuOpen:     (v: boolean) => void

  // Feature 3 placeholder — bracket display mode
  bracketLayoutMode:     BracketLayoutMode
  setBracketLayoutMode:  (mode: BracketLayoutMode) => void

  // Modals
  showAddTournament:     boolean
  snoopTargetId:         string | null
  confirmModal:          ConfirmModalCfg | null
  openAddTournament:     () => void
  closeAddTournament:    () => void
  openSnoop:             (id: string) => void
  closeSnoop:            () => void
  setConfirmModal:       (cfg: ConfirmModalCfg | null) => void

  // Toasts
  toasts:                ToastMsg[]
  pushToast:             (text: string, type?: ToastMsg['type']) => void
  dismissToast:          (id: number) => void
}

// ── Store ─────────────────────────────────────────────────────

const savedNav = readNavSession()

export const useUIStore = create<UIStore>((set) => ({
  // Navigation — rehydrated from sessionStorage on boot
  activeView:           savedNav.activeView,
  selectedTournamentId: savedNav.selectedTournamentId,

  setActiveView: (v) => {
    set((s) => {
      writeNavSession(v, s.selectedTournamentId)
      return { activeView: v }
    })
  },
  selectTournament: (id) => {
    writeNavSession('bracket', id)
    set({ selectedTournamentId: id, activeView: 'bracket' })
  },
  navigateHome: () => {
    writeNavSession('home', null)
    set({ selectedTournamentId: null, activeView: 'home' })
  },

  // Layout
  sidebarOpen:      true,
  mobileMenuOpen:   false,
  setSidebarOpen:   (v) => set({ sidebarOpen: v }),
  setMobileMenuOpen:(v) => set({ mobileMenuOpen: v }),

  // Feature 3 placeholder
  bracketLayoutMode:    'columns',
  setBracketLayoutMode: (mode) => set({ bracketLayoutMode: mode }),

  // Modals
  showAddTournament: false,
  snoopTargetId:     null,
  confirmModal:      null,
  openAddTournament:  () => set({ showAddTournament: true }),
  closeAddTournament: () => set({ showAddTournament: false }),
  openSnoop:          (id) => set({ snoopTargetId: id }),
  closeSnoop:         () => set({ snoopTargetId: null }),
  setConfirmModal:    (cfg) => set({ confirmModal: cfg }),

  // Toasts
  toasts:      [],
  pushToast:   (text, type = 'success') => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))




