// src/shared/types/index.ts
//
// M-03 FIX: 'leaderboard' removed from ActiveView.
// ViewRouter mapped that case to <SettingsPage /> via fall-through,
// making it a phantom route that could never render a leaderboard.
// All leaderboard UX is now exclusively delivered through the
// Standings tab embedded inside BracketView / SurvivorBracketView.
// Removing it from the type union prevents any future code from
// navigating to a ghost state and eliminates the dead guard in
// useRealtimeSync (C-01).

export type TournamentStatus = 'draft' | 'open' | 'locked'
export type ThemeKey         = 'ember' | 'ice' | 'plasma' | 'forest' | 'mono'
export type ActiveView       = 'home' | 'bracket' | 'admin' | 'settings' | 'group'
export type TemplateKey      = 'blank' | 'standard' | 'bigdance'
export type UIMode           = 'light' | 'dark'

export type ScoringConfig = Record<string, number>

export interface ThemeConfig {
  key: ThemeKey
  label: string
  emoji: string
  btn: string
  btnSm: string
  accent: string
  accentB: string
  border: string
  borderB: string
  bg: string
  bgMd: string
  dot: string
  ring: string
  bar: string
  glow: string
  tabActive: string
  headerBg: string
  logo: string
  appBg: string
  sidebarBg: string
  panelBg: string
  inputBg: string
  borderBase: string
  textBase: string
  textMuted: string
}

export interface Profile {
  id:            string
  display_name:  string
  is_admin:      boolean
  theme:         ThemeKey
  avatar_url:    string | null
  ui_mode:       UIMode
  timezone:      string | null
}

export interface Group {
  id:          string
  name:        string
  owner_id:    string
  invite_code: string
  created_at:  string
}

export interface GroupMember {
  group_id:  string
  user_id:   string
  joined_at: string
}

export interface Tournament {
  id:                        string
  name:                      string
  status:                    TournamentStatus
  unlocks_at:                string | null
  locks_at:                  string | null
  round_names:               string[]
  scoring_config:            ScoringConfig | null
  requires_tiebreaker:       boolean
  group_id?:                 string | null
  game_type?:                'bracket' | 'survivor'
  round_locks?:              Record<number, string>
  survivor_elimination_rule?: 'end_early' | 'revive_all'
  show_game_numbers?:        boolean // NEW
}

export interface Game {
  id:            string
  tournament_id: string
  round_num:     number
  team1_name:    string
  team2_name:    string
  actual_winner: string | null
  next_game_id:  string | null
  sort_order:    number | null
  region?:       string | null
  team1_seed?:   number | null
  team2_seed?:   number | null
  team1_score?:  number | string
  team2_score?:  number | string
}

export interface Pick {
  id:               string
  user_id:          string
  game_id:          string
  predicted_winner: string
  tiebreaker_score: number | null
  round_num?:       number
}

export interface ToastMsg {
  id:   number
  text: string
  type: 'success' | 'error' | 'info'
}

export interface ConfirmModalCfg {
  title:         string
  message:       string
  confirmLabel?: string
  dangerous?:    boolean
  onConfirm:     () => void
  onCancel:      () => void
}

export type ServiceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }