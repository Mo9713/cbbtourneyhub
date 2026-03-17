// src/entities/tournament/ui/StandardTournamentCard.tsx
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
  // Determines if we render the compact layout (TournamentList) or full (GroupDashboard)
  variant?: 'compact' | 'full' 
}

export function StandardTournamentCard({ tournament, isAdmin, onSelect, timezone = null, variant = 'compact' }: Props) {
  const theme = useTheme()
  const progress = useTournamentProgress(tournament)
  const locked = isPicksLocked(tournament, isAdmin)

  const isEffectivelyLocked = tournament.status === 'locked' || tournament.status === 'completed' || (tournament.status === 'open' && locked)
  const isCompleted = tournament.status === 'completed'

  const displayStatus =
    tournament.status === 'completed' ? 'completed' :
    tournament.status === 'draft'     ? 'draft'     :
    isEffectivelyLocked               ? 'locked'    :
    'open'

  const showPickBar = !isCompleted && tournament.status !== 'draft' && !locked && progress.requiredPicks > 0

  const cardClasses = isCompleted
    ? 'border-violet-500/40 bg-violet-500/5 hover:border-violet-400/60'
    : `${theme.panelBg} ${theme.borderBase} hover:border-amber-500/50`

  const badgeCls =
    displayStatus === 'open'      ? `${theme.bg} ${theme.accent}` :
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
        <span className={`flex-shrink-0 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${variant === 'compact' ? badgeCls : `${theme.bgMd} ${theme.textMuted}`}`}>
          {variant === 'compact' ? <>{statusIcon(tournament.status)} {statusLabel(tournament.status)}</> : 'Bracket'}
        </span>
      </div>

      {/* Full Variant: Countdown in middle */}
      {variant === 'full' && (
        <div className="flex items-center justify-start w-full empty:hidden mt-2">
          <Countdown tournament={tournament} isAdmin={isAdmin} timezone={timezone} />
        </div>
      )}

      {/* Compact Variant: Status / Pick Bar fixed to bottom */}
      {variant === 'compact' && (
        <div className={`mt-auto w-full pt-4 border-t flex flex-col justify-center min-h-[44px] ${isCompleted ? 'border-violet-500/20' : 'border-slate-200 dark:border-slate-800/50'}`}>
          {showPickBar && <TournamentProgressBar compact={true} {...progress} />}
          {displayStatus === 'draft' && isAdmin && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Draft</p>}
          {displayStatus === 'completed' && <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400 text-center">Results final</p>}
          {displayStatus === 'locked' && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Picks Locked</p>}
        </div>
      )}

      {/* Full Variant: Status / Pick Bar below countdown */}
      {variant === 'full' && (
        <div className="mt-3 w-full pt-3 flex flex-col border-t border-slate-200 dark:border-slate-800/50 text-[10px] sm:text-[11px] uppercase tracking-widest font-bold">
           <div className="flex w-full justify-between items-center mb-2">
              <span className="text-slate-500">Status</span>
              <span className={displayStatus === 'open' ? 'text-emerald-600 dark:text-emerald-500 font-black shadow-[0_0_8px_rgba(16,185,129,0.8)]' : displayStatus === 'completed' ? 'text-violet-500 dark:text-violet-400 font-black' : displayStatus === 'draft' ? 'text-amber-500 font-black' : 'text-slate-500 font-black'}>
                {displayStatus === 'locked' ? 'Locked' : displayStatus === 'open' ? 'Open' : displayStatus === 'completed' ? 'Finished' : 'Draft'}
              </span>
           </div>
           {showPickBar && <TournamentProgressBar {...progress} />}
        </div>
      )}
    </button>
  )
}