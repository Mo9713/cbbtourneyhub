// src/shared/lib/time.ts
// ─────────────────────────────────────────────────────────────
// All timestamp utilities for the bracket app.
//
// ╔══════════════════════════════════════════════════════════╗
// ║  CRITICAL ARCHITECTURE RULE — READ BEFORE EDITING        ║
// ╠══════════════════════════════════════════════════════════╣
// ║  Lock / unlock MATH uses ONLY epoch milliseconds:        ║
// ║    • Date.now()       — current time as epoch ms         ║
// ║    • Date.parse(iso)  — UTC ISO string → epoch ms        ║
// ║  These are spec-guaranteed to be timezone-agnostic.      ║
// ║  isPicksLocked() NEVER receives a timezone preference.   ║
// ║                                                          ║
// ║  Timezone preferences are used ONLY in display fns:      ║
// ║    • formatInUserTz()   — render a timestamp string      ║
// ║    • isoToInputInTz()   — populate datetime-local input  ║
// ║    • inputInTzToISO()   — parse datetime-local input     ║
// ║  The Countdown component uses tz for label text ONLY.    ║
// ╚══════════════════════════════════════════════════════════╝
// ─────────────────────────────────────────────────────────────

import type { Tournament } from '../types'

// ─────────────────────────────────────────────────────────────
// § 1. Safe UTC Epoch Parser
// ─────────────────────────────────────────────────────────────

/**
 * Converts a Supabase UTC ISO 8601 string to epoch milliseconds.
 *
 * Uses Date.parse() which is spec-guaranteed (ECMA-262) to parse
 * ISO 8601 strings correctly across all modern browsers, returning
 * UTC epoch ms regardless of the browser's local timezone setting.
 */
export function parseTournamentTimestamp(iso: string): number {
  return Date.parse(iso)
}

// ─────────────────────────────────────────────────────────────
// § 2. Lock Logic  (epoch-only, ZERO timezone involvement)
// ─────────────────────────────────────────────────────────────

/**
 * Evaluates the active picking round for a Survivor tournament based on discrete lock times.
 * Returns the lowest round number (1-6) that is currently open.
 * Returns 0 if all rounds are locked or the tournament is not open.
 */
export function getActiveSurvivorRound(tournament: Tournament | null): number {
  if (!tournament || tournament.status !== 'open') return 0
  if (!tournament.round_locks) return 1 // Fallback if no locks configured

  const now = Date.now()
  
  // Find the first round that locks AFTER the current time
  for (let r = 1; r <= 6; r++) {
    const lockIso = tournament.round_locks[r]
    
    // W-12 FIX: A missing lock time means the round hasn't locked yet.
    // Previously, this used `continue`, which skipped to the next round,
    // incorrectly hiding open rounds from the user.
    if (!lockIso) return r
    
    if (now < parseTournamentTimestamp(lockIso)) {
      return r
    }
  }
  
  return 0 // All configured rounds are in the past
}

/**
 * Returns true if picks should currently be locked for the tournament.
 *
 * Comparison: Date.now() vs Date.parse(locks_at) — both are epoch ms.
 * No locale, no timezone conversion, no browser variance.
 *
 * Admins are never locked out (is_admin short-circuits to false).
 *
 * This is the ONLY function the app should call to determine lock state.
 * The <Countdown> component calls this same function on every tick to
 * drive live UI updates — it does NOT pass a timezone to this function.
 */
export function isPicksLocked(tournament: Tournament, _isAdmin = false): boolean {
  // Admins must obey the time locks for their own picks just like regular users!
  
  if (tournament.status === 'draft' || tournament.status === 'locked') return true
  
  // Diverge logic for Survivor mode
  if (tournament.game_type === 'survivor') {
    return getActiveSurvivorRound(tournament) === 0
  }

  const now = Date.now()

  // 1. Lock the bracket if we haven't reached the unlock time yet
  if (tournament.unlocks_at && now < parseTournamentTimestamp(tournament.unlocks_at)) {
    return true
  }

  // 2. Lock the bracket if we have passed the lock time
  if (tournament.locks_at && now >= parseTournamentTimestamp(tournament.locks_at)) {
    return true
  }

  return false
}

/**
 * Returns true if the tournament's picks window is not yet open
 * (i.e., we are before unlocks_at).
 *
 * A null unlocks_at means there is no scheduled open time — picks
 * are considered available immediately (when status is 'open').
 *
 * Like isPicksLocked, this is epoch-only and timezone-agnostic.
 */
export function isBeforeUnlock(tournament: Tournament): boolean {
  if (!tournament.unlocks_at) return false
  return Date.now() < parseTournamentTimestamp(tournament.unlocks_at)
}

