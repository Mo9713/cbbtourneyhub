// src/shared/lib/time.ts
// ─────────────────────────────────────────────────────────────
// All timestamp utilities for the bracket app.
//
// ARCHITECTURE RULE: Lock / unlock MATH uses ONLY epoch milliseconds.
// isPicksLocked() NEVER receives a timezone preference.
// Timezone preferences are used ONLY in display formatting fns.
// ─────────────────────────────────────────────────────────────

import type { Tournament } from '../types'

/**
 * Converts a Supabase UTC ISO 8601 string to epoch milliseconds.
 */
export function parseTournamentTimestamp(iso: string): number {
  return Date.parse(iso)
}

/**
 * Evaluates the active picking round for a Survivor tournament based on discrete lock times.
 * Returns the lowest round number (1-6) that is currently open, or 0 if all are locked.
 */
export function getActiveSurvivorRound(tournament: Tournament | null): number {
  if (!tournament || tournament.status !== 'open') return 0
  if (!tournament.round_locks) return 1 // Fallback if no locks configured

  const now = Date.now()
  
  for (let r = 1; r <= 6; r++) {
    const lockIso = tournament.round_locks[r]
    // W-12 FIX: A missing lock time means the round hasn't locked yet.
    if (!lockIso) return r
    if (now < parseTournamentTimestamp(lockIso)) return r
  }
  
  return 0 // All configured rounds are in the past
}

/**
 * Returns true if picks should currently be locked for the tournament.
 * Admins are never locked out (is_admin short-circuits to false).
 */
export function isPicksLocked(tournament: Tournament, _isAdmin = false): boolean {
  if (tournament.status === 'draft' || tournament.status === 'locked') return true
  
  if (tournament.game_type === 'survivor') {
    return getActiveSurvivorRound(tournament) === 0
  }

  const now = Date.now()
  if (tournament.unlocks_at && now < parseTournamentTimestamp(tournament.unlocks_at)) return true
  if (tournament.locks_at && now >= parseTournamentTimestamp(tournament.locks_at)) return true

  return false
}

/**
 * Returns true if the tournament's picks window is not yet open.
 */
export function isBeforeUnlock(tournament: Tournament): boolean {
  if (!tournament.unlocks_at) return false
  return Date.now() < parseTournamentTimestamp(tournament.unlocks_at)
}

/**
 * Returns the milliseconds until a tournament's picks window opens.
 */
export function msUntilUnlock(tournament: Tournament): number | null {
  if (!tournament.unlocks_at) return null
  const ms = parseTournamentTimestamp(tournament.unlocks_at) - Date.now()
  return ms > 0 ? ms : null
}

/**
 * Returns the milliseconds until a tournament (or active survivor round) locks.
 */
export function msUntilLock(tournament: Tournament): number | null {
  // FIX: If survivor, measure time to the specific round lock
  if (tournament.game_type === 'survivor') {
    const activeRound = getActiveSurvivorRound(tournament)
    if (activeRound === 0) return null
    // FIX: Removed String() cast, activeRound is already a number
    const lockStr = tournament.round_locks?.[activeRound]
    if (!lockStr) return null
    const ms = parseTournamentTimestamp(lockStr) - Date.now()
    return ms > 0 ? ms : null
  }

  // Standard lock logic
  if (!tournament.locks_at) return null
  const ms = parseTournamentTimestamp(tournament.locks_at) - Date.now()
  return ms > 0 ? ms : null
}

/**
 * Formats a millisecond duration as "H:MM:SS" for countdown display.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00'
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const DEFAULT_DISPLAY_TZ = 'America/Chicago'

/**
 * Formats a UTC ISO timestamp for display in the user's preferred timezone.
 */
export function formatInUserTz(iso: string, timezone: string | null): string {
  const tz = timezone ?? DEFAULT_DISPLAY_TZ
  return new Date(iso).toLocaleString('en-US', {
    timeZone:     tz,
    month:        'short',
    day:          'numeric',
    hour:         'numeric',
    minute:       '2-digit',
    hour12:       true,
    timeZoneName: 'short',
  })
}

