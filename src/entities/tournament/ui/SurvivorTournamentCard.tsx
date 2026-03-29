import { Play, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'
import { isPicksLocked, getActiveSurvivorRound } from '../../../shared/lib/time'
import { statusLabel, statusIcon, getRoundLabel } from '../../../shared/lib/helpers'
import { useTournamentProgress } from '../model/hooks'
import type { Tournament } from '../../../shared/types'

interface Props {
  tournament: Tournament
  isAdmin: boolean
  onSelect: (t: Tournament) => void
  timezone?: string | null
  variant?: 'compact' | 'full'
  userStat?: { rank: number; totalPlayers: number; seedScore: number; isEliminated: boolean; firstPlaceSeed: number; prevRoundPick?: string | null; prevRoundLabel?: string } | null
}

export function SurvivorTournamentCard({ tournament, isAdmin, onSelect, variant = 'compact', userStat }: Props) {
  const theme = useTheme()
  const progress = useTournamentProgress(tournament)
  const locked = isPicksLocked(tournament, isAdmin)

  const isEffectivelyLocked = tournament.status === 'locked' || tournament.status === 'completed' || (tournament.status === 'open' && locked)
  const isCompleted = tournament.status === 'completed'
  const activeRound = getActiveSurvivorRound(tournament)

  const displayStatus =
    tournament.status === 'completed' ? 'completed' :
    tournament.status === 'draft'     ? 'draft'     :
    isEffectivelyLocked               ? 'active'    :
    'open'

  const showPickBar = tournament.status !== 'draft' && !isCompleted && progress.requiredPicks > 0

  const activeRoundLabel = getRoundLabel(activeRound, 6, tournament.round_names ?? null)
  const prevRoundLabel = activeRound > 1 ? getRoundLabel(activeRound - 1, 6, tournament.round_names ?? null) : ''

  const cardClasses = isCompleted
    ? 'border-violet-500/40 bg-violet-500/5 hover:border-violet-400/60'
    : `${theme.panelBg} ${theme.borderBase} hover:border-amber-500/50`

  const pickStatusBadgeCls =
    displayStatus === 'open'      ? `${theme.bg} ${theme.accent}` :
    displayStatus === 'active'    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400' :
    displayStatus === 'draft'     ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
    displayStatus === 'completed' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300' :
    'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500'

  return (
    <button
      onClick={() => onSelect(tournament)}
      className={`text-left p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.99] w-full flex flex-col h-full min-h-[260px] ${cardClasses}`}
    >
      <div className="flex items-start justify-between gap-3 w-full mb-2 flex-shrink-0">
        <h3 className={`font-display text-xl font-bold uppercase tracking-wide leading-tight line-clamp-2 ${theme.textBase}`}>
          {tournament.name}
        </h3>
        
        {variant === 'compact' ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(displayStatus === 'open' || displayStatus === 'active') && activeRound > 0 && (
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-lg flex items-center gap-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Play size={12} /> Active
              </span>
            )}
            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${pickStatusBadgeCls}`}>
              {displayStatus === 'active' ? <Lock size={12} /> : statusIcon(tournament.status)}
              {' '}
              {displayStatus === 'active' ? 'Locked' : statusLabel(tournament.status)}
            </span>
          </div>
        ) : (
          <span className={`flex-shrink-0 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${theme.bgMd} ${theme.textMuted}`}>
            Survivor
          </span>
        )}
      </div>

      {variant === 'compact' && (
        <div className={`mt-auto w-full pt-4 flex flex-col justify-center gap-2.5`}>
          
          {showPickBar && (
            <div className="flex flex-col gap-3 w-full mb-1">
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 flex items-center gap-1">
                     <AlertCircle size={10} /> Next Round Pick
                   </span>
                   <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-black truncate max-w-[100px] ${progress.pickTeamName ? theme.textBase : 'text-slate-400'}`}>
                        {progress.pickTeamName || 'Needs Pick'}
                      </span>
                      <span className="text-[10px] font-black text-amber-500">{progress.pickTeamName ? '1' : '0'}<span className="text-slate-400">/1</span></span>
                   </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                   <div className={`h-full rounded-full transition-all duration-500 ${progress.pickTeamName ? 'bg-amber-500 w-full shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'w-0'}`} />
                </div>
              </div>
            </div>
          )}
          
          {userStat && activeRound > 0 ? (
            <div className={`flex flex-col gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800/50 ${showPickBar ? 'mt-1' : ''}`}>
              {userStat.prevRoundLabel && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Locked ({userStat.prevRoundLabel})</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-emerald-500" />
                    <span className={`text-[11px] font-black truncate max-w-[120px] ${theme.textBase}`}>
                      {userStat.prevRoundPick || 'None'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank</span>
                <span className="text-xs font-black text-amber-500">#{userStat.rank} <span className="text-[9px] text-slate-400">/ {userStat.totalPlayers}</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Seed Pts</span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-black ${theme.textBase}`}>{userStat.seedScore}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(1st: {userStat.firstPlaceSeed})</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${userStat.isEliminated ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {userStat.isEliminated ? 'Eliminated' : 'Alive'}
                </span>
              </div>
            </div>
          ) : (
            <>
              {displayStatus === 'draft' && isAdmin && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center mt-2">Draft</p>}
              {displayStatus === 'completed' && !userStat && <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400 text-center mt-2">Results final</p>}
            </>
          )}
        </div>
      )}

      {/* ── FULL VARIANT (For Group Dashboard) ── */}
      {variant === 'full' && (
        <div className="mt-auto w-full pt-4 flex flex-col border-t border-slate-200 dark:border-slate-800/50 gap-3">
           <div className="flex w-full justify-between items-center text-[10px] uppercase tracking-widest font-bold">
              <span className="text-slate-500">
                {isCompleted ? 'Status' : tournament.status === 'draft' ? 'Status' : activeRound === 0 ? 'Status' : `Locked (${prevRoundLabel})`}
              </span>
              <span className={displayStatus === 'open' ? 'text-emerald-600 dark:text-emerald-500 font-black shadow-[0_0_8px_rgba(16,185,129,0.8)]' : displayStatus === 'completed' ? 'text-violet-500 dark:text-violet-400 font-black' : displayStatus === 'draft' ? 'text-amber-500 font-black' : 'text-blue-500 dark:text-blue-400 font-black'}>
                {isCompleted ? 'Finished' : tournament.status === 'draft' ? 'Draft' : activeRound === 0 ? 'Active' : displayStatus === 'open' ? `${activeRoundLabel} Open` : 'Active'}
              </span>
           </div>

           {userStat?.prevRoundLabel && (
             <div className="flex items-center justify-between mt-1">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Locked ({userStat.prevRoundLabel})</span>
               <span className={`text-[11px] font-black truncate max-w-[120px] ${userStat.prevRoundPick ? theme.textBase : 'text-slate-400'}`}>
                 {userStat.prevRoundPick || 'None'}
               </span>
             </div>
           )}

           {showPickBar && (
             <div className="flex flex-col gap-1.5 w-full mt-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    <AlertCircle size={10} /> Next Round Pick
                  </span>
                  <div className="flex items-center gap-2">
                     <span className={`text-[11px] font-black truncate max-w-[100px] ${progress.pickTeamName ? theme.textBase : 'text-slate-400'}`}>
                       {progress.pickTeamName || 'Needs Pick'}
                     </span>
                     <span className="text-[10px] font-black text-amber-500">{progress.pickTeamName ? '1' : '0'}<span className="text-slate-400">/1</span></span>
                  </div>
               </div>
               <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${progress.pickTeamName ? 'bg-amber-500 w-full shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'w-0'}`} />
               </div>
             </div>
           )}
        </div>
      )}
    </button>
  )
}