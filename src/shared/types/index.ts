// src/shared/types/index.ts
// Pure type definitions only. No runtime functions live here.
// resolveScore() → shared/lib/bracketMath.ts
// SVGLine        → deleted; use ConnectorLine from shared/lib/bracketMath.ts

// ── Primitives ────────────────────────────────────────────────
export type TournamentStatus = 'draft' | 'open' | 'locked'
export type ThemeKey         = 'ember' | 'ice' | 'plasma' | 'forest'
export type ActiveView       = 'home' | 'bracket' | 'leaderboard' | 'admin' | 'settings'
export type TemplateKey      = 'blank' | 'standard' | 'bigdance'
export type UIMode           = 'light' | 'dark'

// ── Scoring ───────────────────────────────────────────────────
export type ScoringConfig = Record<string, number>

// ── Domain Types ──────────────────────────────────────────────
export interface Profile {
  id:            string
  display_name:  string
  is_admin:      boolean
  theme:         ThemeKey
  avatar_url:    string | null
  ui_mode:       UIMode
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
  // ── Display fields (broadcast aesthetic) ──────────────────
  // Optional — only populated when the admin sets them.
  // Stored as TEXT in the DB so values like "(1)" or "OT 88" are valid.
  team1_seed?:   number | string
  team2_seed?:   number | string
  team1_score?:  number | string
  team2_score?:  number | string
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

// ── Service Layer ─────────────────────────────────────────────
export type ServiceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }