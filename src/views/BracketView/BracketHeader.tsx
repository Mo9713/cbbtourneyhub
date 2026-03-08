// src/views/BracketView/BracketHeader.tsx
import { Eye } from 'lucide-react'
import { useTheme }    from '../../utils/theme'
import { statusLabel, statusIcon } from '../../utils/helpers'
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
  const pct   = totalGames > 0 ? Math.round((pickedCount / totalGames) * 100) : 0

  return (
    <div className={`px-6 py-4 border-b flex-shrink-0 flex items-center justify-between gap-4
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
          {statusIcon(tournament.status)}
          <span className="text-xs text-slate-400">{statusLabel(tournament.status)}</span>
          {!readOnly && (
            <>
              <span className="text-slate-700">·</span>
              <span className={`text-xs font-semibold ${theme.accent}`}>{pickedCount}/{totalGames} picks</span>
            </>
          )}
        </div>
      </div>

      {/* Progress bar — own picks only, hidden in read-only mode */}
      {!readOnly && (
        <div className="text-right flex-shrink-0">
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
  )
}