/**
 * Returns the milliseconds until a tournament's picks window opens,
 * or null if unlocks_at is not set or is already in the past.
 * Used by <Countdown> to drive the "Unlocks in X:XX:XX" display.
 */
export function msUntilUnlock(tournament: Tournament): number | null {
  if (!tournament.unlocks_at) return null
  const ms = parseTournamentTimestamp(tournament.unlocks_at) - Date.now()
  return ms > 0 ? ms : null
}

/**
 * Returns the milliseconds until a tournament locks,
 * or null if locks_at is not set or is already in the past.
 * Used by <Countdown> to drive the "Locks in X:XX:XX" display.
 */
export function msUntilLock(tournament: Tournament): number | null {
  if (!tournament.locks_at) return null
  const ms = parseTournamentTimestamp(tournament.locks_at) - Date.now()
  return ms > 0 ? ms : null
}

// ─────────────────────────────────────────────────────────────
// § 3. Duration Formatting  (display only, no dates involved)
// ─────────────────────────────────────────────────────────────

/**
 * Formats a millisecond duration as "H:MM:SS" for countdown display.
 * e.g. 3723000 → "1:02:03"
 * e.g.  125000 → "0:02:05"
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00'
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// § 4. Display Formatting  (timezone-aware, UI render only)
// ─────────────────────────────────────────────────────────────

/** The app's default display timezone. Used when profile.timezone is null. */
export const DEFAULT_DISPLAY_TZ = 'America/Chicago'

/**
 * Formats a UTC ISO timestamp for display in the user's preferred timezone.
 *
 * @param iso      - UTC ISO 8601 string from Supabase (e.g. "2026-03-15T19:00:00Z")
 * @param timezone - IANA timezone from profile.timezone, or null to use DEFAULT_DISPLAY_TZ
 *
 * Output example: "Mar 15, 7:00 PM CT"  (with tz abbreviation via timeZoneName: 'short')
 *
 * ⚠️  This is for DISPLAY ONLY. Never pass the returned string into Date() or
 * use it for any comparison. It is a human-readable label, nothing more.
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

/**
 * @deprecated Use formatInUserTz(iso, null) instead.
 * Retained for backward compatibility during the refactor transition.
 * Will be removed once all callers have been updated.
 */
export function formatCSTDisplay(iso: string): string {
  return formatInUserTz(iso, null)
}

// ─────────────────────────────────────────────────────────────
// § 5. Admin Input Conversion  (timezone-aware, UI render only)
// ─────────────────────────────────────────────────────────────

/**
 * Internal helper: returns the component parts of a Date in a
 * specific IANA timezone, without any locale string parsing.
 *
 * Uses en-US with hour12: false so 'hour' is 0-23.
 * The % 24 guard handles the rare browser quirk where midnight
 * returns 24 instead of 0 in hour12: false mode.
 */
