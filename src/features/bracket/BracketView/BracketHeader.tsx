// src/views/BracketView/BracketHeader.tsx
import { Eye, Lock, Clock } from 'lucide-react'
import { useTheme }    from '../../utils/theme'
import { statusLabel, statusIcon } from '../../utils/helpers'
import { isPicksLocked, isBeforeUnlock } from '../../utils/time'
import { useAuthContext } from '../../context/AuthContext'
import Countdown from '../../components/Countdown'
import type { Tournament } from '../../types'

interface Props {
  tournament:  Tournament
  pickedCount: number
  totalGames:  number
  readOnly:    boolean
  ownerName?:  string
}

export default function BracketHeader({ tournament, pickedCount, totalGames, readOnly, ownerName }: Props) {
  const theme = useTheme()
  const { profile } = useAuthContext()
  const pct   = totalGames > 0 ? Math.round((pickedCount / totalGames) * 100) : 0

  // Check the actual time locks to override the "Open" text if necessary
  const lockedByTime = isPicksLocked(tournament, profile?.is_admin ?? false)
  const beforeOpen   = isBeforeUnlock(tournament)

  let badgeText = statusLabel(tournament.status)
  let badgeIcon = statusIcon(tournament.status)

  if (tournament.status === 'open') {
    if (beforeOpen) {
      badgeText = 'Opens Soon'
      badgeIcon = <Clock size={12} className="text-sky-400" />
    } else if (lockedByTime) {
      badgeText = 'Locked'
      badgeIcon = <Lock size={12} className="text-rose-400" />
    }
  }

  return (
    <div className={`px-6 py-4 border-b flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4
      ${readOnly ? 'bg-violet-500/5 border-violet-500/20' : theme.headerBg}`}>

      <div>
        {readOnly && (
          <div className="flex items-center gap-2 mb-1">
            <Eye size={14} className="text-violet-400" />
            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Read-Only</span>
          </div>
        )}
        <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">
          {readOnly ? `${ownerName}'s Bracket` : tournament.name}
        </h2>
        <div className="flex items-center gap-2 mt-0.5">
          {badgeIcon}
          <span className="text-xs text-slate-400">{badgeText}</span>
          {!readOnly && (
            <>
              <span className="text-slate-700">·</span>
              <span className={`text-xs font-semibold ${theme.accent}`}>{pickedCount}/{totalGames} picks</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5 flex-shrink-0">
        <Countdown 
          tournament={tournament} 
          isAdmin={profile?.is_admin ?? false} 
          timezone={profile?.timezone ?? null} 
        />

        {!readOnly && (
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <span className="text-xs text-slate-400">Progress</span>
              <span className={`text-sm font-bold ${theme.accent}`}>{pickedCount}/{totalGames}</span>
            </div>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${theme.bar} rounded-full transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  )
}