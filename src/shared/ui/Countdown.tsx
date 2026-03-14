// src/shared/ui/Countdown.tsx
import { useState, useEffect } from 'react'
import { Lock, Clock, AlertTriangle } from 'lucide-react'
import { useTheme } from '../lib/theme'
import {
  isBeforeUnlock,
  isPicksLocked,
  msUntilUnlock,
  msUntilLock,
  formatCountdown,
  formatInUserTz,
  getActiveSurvivorRound
} from '../lib/time'
import type { Tournament } from '../types'

interface Props {
  tournament: Tournament
  isAdmin:    boolean
  timezone:   string | null
}

type Phase = 'draft' | 'locked' | 'before-open' | 'open' | 'closing-soon'

const CLOSING_SOON_THRESHOLD_MS = 15 * 60 * 1000

function getPhase(tournament: Tournament, isAdmin: boolean): Phase {
  if (tournament.status === 'draft')          return 'draft'
  if (isBeforeUnlock(tournament))             return 'before-open'
  if (isPicksLocked(tournament, isAdmin))     return 'locked'
  const remaining = msUntilLock(tournament)
  if (remaining !== null && remaining <= CLOSING_SOON_THRESHOLD_MS) return 'closing-soon'
  return 'open'
}

export default function Countdown({ tournament, isAdmin, timezone }: Props) {
  const theme = useTheme()

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

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tournament, isAdmin])

  if (phase === 'locked' && tournament.status === 'locked') return null
  
  // Dynamic Labeling for Survivor vs Standard
  const isSurvivor  = tournament.game_type === 'survivor'
  const activeRound = isSurvivor ? getActiveSurvivorRound(tournament) : 0
  
  let locksAtLabel  = tournament.locks_at ? formatInUserTz(tournament.locks_at, timezone) : null
  let locksAtPrefix = 'Locks in'

  if (isSurvivor && activeRound > 0) {
    locksAtPrefix = `Rd ${activeRound} Locks`
    // FIX: Removed String() cast, activeRound is already a number
    const lockStr = tournament.round_locks?.[activeRound]
    if (lockStr) locksAtLabel = formatInUserTz(lockStr, timezone)
  }

  if (phase === 'open' && !locksAtLabel && !msLeft) return null

  const countdownStr = msLeft != null ? formatCountdown(msLeft) : null
  const unlocksAtLabel = tournament.unlocks_at ? formatInUserTz(tournament.unlocks_at, timezone) : null

  if (phase === 'draft') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
        <AlertTriangle size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Draft Mode - Hidden</span>
      </div>
    )
  }

  if (phase === 'locked') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bg} border ${theme.border}`}>
        <Lock size={11} className="text-slate-500 flex-shrink-0" />
        <span className="text-xs text-slate-500 font-medium">Picks locked</span>
      </div>
    )
  }

  if (phase === 'before-open') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20`}>
        <Clock size={11} className="text-sky-400 flex-shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-sky-400 font-semibold uppercase tracking-widest">Opens in</span>
          <span className="text-sm font-display font-bold text-sky-300 tabular-nums">
            {countdownStr ?? (unlocksAtLabel ?? '–')}
          </span>
        </div>
      </div>
    )
  }

  if (phase === 'closing-soon') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30`}>
        <Lock size={11} className="text-red-400 flex-shrink-0 animate-pulse" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-red-400 font-semibold uppercase tracking-widest">{locksAtPrefix}</span>
          <span className="text-sm font-display font-bold text-red-300 tabular-nums">
            {countdownStr ?? '–'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bg} border ${theme.border}`}>
      <Clock size={11} className={`${theme.accent} flex-shrink-0`} />
      <div className="flex flex-col leading-tight">
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${theme.accent}`}>
          {locksAtPrefix}
        </span>
        <span className={`text-sm font-display font-bold tabular-nums ${theme.accentB}`}>
          {countdownStr ?? (locksAtLabel ?? '–')}
        </span>
      </div>
    </div>
  )
}