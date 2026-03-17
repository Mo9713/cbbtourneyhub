// src/features/leaderboard/ui/SurvivorStandingsTable.tsx
//
// FSD Refactor (Phase 1): Added `variant` prop to support 'compact' (GroupDashboard)
// and 'full' (LeaderboardView) rendering modes.

import { Skull, Eye } from 'lucide-react'
import { useTheme }   from '../../../shared/lib/theme'
import { Avatar }     from '../../../shared/ui'
import { useUIStore } from '../../../shared/store/uiStore'
import type { LeaderboardEntry } from '../model/selectors'

interface Props {
  title:   string
  board:   LeaderboardEntry[]
  isMe:    (userId: string) => boolean
  isAdmin: boolean
  variant?: 'compact' | 'full'
}

export function SurvivorStandingsTable({ title, board, isMe, isAdmin, variant = 'compact' }: Props) {
  const theme     = useTheme()
  const openSnoop = useUIStore(s => s.openSnoop)
  const isFull    = variant === 'full'

  return (
    <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm h-full`}>
      {/* ── Panel header ── */}
      <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20`}>
        <h3 className={`font-display ${isFull ? 'text-xl' : 'text-lg'} font-black uppercase tracking-widest ${theme.textBase}`}>
          {title}
        </h3>
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
                    entry.isEliminated ? 'opacity-50 grayscale' : ''
                  } ${
                    me && !entry.isEliminated
                      ? `${theme.bgMd} border-amber-500/30 shadow-sm`
                      : 'bg-white dark:bg-[#11141d]'
                  }`}
                >
                  {/* Rank or skull */}
                  <span className={`w-8 text-center font-bold text-slate-500 ${isFull ? 'text-sm' : 'text-xs'} flex-shrink-0`}>
                    {entry.isEliminated
                      ? <Skull size={isFull ? 16 : 14} className="mx-auto text-rose-500" />
                      : `#${i + 1}`
                    }
                  </span>

                  <Avatar profile={entry.profile} size={isFull ? 'md' : 'sm'} />

                  {/* Name + eliminated label */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className={`font-semibold truncate ${isFull ? 'text-base' : 'text-sm'} ${entry.isEliminated ? 'line-through text-slate-400' : theme.textBase}`}>
                      {entry.profile.display_name}
                      {me && (
                        <span className="text-[10px] font-normal text-slate-500 ml-1.5 no-underline">(you)</span>
                      )}
                    </span>
                    {entry.isEliminated && (
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">
                        Eliminated
                      </span>
                    )}
                  </div>

                  {/* Seed score */}
                  <div className={`text-right ${isFull ? 'w-24' : 'w-16'} flex-shrink-0`}>
                    <p className={`font-bold ${theme.textBase} ${isFull ? 'text-lg' : 'text-base'}`}>{entry.seedScore}</p>
                    <p className={`text-[11px] ${theme.textMuted}`}>Seed Score</p>
                  </div>

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