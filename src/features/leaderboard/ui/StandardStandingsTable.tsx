// src/features/leaderboard/ui/StandardStandingsTable.tsx
//
// M-NEW-2 integration: accepts `showTiebreaker` prop. When true, each row
// renders the user's tiebreaker prediction as a small chip. The chip is
// only shown when the tournament has requires_tiebreaker enabled.
//
// FSD Refactor (Phase 1): Added `variant` prop to support 'compact' (GroupDashboard)
// and 'full' (LeaderboardView) rendering modes.

import { Eye, Target } from 'lucide-react'
import { useTheme }    from '../../../shared/lib/theme'
import { Avatar }      from '../../../shared/ui'
import { useUIStore }  from '../../../shared/store/uiStore'
import type { LeaderboardEntry } from '../model/selectors'

interface Props {
  title:           string
  board:           LeaderboardEntry[]
  isMe:            (userId: string) => boolean
  isAdmin:         boolean
  showTiebreaker?: boolean
  variant?:        'compact' | 'full'
}

export function StandardStandingsTable({
  title,
  board,
  isMe,
  isAdmin,
  showTiebreaker = false,
  variant = 'compact'
}: Props) {
  const theme     = useTheme()
  const openSnoop = useUIStore(s => s.openSnoop)
  const isFull    = variant === 'full'

  return (
    <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm h-full`}>
      {/* ── Panel header ── */}
      <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20 flex items-center justify-between gap-3`}>
        <h3 className={`font-display ${isFull ? 'text-xl' : 'text-lg'} font-black uppercase tracking-widest ${theme.textBase}`}>
          {title}
        </h3>
        {/* Tiebreaker indicator in header so users know the column exists */}
        {showTiebreaker && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-violet-500/30 text-violet-400 bg-violet-500/10`}>
            <Target size={9} />
            {isFull ? 'Tiebreaker: Championship Score' : 'Tiebreaker On'}
          </span>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {board.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-32 text-sm ${theme.textMuted}`}>
            No active players.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {board.map((entry, i) => {
              const me = isMe(entry.profile.id)
              return (
                <div
                  key={entry.profile.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${theme.borderBase} ${
                    me ? `${theme.bgMd} border-amber-500/30 shadow-sm` : 'bg-white dark:bg-[#11141d]'
                  }`}
                >
                  {/* Rank */}
                  <span className={`w-8 text-center font-bold text-slate-500 ${isFull ? 'text-sm' : 'text-xs'} flex-shrink-0`}>
                    #{i + 1}
                  </span>

                  <Avatar profile={entry.profile} size={isFull ? 'md' : 'sm'} />

                  {/* Name */}
                  <span className={`flex-1 font-semibold truncate ${theme.textBase} ${isFull ? 'text-base' : 'text-sm'}`}>
                    {entry.profile.display_name}
                    {me && (
                      <span className="text-[10px] font-normal text-slate-500 ml-1.5">(you)</span>
                    )}
                  </span>

                  {/* Tiebreaker chip */}
                  {showTiebreaker && (
                    <div className="flex-shrink-0 text-right w-14">
                      {entry.tiebreakerScore != null ? (
                        <p className={`font-bold ${isFull ? 'text-sm' : 'text-xs'} text-violet-400`}>
                          {entry.tiebreakerScore}
                        </p>
                      ) : (
                        <p className={`${isFull ? 'text-sm' : 'text-xs'} font-bold ${theme.textMuted} opacity-40`}>—</p>
                      )}
                      <p className={`text-[9px] uppercase tracking-widest ${theme.textMuted}`}>TB</p>
                    </div>
                  )}

                  {/* Points */}
                  <div className={`text-right ${isFull ? 'w-24' : 'w-16'} flex-shrink-0`}>
                    <p className={`font-bold ${theme.accent} ${isFull ? 'text-lg' : 'text-base'}`}>{entry.points} pts</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>Max {entry.maxPossible}</p>
                  </div>

                  {/* Correct picks (Only shown in Full mode) */}
                  {isFull && (
                    <div className="text-right w-16 flex-shrink-0 hidden sm:block">
                      <p className={`text-base font-bold ${theme.textBase}`}>{entry.correct}</p>
                      <p className={`text-[11px] ${theme.textMuted}`}>Correct</p>
                    </div>
                  )}

                  {/* Admin snoop button */}
                  {isAdmin && (
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      {!me && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id) }}
                          className={`p-1.5 text-slate-400 hover:text-amber-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800`}
                        >
                          <Eye size={isFull ? 18 : 16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}