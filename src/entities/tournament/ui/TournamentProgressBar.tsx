import { useTheme } from '../../../shared/lib/theme'

interface Props {
  pickLabel: string
  pickTeamName: string | null
  currentPicks: number
  requiredPicks: number
  percent: number
  isComplete: boolean
  compact?: boolean 
}

export function TournamentProgressBar({
  pickLabel,
  pickTeamName,
  currentPicks,
  requiredPicks,
  percent,
  isComplete,
  compact = false
}: Props) {
  const theme = useTheme()
  
  // Use theme colors for incomplete, emerald for complete
  const activeColorCls = isComplete ? 'text-emerald-600 dark:text-emerald-400' : theme.accent
  const activeBgCls = isComplete ? 'bg-emerald-500' : theme.bar

  return (
    <div className={`w-full ${compact ? '' : 'mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/50'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5 min-w-0 overflow-hidden">
          {pickLabel}:
          {pickTeamName ? (
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 normal-case tracking-normal truncate">
              {pickTeamName}
            </span>
          ) : (
            <span className={`text-xs font-bold ${theme.accent} normal-case tracking-normal`}>
              No pick yet
            </span>
          )}
        </span>
        <span className={`text-[10px] font-bold flex-shrink-0 ml-2 ${activeColorCls}`}>
          {currentPicks}&nbsp;/&nbsp;{requiredPicks}
        </span>
      </div>
      <div className={`${compact ? 'h-1' : 'h-1.5'} rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${activeBgCls}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}