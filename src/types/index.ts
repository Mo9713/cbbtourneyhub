// src/types/index.ts

// ── Primitives ────────────────────────────────────────────────
export type TournamentStatus = 'draft' | 'open' | 'locked'
export type ThemeKey         = 'ember' | 'ice' | 'plasma' | 'forest'
export type ActiveView       = 'home' | 'bracket' | 'leaderboard' | 'admin' | 'settings'
export type TemplateKey      = 'blank' | 'standard' | 'bigdance'

/**
 * UI rendering mode. Stored on Profile and persisted to Supabase.
 * 'dark'  — current default, dark slate palette
 * 'light' — inverted, light-background palette
 *
 * This is SEPARATE from ThemeKey (ember/ice/plasma/forest). A user can
 * pick "ember" theme in either light or dark mode.
 */
export type UIMode = 'light' | 'dark'

// ── Scoring ───────────────────────────────────────────────────
/**
 * Custom scoring config stored on a Tournament.
 * Keys are round_num values cast to strings (e.g. "1", "2", …).
 * A missing key falls back to Fibonacci for that round.
 */
export type ScoringConfig = Record<string, number>

/**
 * Returns the point value for a given round, respecting custom
 * scoring config if present, otherwise falling back to Fibonacci.
 */
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
  id:             string
  display_name:   string
  is_admin:       boolean
  theme:          ThemeKey
  avatar_url:     string | null
  favorite_team:  string | null
  /**
   * Light or dark mode preference. Defaults to 'dark'.
   * Persisted to Supabase `profiles.ui_mode`.
   */
  ui_mode:        UIMode
  /**
   * IANA timezone identifier for UI display ONLY.
   * e.g. 'America/New_York', 'America/Chicago', 'Europe/London', 'UTC'
   *
   * ⚠️  NEVER pass this into isPicksLocked() or any epoch comparison.
   *     It is used exclusively by formatting functions (formatInUserTz,
   *     isoToInputInTz) to render timestamps in the user's local time.
   *
   * NULL = fall back to app default (America/Chicago).
   */
  timezone:       string | null
}

export interface Tournament {
  id:                   string
  name:                 string
  status:               TournamentStatus
  unlocks_at:           string | null
  locks_at:             string | null
  /** Ordered labels for each round. Index = round_num - 1. Empty = use default getRoundLabel(). */
  round_names:          string[]
  /** Custom points per round. NULL = Fibonacci. */
  scoring_config:       ScoringConfig | null
  /** If true, users must predict a final score for the championship game. */
  requires_tiebreaker:  boolean
}

export interface Game {
  id:             string
  tournament_id:  string
  round_num:      number
  team1_name:     string
  team2_name:     string
  actual_winner:  string | null
  next_game_id:   string | null
  sort_order:     number | null
  region?:        string | null
}

export interface Pick {
  id:                string
  user_id:           string
  game_id:           string
  predicted_winner:  string
  /**
   * Predicted total score for the championship team.
   * Only relevant when tournament.requires_tiebreaker = true.
   */
  tiebreaker_score:  number | null
}

// ── UI / Utility Types ────────────────────────────────────────
export interface ToastMsg {
  id:    number
  text:  string
  type:  'success' | 'error' | 'info'
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

// ── Service Layer Result Wrapper ──────────────────────────────
/**
 * Standard result type for all service functions.
 * Allows callers to handle errors uniformly without try/catch at every call site.
 */
export type ServiceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }
