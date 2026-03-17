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
    <div className={`px-6 py-5 border-b flex-shrink-0 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8
      ${readOnly ? 'bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/20' : theme.headerBg}`}>

      {/* ── LEFT: Title & Status ── */}
      <div className="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto md:flex-1">
        {readOnly && (
          <div className="flex items-center gap-2 mb-1">
            <Eye size={14} className="text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Read-Only</span>
          </div>
        )}
        <h2 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide leading-tight">
          {readOnly ? `${ownerName}'s Bracket` : tournament.name}
        </h2>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700/50">
            {badgeIcon}
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{badgeText}</span>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Centered Progress Bar or Scoreboard ── */}
      <div className="w-full md:flex-1 flex justify-center order-last md:order-none mt-2 md:mt-0">
        {isLocked ? (
          <div className="flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-8 py-2 shadow-inner w-full max-w-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">Score</span>
              <span className={`text-3xl font-black ${readOnly ? 'text-violet-600 dark:text-violet-400' : theme.accent}`}>{score.current}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              Max: <span className="text-slate-700 dark:text-slate-300">{score.max}</span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-3.5 shadow-inner">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 min-w-0 overflow-hidden">
                {isSurvivor ? 'Current Round Pick:' : 'Champion Pick:'}
                {displayPickTeam ? (
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 normal-case tracking-normal truncate">
                    {displayPickTeam}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-400 normal-case tracking-normal">
                    No pick yet
                  </span>
                )}
              </span>
              <span className={`text-xs font-black flex-shrink-0 ml-2 ${pct === 100 ? 'text-emerald-500' : theme.accent}`}>
                {effectivePicked}&nbsp;/&nbsp;{effectiveTotal}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <Settings size={12} /> Admin
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