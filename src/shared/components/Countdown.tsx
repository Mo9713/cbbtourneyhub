// src/shared/components/Countdown.tsx
import { useState, useEffect } from 'react'
import { Lock, Clock, AlertTriangle } from 'lucide-react'
import { useTheme } from '../utils/theme'
import {
  isBeforeUnlock,
  isPicksLocked,
  msUntilUnlock,
  msUntilLock,
  formatCountdown,
  formatInUserTz,
} from '../utils/time'
import type { Tournament } from '../types'

interface Props {
  tournament: Tournament
  isAdmin:    boolean
  /** profile.timezone — used for display label only, never for lock math. */
  timezone:   string | null
}

// Added 'draft' phase to correctly restore the admin badge
type Phase = 'draft' | 'locked' | 'before-open' | 'open' | 'closing-soon'

const CLOSING_SOON_THRESHOLD_MS = 15 * 60 * 1000  // show urgency under 15 min

function getPhase(tournament: Tournament, isAdmin: boolean): Phase {
  // 1. Status overrides come first
  if (tournament.status === 'draft')          return 'draft'
  
  // 2. MUST check before-open BEFORE isPicksLocked, otherwise the countdown gets hidden!
  if (isBeforeUnlock(tournament))             return 'before-open'
  
  // 3. Now we can safely check if the tournament is completely locked
  if (isPicksLocked(tournament, isAdmin))     return 'locked'
  
  // 4. Otherwise, it is open and ticking down to the close time
  const remaining = msUntilLock(tournament)
  if (remaining !== null && remaining <= CLOSING_SOON_THRESHOLD_MS) return 'closing-soon'
  
  return 'open'
}

export default function Countdown({ tournament, isAdmin, timezone }: Props) {
  const theme = useTheme()

  // Recompute from epoch ms on every tick — no timezone involved.
  const [phase,  setPhase]  = useState<Phase>(() => getPhase(tournament, isAdmin))
  const [msLeft, setMsLeft] = useState<number | null>(() => {
    if (phase === 'before-open') return msUntilUnlock(tournament)
    return msUntilLock(tournament)
  })

  useEffect(() => {
    const tick = () => {
      const nextPhase = getPhase(tournament, isAdmin)
      setPhase(nextPhase)
      setMsLeft(
        nextPhase === 'before-open'
          ? msUntilUnlock(tournament)
          : msUntilLock(tournament)
      )
    }

    tick() // sync immediately on tournament prop change
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tournament, isAdmin])

  // Nothing to show when fully locked with no timestamps, or status is 'locked'
  if (phase === 'locked' && tournament.status === 'locked') return null
  if (phase === 'open' && !tournament.locks_at)            return null

  const countdownStr = msLeft != null ? formatCountdown(msLeft) : null

  // Timezone is used here — purely for the human-readable label.
  const locksAtLabel   = tournament.locks_at   ? formatInUserTz(tournament.locks_at,   timezone) : null
  const unlocksAtLabel = tournament.unlocks_at ? formatInUserTz(tournament.unlocks_at, timezone) : null

  // ── Draft Mode ─────────────────────────────────────────────
  if (phase === 'draft') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
        <AlertTriangle size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Draft Mode - Hidden</span>
      </div>
    )
  }

  // ── Closed / locked by tip-off time ────────────────────────
  if (phase === 'locked') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bg} border ${theme.border}`}>
        <Lock size={11} className="text-slate-500 flex-shrink-0" />
        <span className="text-xs text-slate-500 font-medium">Picks locked</span>
      </div>
    )
  }

  // ── Not yet open (Countdown correctly displayed here) ──────
  if (phase === 'before-open') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20`}>
        <Clock size={11} className="text-sky-400 flex-shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-sky-400 font-semibold uppercase tracking-widest">
            Opens in
          </span>
          <span className="text-sm font-display font-bold text-sky-300 tabular-nums">
            {countdownStr ?? (unlocksAtLabel ?? '–')}
          </span>
        </div>
      </div>
    )
  }

  // ── Open and closing soon ──────────────────────────────────
  if (phase === 'closing-soon') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30`}>
        <Lock size={11} className="text-red-400 flex-shrink-0 animate-pulse" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-red-400 font-semibold uppercase tracking-widest">
            Locks in
          </span>
          <span className="text-sm font-display font-bold text-red-300 tabular-nums">
            {countdownStr ?? '–'}
          </span>
        </div>
      </div>
    )
  }

  // ── Open with time remaining ───────────────────────────────
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bg} border ${theme.border}`}>
      <Clock size={11} className={`${theme.accent} flex-shrink-0`} />
      <div className="flex flex-col leading-tight">
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${theme.accent}`}>
          Locks in
        </span>
        <span className={`text-sm font-display font-bold tabular-nums ${theme.accentB}`}>
          {countdownStr ?? (locksAtLabel ?? '–')}
        </span>
      </div>
    </div>
  )
}