/** @deprecated Use formatInUserTz(iso, null) instead. */
export function formatCSTDisplay(iso: string): string {
  return formatInUserTz(iso, null)
}

function getDatePartsInTz(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10)
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour') % 24, minute: get('minute'), second: get('second'),
  }
}

/** Converts a UTC ISO string to a `datetime-local` input value */
export function isoToInputInTz(iso: string | null, timezone: string | null): string {
  if (!iso) return ''
  const tz = timezone ?? DEFAULT_DISPLAY_TZ
  const p  = getDatePartsInTz(new Date(iso), tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** @deprecated Use isoToInputInTz(iso, null) instead. */
export function isoToInputCST(iso: string | null): string {
  return isoToInputInTz(iso, null)
}

/** Converts a `datetime-local` input value to a UTC ISO 8601 string */
export function inputInTzToISO(local: string, timezone: string | null): string | null {
  if (!local) return null
  const tz = timezone ?? DEFAULT_DISPLAY_TZ
  const naiveUtc = new Date(`${local}:00Z`)
  const p = getDatePartsInTz(naiveUtc, tz)
  const wallAsUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offsetMs   = naiveUtc.getTime() - wallAsUtcMs
  const localAsUtc = new Date(`${local}:00Z`)
  return new Date(localAsUtc.getTime() + offsetMs).toISOString()
}

/** @deprecated Use inputInTzToISO(local, null) instead. */
export function cstInputToISO(local: string): string | null {
  return inputInTzToISO(local, null)
}

export interface TimezoneOption { label: string; value: string }

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: 'Eastern Time — New York (ET)',       value: 'America/New_York'    },
  { label: 'Central Time — Chicago (CT)',        value: 'America/Chicago'     },
  { label: 'Mountain Time — Denver (MT)',        value: 'America/Denver'      },
  { label: 'Mountain Time — Phoenix (no DST)',   value: 'America/Phoenix'     },
  { label: 'Pacific Time — Los Angeles (PT)',    value: 'America/Los_Angeles' },
  { label: 'Alaska Time (AKT)',                  value: 'America/Anchorage'   },
  { label: 'Hawaii Time (HT)',                   value: 'Pacific/Honolulu'    },
  { label: 'Atlantic Time — Halifax (AT)',       value: 'America/Halifax'     },
  { label: 'Central Time — Winnipeg (CT)',       value: 'America/Winnipeg'    },
  { label: 'Pacific Time — Vancouver (PT)',      value: 'America/Vancouver'   },
  { label: 'UTC (Coordinated Universal Time)',   value: 'UTC'                 },
  { label: 'London (GMT / BST)',                 value: 'Europe/London'       },
  { label: 'Paris / Berlin (CET / CEST)',        value: 'Europe/Paris'        },
  { label: 'Helsinki / Kyiv (EET / EEST)',       value: 'Europe/Helsinki'     },
  { label: 'Dubai (GST, UTC+4)',                 value: 'Asia/Dubai'          },
  { label: 'India (IST, UTC+5:30)',              value: 'Asia/Kolkata'        },
  { label: 'Bangkok / Jakarta (ICT, UTC+7)',     value: 'Asia/Bangkok'        },
  { label: 'China / Singapore (CST, UTC+8)',     value: 'Asia/Shanghai'       },
  { label: 'Japan / Korea (JST, UTC+9)',         value: 'Asia/Tokyo'          },
  { label: 'Sydney (AEST / AEDT)',               value: 'Australia/Sydney'    },
  { label: 'Auckland (NZST / NZDT)',             value: 'Pacific/Auckland'    },
]

export function timezoneLabelFor(value: string | null): string {
  if (!value) return 'Central Time — Chicago (CT)'
  return TIMEZONE_OPTIONS.find(o => o.value === value)?.label ?? value
}