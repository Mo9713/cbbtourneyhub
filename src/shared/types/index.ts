// src/shared/types/index.ts

// ── Primitives ────────────────────────────────────────────────
export type TournamentStatus = 'draft' | 'open' | 'locked'
export type ThemeKey         = 'ember' | 'ice' | 'plasma' | 'forest'
export type ActiveView       = 'home' | 'bracket' | 'leaderboard' | 'admin' | 'settings'
export type TemplateKey      = 'blank' | 'standard' | 'bigdance'
export type UIMode           = 'light' | 'dark'

// ── Scoring ───────────────────────────────────────────────────
export type ScoringConfig = Record<string, number>

export function resolveScore(roundNum: number, config?: ScoringConfig | null): number {
  if (config) {
    const custom = config[String(roundNum)]
    if (typeof custom === 'number') return custom
  }
  return fibonacci(roundNum + 1)
}

function fibonacci(n: number): number {
  if (n <= 0) return 0
  if (n === 1 || n === 2) return 1
  let a = 1, b = 1
  for (let i = 3; i <= n; i++) { const c = a + b; a = b; b = c }
  return b
}

// ── Domain Types ──────────────────────────────────────────────
export interface Profile {
  id:            string
  display_name:  string
  is_admin:      boolean
  theme:         ThemeKey
  avatar_url:    string | null
  ui_mode:       UIMode
  /**
   * IANA timezone for display only. Never use in lock/epoch math.
   * NULL = fall back to app default (America/Chicago).
   */
  timezone:      string | null
}

export interface Tournament {
  id:                  string
  name:                string
  status:              TournamentStatus
  unlocks_at:          string | null
  locks_at:            string | null
  round_names:         string[]
  scoring_config:      ScoringConfig | null
  requires_tiebreaker: boolean
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
}

export interface Pick {
  id:               string
  user_id:          string
  game_id:          string
  predicted_winner: string
  tiebreaker_score: number | null
}

// ── UI / Utility Types ────────────────────────────────────────
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

export interface SVGLine {
  x1: number; y1: number; x2: number; y2: number
  gameId:   string
  fromSlot: 'in1' | 'in2'
}

// ── Service Layer ─────────────────────────────────────────────
export type ServiceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }