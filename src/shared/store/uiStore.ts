// src/shared/store/uiStore.ts
import { create } from 'zustand'
import type { ActiveView, ToastMsg, ConfirmModalCfg } from '../types'

export interface UIStore {
  // Mobile / layout state
  sidebarOpen:    boolean
  mobileMenuOpen: boolean
  setSidebarOpen:    (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void

  // Navigation
  activeView:           ActiveView
  setActiveView:        (v: ActiveView) => void
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
  confirmModal:      ConfirmModalCfg | null
  setConfirmModal:   (cfg: ConfirmModalCfg | null) => void

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
  pushToast: (text, type = 'info') =>
    set((state) => {
      const id = Date.now()
      return { toasts: [...state.toasts, { id, text, type }] }
    }),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))