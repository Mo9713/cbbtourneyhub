import { Eye, Lock, Clock, Settings, Trophy } from 'lucide-react'
import { useTheme }              from '../../../../shared/lib/theme'
import { statusLabel, statusIcon } from '../../../../shared/lib/helpers'
import { isPicksLocked, isBeforeUnlock } from '../../../../shared/lib/time'
import { useAuth }               from '../../../../features/auth/model/useAuth'
import { useUIStore }            from '../../../../shared/store/uiStore'
import Countdown                 from '../../../../shared/ui/Countdown'
import type { Tournament }       from '../../../../shared/types'

interface Props {
  tournament:           Tournament
  readOnly?:            boolean
  ownerName?:           string
  score?:               { current: number; max: number }
  
  // Legacy Props kept for TS stability
  pickedCount?:         number
  totalGames?:          number
  champion?:            string | null
  currentRoundPickTeam?: string | null

  // Survivor Props
  isSurvivor?:          boolean
  survivorScore?:       number
  survivorFirstPlace?:  number
  isEliminated?:        boolean
  survivorWinnerName?:  string | null
  isMassElimination?:   boolean
}

export default function BracketHeader({
  tournament, readOnly, ownerName, score,
  isSurvivor, survivorScore, survivorFirstPlace, isEliminated,
  survivorWinnerName, isMassElimination
}: Props) {
  const theme = useTheme()
  const { profile } = useAuth()
  const setActiveView = useUIStore(s => s.setActiveView)

  const lockedByTime = isPicksLocked(tournament, profile?.is_admin ?? false)
  const beforeOpen   = isBeforeUnlock(tournament)
  const isLocked     = lockedByTime || tournament.status === 'locked' || tournament.status === 'completed'

  let badgeText = statusLabel(tournament.status)
  let badgeIcon = statusIcon(tournament.status)

  if (tournament.status === 'open') {
    if (beforeOpen) {
      badgeText = 'Opens Soon'
      badgeIcon = <Clock size={12} className="text-sky-500 dark:text-sky-400" />
    } else if (lockedByTime) {
      badgeText = 'Locked'
      badgeIcon = <Lock size={12} className="text-rose-500 dark:text-rose-400" />
    }
  }

  return (
    <div className={`relative px-5 py-5 md:px-8 md:py-6 flex-shrink-0 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6 overflow-hidden bg-white dark:bg-[#0a0e17] border-b border-slate-200 dark:border-[#1a2332] shadow-sm dark:shadow-xl`}>
      
      {/* Subtle Glow inside the header */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* ── LEFT: Title & Status ── */}
      <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto md:flex-1">
        {readOnly && (
          <div className="flex items-center gap-1 mb-1">
            <Eye size={12} className="text-violet-600 dark:text-violet-400" />
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Read-Only</span>
          </div>
        )}
        <h2 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide leading-tight line-clamp-1">
          {readOnly ? `${ownerName}'s Bracket` : tournament.name}
        </h2>
        
        {isSurvivor && (
          <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${survivorWinnerName ? 'text-amber-500/70' : theme.textMuted}`}>Survivor Mode</span>
        )}

        {isSurvivor && survivorWinnerName && (
          <span className="mt-1.5 flex items-center gap-1.5 text-xs font-black text-amber-500 uppercase tracking-widest">
            < Trophy size={14} /> Pool Winner: {survivorWinnerName}!
          </span>
        )}

        {isSurvivor && isMassElimination && !survivorWinnerName && (
          <span className="mt-1.5 text-[10px] font-bold text-rose-400 uppercase tracking-widest">
            Pool Concluded — Mass Elimination
          </span>
        )}

        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/50">
            {badgeIcon}
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{badgeText}</span>
          </div>
        </div>
      </div>

      {/* ── CENTER: Enlarged Scoreboard ── */}
      <div className="relative z-10 w-full md:flex-1 flex justify-center order-last md:order-none mt-2 md:mt-0">
        {(!isSurvivor && isLocked) || isSurvivor ? (
          <div className="flex items-center justify-center gap-5 bg-slate-100 dark:bg-[#111622] border border-slate-200 dark:border-[#1a2332] rounded-[1.25rem] px-8 py-2.5 shadow-inner w-full max-w-xs">
            
            {isSurvivor && isEliminated ? (
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-rose-500 uppercase tracking-widest leading-none mt-1">Eliminated</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1.5">
                  Final Score: <span className="text-slate-700 dark:text-slate-300">{survivorScore}</span>
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">Score</span>
                  <span className={`text-3xl leading-none font-black ${readOnly ? 'text-violet-600 dark:text-violet-400' : theme.accent}`}>
                    {isSurvivor ? survivorScore : score?.current}
                  </span>
                </div>
                {isSurvivor ? (
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-2">
                    1st place: <span className="text-slate-700 dark:text-slate-300">{survivorFirstPlace}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-2">
                    Max: <span className="text-slate-700 dark:text-slate-300">{score?.max}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ── RIGHT: Admin Button & Countdown Timer ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-center md:justify-end gap-4 w-full md:w-auto md:flex-1">
        {profile?.is_admin && (
          <button
            onClick={() => setActiveView('admin')}
            className="flex items-center gap-1.5 px-3 py-2 h-[38px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <Settings size={12} /> Admin
          </button>
        )}
        {!isSurvivor && (
          <Countdown
            tournament={tournament}
            isAdmin={profile?.is_admin ?? false}
            timezone={profile?.timezone ?? null}
          />
        )}
      </div>

    </div>
  )
}