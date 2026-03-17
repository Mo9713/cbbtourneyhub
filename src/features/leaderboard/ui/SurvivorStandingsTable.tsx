import { Skull, Flame, Trophy, Eye } from 'lucide-react'
import { useTheme }   from '../../../shared/lib/theme'
import { Avatar }     from '../../../shared/ui'
import { useUIStore } from '../../../shared/store/uiStore'
import type { LeaderboardEntry } from '../model/selectors'

interface Props {
  title:   string
  board:   LeaderboardEntry[]
  isMe:    (userId: string) => boolean
  variant?: 'compact' | 'full'
  tournamentId?: string
}

export function SurvivorStandingsTable({ title, board, isMe, variant = 'compact', tournamentId }: Props) {
  const theme     = useTheme()
  const openSnoop = useUIStore(s => s.openSnoop)
  const isFull    = variant === 'full'

  const aliveCount = board.filter(e => !e.isEliminated).length
  const winnerId = aliveCount === 1 ? board.find(e => !e.isEliminated)?.profile.id : null

  return (
    <div className={`flex flex-col rounded-[2rem] border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-xl h-full`}>
      <div className={`px-6 py-5 border-b ${theme.borderBase} bg-slate-900/40`}>
        <h3 className={`font-display ${isFull ? 'text-2xl' : 'text-lg'} font-black uppercase tracking-widest ${theme.textBase}`}>
          {title}
        </h3>
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
              const isWinner = entry.profile.id === winnerId

              return (
                <div
                  key={entry.profile.id}
                  // ── REMOVED onClick FROM HERE ──
                  className={`group relative overflow-hidden flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    isWinner
                      ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : entry.isEliminated 
                        ? 'opacity-60 grayscale border-slate-800 bg-black/20 hover:grayscale-0 hover:opacity-100' 
                        : me
                          ? `${theme.bgMd} border-amber-500/40 shadow-sm`
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  } ${
                    // ── REMOVED cursor-pointer FROM HERE ──
                    !me 
                      ? 'hover:scale-[1.01] hover:border-amber-500/50 hover:shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800'
                      : ''
                  }`}
                >
                  <span className={`w-10 flex justify-center text-center font-black ${isFull ? 'text-lg' : 'text-sm'} flex-shrink-0 z-10`}>
                    {isWinner           ? <Trophy size={20} className="text-amber-500" /> :
                     entry.isEliminated ? <Skull size={18} className="text-rose-500 opacity-60" /> :
                     me                 ? <span className="text-amber-500">#{i + 1}</span> :
                     <span className="text-slate-500">#{i + 1}</span>
                    }
                  </span>

                  <div className="z-10"><Avatar profile={entry.profile} size={isFull ? 'md' : 'sm'} /></div>

                  <div className="flex-1 flex flex-col min-w-0 z-10">
                    <span className={`font-black tracking-wide truncate ${isFull ? 'text-lg' : 'text-base'} ${
                      isWinner ? 'text-amber-500' : entry.isEliminated ? 'line-through text-slate-500' : theme.textBase
                    }`}>
                      {entry.profile.display_name}
                      {me && <span className="text-[10px] font-bold text-slate-500 ml-2 no-underline uppercase tracking-widest">(you)</span>}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5 flex items-center gap-1 ${
                      isWinner ? 'text-amber-500/80' : entry.isEliminated ? 'text-rose-500/80' : 'text-emerald-500/80'
                    }`}>
                      {isWinner ? 'Winner' : entry.isEliminated ? 'Eliminated' : <><Flame size={10} /> Alive</>}
                    </span>
                  </div>

                  <div className="text-right w-20 flex-shrink-0 z-10">
                    <p className={`font-black font-display ${isWinner ? 'text-amber-500' : theme.textBase} ${isFull ? 'text-xl' : 'text-lg'}`}>
                      {entry.seedScore}
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Seed Pts</p>
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