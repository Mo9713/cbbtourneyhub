// src/shared/store/uiStore.ts
import { create } from 'zustand'
import type { ActiveView, ToastMsg, ConfirmModalCfg } from '../types'

let _toastId = 0

export interface UIStore {
  activeView:           ActiveView
  setActiveView:        (v: ActiveView) => void
  activeGroupId:        string | null
  setActiveGroup:       (id: string | null) => void
  selectedTournamentId: string | null
  selectTournament:     (id: string | null) => void

  // Ticker State
  tickerSegmentIndex:    number
  setTickerSegmentIndex: (index: number) => void

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

  pendingInviteCode:     string | null
  setPendingInviteCode: (code: string | null) => void

  snoopTargetId: string | null
  snoopTournamentId?: string | null
  openSnoop:     (id: string, tournamentId?: string) => void
  closeSnoop:    () => void

  confirmModal:    ConfirmModalCfg | null
  setConfirmModal: (cfg: ConfirmModalCfg | null) => void

  toasts:       ToastMsg[]
  pushToast:    (text: string, type?: ToastMsg['type']) => void
  removeToast: (id: number) => void
}

export const useUIStore = create<UIStore>((set) => ({
  activeView:           'home',
  setActiveView:        (v) => set({ activeView: v }),
  activeGroupId:        null,
  setActiveGroup:       (id) => set({ activeGroupId: id }),
  selectedTournamentId: null,
  selectTournament:     (id) => set({ selectedTournamentId: id }),

  // Ticker Initial State
  tickerSegmentIndex: 0,
  setTickerSegmentIndex: (index) => set({ tickerSegmentIndex: index }),

  showAddTournament:  false,
  openAddTournament:  () => set({ showAddTournament: true }),
  closeAddTournament: () => set({ showAddTournament: false }),

  isCreateGroupOpen: false,
  isJoinGroupOpen:   false,
  openCreateGroup:   () => set({ isCreateGroupOpen: true }),
  closeCreateGroup:  () => set({ isCreateGroupOpen: false }),
  openJoinGroup:     () => set({ isJoinGroupOpen: true }),
  closeJoinGroup:    () => set({ isJoinGroupOpen: false }),

  pendingInviteCode:     null,
  setPendingInviteCode: (code) => set({ pendingInviteCode: code }),

  snoopTargetId: null,
  snoopTournamentId: null,
  openSnoop:     (id, tournamentId) => set({ snoopTargetId: id, snoopTournamentId: tournamentId }),
  closeSnoop:    () => set({ snoopTargetId: null, snoopTournamentId: null }),

  confirmModal:    null,
  setConfirmModal: (cfg) => set({ confirmModal: cfg }),

  toasts: [],

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