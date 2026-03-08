// src/components/Countdown.tsx
import { useState, useEffect } from 'react'
import { Lock, Clock } from 'lucide-react'
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

type Phase = 'locked' | 'before-open' | 'open' | 'closing-soon'

const CLOSING_SOON_THRESHOLD_MS = 15 * 60 * 1000  // show urgency under 15 min

function getPhase(tournament: Tournament, isAdmin: boolean): Phase {
  if (isPicksLocked(tournament, isAdmin))     return 'locked'
  if (isBeforeUnlock(tournament))             return 'before-open'
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

  // ── Closed / locked by tip-off time ────────────────────────
  if (phase === 'locked') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bg} border ${theme.border}`}>
        <Lock size={11} className="text-slate-500 flex-shrink-0" />
        <span className="text-xs text-slate-500 font-medium">Picks locked</span>
      </div>
    )
  }

  // ── Not yet open ───────────────────────────────────────────
  if (phase === 'before-open') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700`}>
        <Clock size={11} className="text-slate-400 flex-shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
            Opens in
          </span>
          <span className="text-sm font-display font-bold text-slate-200 tabular-nums">
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