function getDatePartsInTz(
  date: Date,
  tz:   string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year:     'numeric',
    month:    'numeric',
    day:      'numeric',
    hour:     'numeric',
    minute:   'numeric',
    second:   'numeric',
    hour12:   false,
  }).formatToParts(date)

  const get = (type: string) =>
    parseInt(parts.find(p => p.type === type)?.value ?? '0', 10)

  return {
    year:   get('year'),
    month:  get('month'),
    day:    get('day'),
    hour:   get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

/**
 * Converts a UTC ISO string to a `datetime-local` input value
 * expressed in the given IANA timezone.
 *
 * Used by AdminBuilderView to populate the Unlocks/Locks At inputs
 * so the admin sees the time in their own timezone, not always CT.
 *
 * @param iso      - UTC ISO 8601 string, or null (returns '' for empty input)
 * @param timezone - IANA timezone, or null to use DEFAULT_DISPLAY_TZ
 *
 * Output example: "2026-03-15T14:00" (for a datetime-local input)
 */
export function isoToInputInTz(iso: string | null, timezone: string | null): string {
  if (!iso) return ''
  const tz = timezone ?? DEFAULT_DISPLAY_TZ
  const p  = getDatePartsInTz(new Date(iso), tz)

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * @deprecated Use isoToInputInTz(iso, null) instead.
 * Retained for backward compatibility during the refactor transition.
 */
export function isoToInputCST(iso: string | null): string {
  return isoToInputInTz(iso, null)
}

/**
 * Converts a `datetime-local` input value (interpreted in the given
 * IANA timezone) to a UTC ISO 8601 string for storage in Supabase.
 *
 * Algorithm:
 * 1. Parse the input as if it were UTC (naive anchor).
 * 2. Ask Intl what wall-clock time that UTC instant shows in the
 * target timezone — this reveals the offset at that moment
 * (correctly handles DST transitions).
 * 3. Compute: offsetMs = naiveUtc - what_tz_sees_as_utc
 * 4. Result:  trueUtc  = naiveUtc + offsetMs
 *
 * This handles DST ambiguity by always picking the first occurrence
 * (standard time), which is correct for bracket scheduling use cases.
 *
 * @param local    - datetime-local string, e.g. "2026-03-15T14:00"
 * @param timezone - IANA timezone, or null to use DEFAULT_DISPLAY_TZ
 */
export function inputInTzToISO(local: string, timezone: string | null): string | null {
  if (!local) return null
  const tz = timezone ?? DEFAULT_DISPLAY_TZ

  // Step 1: treat the input as UTC to get an anchor Date
  const naiveUtc = new Date(`${local}:00Z`)

  // Step 2: find what the target timezone's wall-clock looks like at naiveUtc
  const p = getDatePartsInTz(naiveUtc, tz)

  // Step 3: reconstruct that wall-clock reading as UTC ms
  const wallAsUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

  // Step 4: offset = (naiveUtc) - (what tz shows as UTC)
  //         trueUtc = naiveUtc_as_localInput + offset
  const offsetMs   = naiveUtc.getTime() - wallAsUtcMs
  const localAsUtc = new Date(`${local}:00Z`)

  return new Date(localAsUtc.getTime() + offsetMs).toISOString()
}

/**
 * @deprecated Use inputInTzToISO(local, null) instead.
 * Retained for backward compatibility during the refactor transition.
 */
export function cstInputToISO(local: string): string | null {
  return inputInTzToISO(local, null)
}

// ─────────────────────────────────────────────────────────────
// § 6. Timezone Options  (for SettingsView selector)
// ─────────────────────────────────────────────────────────────

export interface TimezoneOption {
  label: string
  value: string   // IANA identifier
}

/**
 * Curated list of IANA timezone identifiers for the SettingsView dropdown.
 *
 * Covers US regions (all zones), Canada, major EU cities, and common
 * international zones. Not exhaustive — focused on the bracket app's
 * primary audience (US college basketball fans) with international coverage.
 *
 * All values are valid Intl.DateTimeFormat timezone identifiers.
 */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // ── United States ──────────────────────────────────────────
  { label: 'Eastern Time — New York (ET)',       value: 'America/New_York'    },
  { label: 'Central Time — Chicago (CT)',        value: 'America/Chicago'     },
  { label: 'Mountain Time — Denver (MT)',        value: 'America/Denver'      },
  { label: 'Mountain Time — Phoenix (no DST)',   value: 'America/Phoenix'     },
  { label: 'Pacific Time — Los Angeles (PT)',    value: 'America/Los_Angeles' },
  { label: 'Alaska Time (AKT)',                  value: 'America/Anchorage'   },
  { label: 'Hawaii Time (HT)',                   value: 'Pacific/Honolulu'    },
  // ── Canada ─────────────────────────────────────────────────
  { label: 'Atlantic Time — Halifax (AT)',       value: 'America/Halifax'     },
  { label: 'Central Time — Winnipeg (CT)',       value: 'America/Winnipeg'    },
  { label: 'Pacific Time — Vancouver (PT)',      value: 'America/Vancouver'   },
  // ── UTC ─────────────────────────────────────────────────────
  { label: 'UTC (Coordinated Universal Time)',   value: 'UTC'                 },
  // ── Europe ─────────────────────────────────────────────────
  { label: 'London (GMT / BST)',                 value: 'Europe/London'       },
  { label: 'Paris / Berlin (CET / CEST)',        value: 'Europe/Paris'        },
  { label: 'Helsinki / Kyiv (EET / EEST)',       value: 'Europe/Helsinki'     },
  // ── Asia / Pacific ─────────────────────────────────────────
  { label: 'Dubai (GST, UTC+4)',                 value: 'Asia/Dubai'          },
  { label: 'India (IST, UTC+5:30)',              value: 'Asia/Kolkata'        },
  { label: 'Bangkok / Jakarta (ICT, UTC+7)',     value: 'Asia/Bangkok'        },
  { label: 'China / Singapore (CST, UTC+8)',     value: 'Asia/Shanghai'       },
  { label: 'Japan / Korea (JST, UTC+9)',         value: 'Asia/Tokyo'          },
  { label: 'Sydney (AEST / AEDT)',               value: 'Australia/Sydney'    },
  { label: 'Auckland (NZST / NZDT)',             value: 'Pacific/Auckland'    },
]

/**
 * Returns a user-facing label for a given IANA timezone value,
 * falling back to the raw value if not found in TIMEZONE_OPTIONS.
 */
export function timezoneLabelFor(value: string | null): string {
  if (!value) return 'Central Time — Chicago (CT)'
  return TIMEZONE_OPTIONS.find(o => o.value === value)?.label ?? value
}