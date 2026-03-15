// src/features/leaderboard/ui/SurvivorStandingsTable.tsx
import { Skull, Eye } from 'lucide-react'
import { useTheme }   from '../../../shared/lib/theme'
import { Avatar }     from '../../../shared/ui'
import { useUIStore } from '../../../shared/store/uiStore'
import type { LeaderboardEntry } from '../model/selectors'

interface Props {
  title:    string
  board:    LeaderboardEntry[]
  isMe:     (userId: string) => boolean
  isAdmin:  boolean
}

export function SurvivorStandingsTable({ title, board, isMe, isAdmin }: Props) {
  const theme = useTheme()
  const openSnoop = useUIStore(s => s.openSnoop)

  return (
    <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm`}>
      <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20`}>
        <h3 className={`font-display text-lg font-black uppercase tracking-widest ${theme.textBase}`}>
          {title}
        </h3>
      </div>
      <div className="flex-1 p-4">
        {board.length === 0 ? (
          <p className={`text-sm text-center py-8 ${theme.textMuted}`}>No active players.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {board.map((entry, i) => {
              const me = isMe(entry.profile.id)
              return (
                <div key={entry.profile.id} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.borderBase} ${entry.isEliminated ? 'opacity-50 grayscale' : ''} ${me && !entry.isEliminated ? `${theme.bgMd} border-amber-500/30` : 'bg-white dark:bg-[#11141d]'}`}>
                  <span className="w-6 text-center font-bold text-slate-500 text-xs">
                    {entry.isEliminated ? <Skull size={14} className="mx-auto text-rose-500" /> : `#${i + 1}`}
                  </span>
                  <Avatar profile={entry.profile} size="sm" />
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className={`font-semibold text-sm truncate ${entry.isEliminated ? 'line-through' : theme.textBase}`}>
                      {entry.profile.display_name} {me && <span className="text-[10px] font-normal text-slate-500 ml-1 no-underline">(you)</span>}
                    </span>
                    {entry.isEliminated && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Eliminated</span>}
                  </div>
                  <div className="text-right w-16 flex-shrink-0">
                    <p className={`font-bold ${theme.textBase}`}>{entry.seedScore}</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>Seed Score</p>
                  </div>
                  {isAdmin && (
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      {!me && (
                        <button onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id); }} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Eye size={16} />
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