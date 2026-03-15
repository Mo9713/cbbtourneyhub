// src/features/leaderboard/ui/StandardStandingsTable.tsx
import { Eye }        from 'lucide-react'
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

export function StandardStandingsTable({ title, board, isMe, isAdmin }: Props) {
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
                <div key={entry.profile.id} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.borderBase} ${me ? `${theme.bgMd} border-amber-500/30` : 'bg-white dark:bg-[#11141d]'}`}>
                  <span className="w-6 text-center font-bold text-slate-500 text-xs">#{i + 1}</span>
                  <Avatar profile={entry.profile} size="sm" />
                  <span className={`flex-1 font-semibold text-sm truncate ${theme.textBase}`}>
                    {entry.profile.display_name} {me && <span className="text-[10px] font-normal text-slate-500 ml-1">(you)</span>}
                  </span>
                  <div className="text-right w-16 flex-shrink-0">
                    <p className={`font-bold ${theme.accent}`}>{entry.points} pts</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>Max {entry.maxPossible}</p>
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