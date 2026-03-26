import { Eye, Lock, Clock, Settings } from 'lucide-react'
import { useTheme }              from '../../../../shared/lib/theme'
import { statusLabel, statusIcon } from '../../../../shared/lib/helpers'
import { isPicksLocked, isBeforeUnlock, getActiveSurvivorRound } from '../../../../shared/lib/time'
import { useAuth }               from '../../../../features/auth/model/useAuth'
import { useUIStore }            from '../../../../shared/store/uiStore'
import Countdown                 from '../../../../shared/ui/Countdown'
import type { Tournament }       from '../../../../shared/types'

interface Props {
  tournament:           Tournament
  pickedCount:          number
  totalGames:           number
  readOnly:             boolean
  ownerName?:           string
  score:                { current: number; max: number }
  champion?:            string | null
  currentRoundPickTeam?: string | null
}

export default function BracketHeader({
  tournament, pickedCount, totalGames, readOnly, ownerName, score,
  champion, currentRoundPickTeam,
}: Props) {
  const theme = useTheme()
  const { profile } = useAuth()
  const setActiveView = useUIStore(s => s.setActiveView)

  const lockedByTime = isPicksLocked(tournament, profile?.is_admin ?? false)
  const beforeOpen   = isBeforeUnlock(tournament)
  const isLocked     = lockedByTime || tournament.status === 'locked'

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

  const isSurvivor = tournament.game_type === 'survivor'
  let effectiveTotal  = totalGames
  let effectivePicked = pickedCount

  if (isSurvivor) {
    const activeRound = getActiveSurvivorRound(tournament)
    effectiveTotal  = 1
    effectivePicked = (pickedCount >= activeRound && activeRound > 0) ? 1 : 0
  }

  const pct = effectiveTotal > 0 ? Math.round((effectivePicked / effectiveTotal) * 100) : 0
  const displayPickTeam = isSurvivor ? currentRoundPickTeam : champion

  return (
    <div className={`px-4 py-3 md:px-6 md:py-4 border-b flex-shrink-0 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6
      ${readOnly ? 'bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/20' : theme.headerBg}`}>

      {/* ── LEFT: Title & Status ── */}
      <div className="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto md:flex-1">
        {readOnly && (
          <div className="flex items-center gap-1 mb-0.5">
            <Eye size={12} className="text-violet-600 dark:text-violet-400" />
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Read-Only</span>
          </div>
        )}
        <h2 className="font-display text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide leading-tight line-clamp-1">
          {readOnly ? `${ownerName}'s Bracket` : tournament.name}
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/50">
            {badgeIcon}
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{badgeText}</span>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Centered Progress Bar or Scoreboard ── */}
      <div className="w-full md:flex-1 flex justify-center order-last md:order-none">
        {isLocked ? (
          <div className="flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 md:px-8 py-1.5 shadow-inner w-full max-w-sm">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">Score</span>
                <span className={`text-xl font-black ${readOnly ? 'text-violet-600 dark:text-violet-400' : theme.accent}`}>{score.current}</span>
              </div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                Max: <span className="text-slate-700 dark:text-slate-300">{score.max}</span>
              </div>
            </div>
            
            {/* Show Champion in Locked Standard Brackets */}
            {!isSurvivor && (
              <>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                <div className="flex flex-col items-center justify-center min-w-0">
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">Champ</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate max-w-[100px] md:max-w-[140px]">
                    {champion || 'None'}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2.5 shadow-inner">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 min-w-0 overflow-hidden">
                {isSurvivor ? 'Round Pick:' : 'Champ:'}
                {displayPickTeam ? (
                  <span className="text-[10px] md:text-xs font-black text-emerald-600 dark:text-emerald-400 normal-case tracking-normal truncate">
                    {displayPickTeam}
                  </span>
                ) : (
                  <span className="text-[10px] md:text-xs font-bold text-slate-400 normal-case tracking-normal">
                    No pick
                  </span>
                )}
              </span>
              <span className={`text-[10px] md:text-xs font-black flex-shrink-0 ml-2 ${pct === 100 ? 'text-emerald-500' : theme.accent}`}>
                {effectivePicked}&nbsp;/&nbsp;{effectiveTotal}
              </span>
            </div>
            <div className="h-1.5 md:h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct === 100
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                    : (readOnly ? 'bg-violet-500' : theme.btn.split(' ')[0])
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Admin Button & Countdown Timer ── */}
      <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto md:flex-1">
        {profile?.is_admin && (
          <button
            onClick={() => setActiveView('admin')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors"
          >
            <Settings size={10} /> Admin
          </button>
        )}
        <Countdown
          tournament={tournament}
          isAdmin={profile?.is_admin ?? false}
          timezone={profile?.timezone ?? null}
        />
      </div>

    </div>
  )
}