// src/types/index.ts

export type TournamentStatus = 'draft' | 'open' | 'locked'
export type ThemeKey = 'ember' | 'ice' | 'plasma' | 'forest'
export type ActiveView = 'home' | 'bracket' | 'leaderboard' | 'admin' | 'settings'
export type TemplateKey = 'blank' | 'standard' | 'bigdance'

export interface Profile {
  id: string
  display_name: string
  is_admin: boolean
  theme: ThemeKey
  avatar_url: string | null
  favorite_team: string | null
}

export interface Tournament {
  id: string
  name: string
  status: TournamentStatus
  unlocks_at: string | null
  locks_at: string | null
}

export interface Game {
  id: string
  tournament_id: string
  round_num: number
  team1_name: string
  team2_name: string
  actual_winner: string | null
  next_game_id: string | null
  sort_order: number | null
  region?: string | null
}

export interface Pick {
  id: string
  user_id: string
  game_id: string
  predicted_winner: string
}

export interface ToastMsg {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

export interface ConfirmModalCfg {
  title: string
  message: string
  confirmLabel?: string
  dangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export interface SVGLine {
  x1: number; y1: number; x2: number; y2: number
  gameId: string; fromSlot: 'in1' | 'in2'
}