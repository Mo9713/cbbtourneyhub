import { Target, Eye } from 'lucide-react'
import { useTheme }    from '../../../shared/lib/theme'
import { Avatar }      from '../../../shared/ui'
import { useUIStore }  from '../../../shared/store/uiStore'
import type { LeaderboardEntry } from '../model/selectors'

interface Props {
  title:           string
  board:           LeaderboardEntry[]
  isMe:            (userId: string) => boolean
  showTiebreaker?: boolean
  variant?:        'compact' | 'full'
  tournamentId?:   string
}

export function StandardStandingsTable({ title, board, isMe, showTiebreaker = false, variant = 'compact', tournamentId }: Props) {
  const theme     = useTheme()
  const openSnoop = useUIStore(s => s.openSnoop)
  const isFull    = variant === 'full'

  return (
    <div className={`flex flex-col rounded-[2rem] border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-xl h-full`}>
      <div className={`px-6 py-5 border-b ${theme.borderBase} bg-slate-900/40 flex items-center justify-between gap-3`}>
        <h3 className={`font-display ${isFull ? 'text-2xl' : 'text-lg'} font-black uppercase tracking-widest ${theme.textBase}`}>
          {title}
        </h3>
        {showTiebreaker && (
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-violet-500/30 text-violet-400 bg-violet-500/10`}>
            <Target size={12} />
            {isFull ? 'Tiebreaker: Champion Score' : 'TB On'}
          </span>
        )}
      </div>

      <div className="flex-1 p-5 overflow-y-auto scrollbar-thin">
        {board.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-32 text-sm ${theme.textMuted}`}>
            No active players.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {board.map((entry, i) => {
              const me = isMe(entry.profile.id)
              return (
                <div
                  key={entry.profile.id}
                  // ── REMOVED onClick FROM HERE ──
                  className={`group relative overflow-hidden flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    me 
                      ? `${theme.bgMd} border-amber-500/40 shadow-sm` 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  } ${
                    // ── REMOVED cursor-pointer FROM HERE ──
                    !me
                      ? 'hover:scale-[1.01] hover:border-amber-500/50 hover:shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800'
                      : ''
                  }`}
                >
                  <span className={`w-8 text-center font-black ${me ? 'text-amber-500' : 'text-slate-500'} ${isFull ? 'text-lg' : 'text-sm'} flex-shrink-0 z-10`}>
                    #{i + 1}
                  </span>

                  <div className="z-10"><Avatar profile={entry.profile} size={isFull ? 'md' : 'sm'} /></div>

                  <div className="flex-1 flex flex-col min-w-0 z-10">
                    <span className={`font-black tracking-wide truncate ${theme.textBase} ${isFull ? 'text-lg' : 'text-base'}`}>
                      {entry.profile.display_name}
                      {me && <span className="text-[10px] font-bold text-slate-500 ml-2 uppercase tracking-widest">(you)</span>}
                    </span>
                    {isFull && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                        {entry.correct} Picks Correct
                      </span>
                    )}
                  </div>

                  {showTiebreaker && (
                    <div className="flex-shrink-0 text-right w-16 border-r border-slate-200 dark:border-slate-800 pr-4 mr-2 z-10">
                      {entry.tiebreakerScore != null ? (
                        <p className={`font-black font-display ${isFull ? 'text-lg' : 'text-base'} text-violet-400`}>
                          {entry.tiebreakerScore}
                        </p>
                      ) : (
                        <p className={`${isFull ? 'text-lg' : 'text-base'} font-black ${theme.textMuted} opacity-40`}>—</p>
                      )}
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Tie</p>
                    </div>
                  )}

                  <div className={`text-right ${isFull ? 'w-24' : 'w-20'} flex-shrink-0 z-10`}>
                    <p className={`font-black font-display leading-none mb-1 ${me ? 'text-amber-500' : theme.textBase} ${isFull ? 'text-2xl' : 'text-xl'}`}>
                      {entry.points}
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
                      Max: {entry.maxPossible}
                    </p>
                  </div>

                  {/* ── SLEEK SNOOP OVERLAY (NOW CLICKABLE!) ── */}
                  {!me && (
                    <div 
                      onClick={() => openSnoop(entry.profile.id, tournamentId)}
                      className="absolute inset-y-0 right-0 w-32 md:w-48 bg-gradient-to-l from-slate-900 via-slate-900/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-end pr-6 z-20 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/50 px-3 py-1.5 rounded-lg transform translate-x-4 group-hover:translate-x-0 transition-transform duration-300">
                        <Eye size={14} className="text-amber-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Snoop</span>
                      </div>
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