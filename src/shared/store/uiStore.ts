// src/shared/store/uiStore.ts
//
// MOD-05 FIX: pushToast no longer registers setTimeout inside the
// Zustand set() producer. React 18 StrictMode double-invokes producers
// in development, which caused duplicate timers. A monotonically
// increasing counter (_toastId) replaces Date.now() to prevent ID
// collisions on rapid back-to-back toast calls within the same
// event-loop tick.

import { create } from 'zustand'
import type { ActiveView, ToastMsg, ConfirmModalCfg } from '../types'

// Monotonic counter — never collides regardless of call frequency.
let _toastId = 0

export interface UIStore {
  // Mobile / layout state
  sidebarOpen:    boolean
  mobileMenuOpen: boolean
  setSidebarOpen:    (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void

  // Navigation & Context
  activeView:           ActiveView
  setActiveView:        (v: ActiveView) => void
  activeGroupId:        string | null
  setActiveGroup:       (id: string | null) => void
  selectedTournamentId: string | null
  selectTournament:     (id: string | null) => void

  // Creation modal (Tournament)
  showAddTournament:  boolean
  openAddTournament:  () => void
  closeAddTournament: () => void

  // Group Management modals
  isCreateGroupOpen: boolean
  isJoinGroupOpen:   boolean
  openCreateGroup:   () => void
  closeCreateGroup:  () => void
  openJoinGroup:     () => void
  closeJoinGroup:    () => void

  // Snoop
  snoopTargetId: string | null
  openSnoop:     (id: string) => void
  closeSnoop:    () => void

  // Confirm
  confirmModal:    ConfirmModalCfg | null
  setConfirmModal: (cfg: ConfirmModalCfg | null) => void

  // Toasts
  toasts:      ToastMsg[]
  pushToast:   (text: string, type?: ToastMsg['type']) => void
  removeToast: (id: number) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen:    true,
  mobileMenuOpen: false,
  setSidebarOpen:    (open) => set({ sidebarOpen: open }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  activeView:           'home',
  setActiveView:        (v) => set({ activeView: v }),
  activeGroupId:        null,
  setActiveGroup:       (id) => set({ activeGroupId: id }),
  selectedTournamentId: null,
  selectTournament:     (id) => set({ selectedTournamentId: id, mobileMenuOpen: false }),

  showAddTournament:  false,
  openAddTournament:  () => set({ showAddTournament: true }),
  closeAddTournament: () => set({ showAddTournament: false }),

  isCreateGroupOpen: false,
  isJoinGroupOpen:   false,
  openCreateGroup:   () => set({ isCreateGroupOpen: true }),
  closeCreateGroup:  () => set({ isCreateGroupOpen: false }),
  openJoinGroup:     () => set({ isJoinGroupOpen: true }),
  closeJoinGroup:    () => set({ isJoinGroupOpen: false }),

  snoopTargetId: null,
  openSnoop:     (id) => set({ snoopTargetId: id }),
  closeSnoop:    () => set({ snoopTargetId: null }),

  confirmModal:    null,
  setConfirmModal: (cfg) => set({ confirmModal: cfg }),

  toasts: [],

  // setTimeout is registered OUTSIDE the set() producer to prevent
  // React 18 StrictMode double-invocation from creating duplicate timers.
  pushToast: (text, type = 'info') => {
    const id = ++_toastId
    set((state) => ({ toasts: [...state.toasts, { id, text, type }] }))
    setTimeout(() => useUIStore.getState().removeToast(id), 4_000)
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))