import { Play } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'
import { isPicksLocked } from '../../../shared/lib/time'
import { statusLabel, statusIcon } from '../../../shared/lib/helpers'
import { useTournamentProgress } from '../model/hooks'
import { TournamentProgressBar } from './TournamentProgressBar'
import Countdown from '../../../shared/ui/Countdown'
import type { Tournament } from '../../../shared/types'

interface Props {
  tournament: Tournament
  isAdmin: boolean
  onSelect: (t: Tournament) => void
  timezone?: string | null
  variant?: 'compact' | 'full' 
  userStat?: { rank: number; totalPlayers: number; score: number; firstPlaceScore: number } | null
}

export function StandardTournamentCard({ tournament, isAdmin, onSelect, timezone = null, variant = 'compact', userStat }: Props) {
  const theme = useTheme()
  const progress = useTournamentProgress(tournament)
  const locked = isPicksLocked(tournament, isAdmin)

  const isEffectivelyLocked = tournament.status === 'locked' || tournament.status === 'completed' || (tournament.status === 'open' && locked)
  const isCompleted = tournament.status === 'completed'

  const displayStatus =
    tournament.status === 'completed' ? 'completed' :
    tournament.status === 'draft'     ? 'draft'     :
    isEffectivelyLocked               ? 'active'    :
    'open'

  const showPickBar = displayStatus === 'open' && progress.requiredPicks > 0

  const cardClasses = isCompleted
    ? 'border-violet-500/40 bg-violet-500/5 hover:border-violet-400/60'
    : `${theme.panelBg} ${theme.borderBase} hover:border-amber-500/50`

  const badgeCls =
    displayStatus === 'open'      ? `${theme.bg} ${theme.accent}` :
    displayStatus === 'active'    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
    displayStatus === 'draft'     ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
    displayStatus === 'completed' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300' :
    'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500'

  return (
    <button
      onClick={() => onSelect(tournament)}
      className={`text-left p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.99] w-full flex flex-col ${variant === 'compact' ? 'h-[180px]' : ''} ${cardClasses}`}
    >
      <div className="flex items-start justify-between gap-3 w-full mb-2">
        <h3 className={`font-display text-xl font-bold uppercase tracking-wide leading-tight line-clamp-2 ${theme.textBase}`}>
          {tournament.name}
        </h3>
        
        {variant === 'compact' ? (
          <span className={`flex-shrink-0 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${badgeCls}`}>
            {displayStatus === 'active' ? <Play size={12} /> : statusIcon(tournament.status)}
            {' '}
            {displayStatus === 'active' ? 'Active' : statusLabel(tournament.status)}
          </span>
        ) : (
          <span className={`flex-shrink-0 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${theme.bgMd} ${theme.textMuted}`}>
            Bracket
          </span>
        )}
      </div>

      {variant === 'full' && (
        <div className="flex items-center justify-start w-full empty:hidden mt-2">
          <Countdown tournament={tournament} isAdmin={isAdmin} timezone={timezone} />
        </div>
      )}

      {variant === 'compact' && (
        <div className={`mt-auto w-full pt-4 border-t flex flex-col justify-center min-h-[44px] ${isCompleted ? 'border-violet-500/20' : 'border-slate-200 dark:border-slate-800/50'}`}>
          {showPickBar ? (
            <TournamentProgressBar compact={true} {...progress} />
          ) : (
            <>
              {(displayStatus === 'active' || displayStatus === 'completed') && userStat ? (
                <div className="flex flex-col gap-1.5 px-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg py-2 border border-slate-200 dark:border-slate-700/50 shadow-inner">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank:</span>
                      <span className="text-xs font-black text-amber-500">#{userStat.rank}<span className="text-[9px] text-slate-400 font-bold ml-0.5">/{userStat.totalPlayers}</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pts:</span>
                      <span className={`text-xs font-black ${theme.textBase}`}>{userStat.score}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full border-t border-slate-200 dark:border-slate-700/50 pt-1.5">
                     <div className="flex items-center gap-1.5">
                       <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Champ:</span>
                       <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 truncate max-w-[80px]">{progress.pickTeamName || 'None'}</span>
                     </div>
                     <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">1st Place: {userStat.firstPlaceScore}</span>
                  </div>
                </div>
              ) : displayStatus === 'active' && !userStat ? (
                <div className="flex items-center justify-between px-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg py-2 border border-slate-200 dark:border-slate-700/50 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Picks Locked</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Champ:</span>
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">{progress.pickTeamName || 'None'}</span>
                  </div>
                </div>
              ) : null}
              {displayStatus === 'draft' && isAdmin && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Draft</p>}
            </>
          )}
        </div>
      )}

      {variant === 'full' && (
        <div className="mt-3 w-full pt-3 flex flex-col border-t border-slate-200 dark:border-slate-800/50 text-[10px] sm:text-[11px] uppercase tracking-widest font-bold">
           <div className="flex w-full justify-between items-center mb-2">
              <span className="text-slate-500">Status</span>
              <span className={displayStatus === 'open' ? 'text-emerald-600 dark:text-emerald-500 font-black shadow-[0_0_8px_rgba(16,185,129,0.8)]' : displayStatus === 'completed' ? 'text-violet-500 dark:text-violet-400 font-black' : displayStatus === 'draft' ? 'text-amber-500 font-black' : 'text-blue-500 dark:text-blue-400 font-black'}>
                {displayStatus === 'active' ? 'Active (Locked)' : displayStatus === 'open' ? 'Open' : displayStatus === 'completed' ? 'Finished' : 'Draft'}
              </span>
           </div>
           {showPickBar && <TournamentProgressBar {...progress} />}
           {displayStatus === 'active' && (
             <div className="flex items-center justify-between px-3 mt-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg py-2 border border-slate-200 dark:border-slate-700/50 shadow-inner">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Picks Locked</span>
               <div className="flex items-center gap-1.5">
                 <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Champ:</span>
                 <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{progress.pickTeamName || 'None'}</span>
               </div>
             </div>
           )}
        </div>
      )}
    </button>
  )
}