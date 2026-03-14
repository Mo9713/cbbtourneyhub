// src/widgets/leaderboard/ui/LeaderboardView.tsx

import { useMemo }                       from 'react'
import { Eye, Skull }                    from 'lucide-react'
import { useTheme }                      from '../../../shared/lib/theme'
import { useAuth }                       from '../../../features/auth'
import { useUIStore }                    from '../../../shared/store/uiStore'
import { useLeaderboardRaw }             from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }            from '../../../features/leaderboard/model/selectors'
import { Avatar }                        from '../../../shared/ui'
import type { Game, Tournament, Pick }   from '../../../shared/types'

export interface LeaderboardViewProps {
  tournament: Tournament
}

export default function LeaderboardView({ tournament }: LeaderboardViewProps) {
  const theme  = useTheme()
  const { profile }   = useAuth()
  const { data: raw } = useLeaderboardRaw()
  const openSnoop     = useUIStore(s => s.openSnoop)

  const leaderboard = useMemo(() => {
    if (!raw || !raw.allProfiles.length) return []
    
    const tournamentMap = new Map<string, Tournament>([[tournament.id, tournament]])
    const scopedGames = raw.allGames.filter((g: Game) => g.tournament_id === tournament.id)
    const scopedGameIds = new Set(scopedGames.map(g => g.id))
    const scopedPicks = raw.allPicks.filter((p: Pick) => scopedGameIds.has(p.game_id))

    return computeLeaderboard(
      scopedPicks,
      scopedGames,
      raw.allGames,
      raw.allProfiles,
      tournamentMap,
    )
  }, [raw, tournament])

  const isAdmin   = profile?.is_admin ?? false
  const currentId = profile?.id ?? ''
  const isSurvivorMode = tournament.game_type === 'survivor'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-3">
          
          {leaderboard.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-64 text-slate-500 text-sm gap-2`}>
              <span>No picks recorded yet.</span>
            </div>
          ) : (
            leaderboard.map((entry, i) => {
              const isMe  = entry.profile.id === currentId

              // ── SURVIVOR ROW ──
              if (isSurvivorMode) {
                return (
                  <div key={entry.profile.id} className={`flex items-center gap-3 p-4 rounded-xl border ${theme.borderBase} ${entry.isEliminated ? 'opacity-50 grayscale' : ''} ${isMe && !entry.isEliminated ? `${theme.bgMd} border-amber-500/30 shadow-md` : 'bg-white dark:bg-[#11141d]'}`}>
                    <span className="w-8 text-center font-bold text-slate-500 text-sm">
                      {entry.isEliminated ? <Skull size={16} className="mx-auto text-rose-500" /> : `#${i + 1}`}
                    </span>
                    <Avatar profile={entry.profile} size="md" />
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className={`font-semibold text-base truncate ${entry.isEliminated ? 'line-through' : theme.textBase}`}>
                        {entry.profile.display_name} {isMe && <span className="text-[11px] font-normal text-slate-500 ml-1.5 no-underline">(you)</span>}
                      </span>
                      {entry.isEliminated && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Eliminated</span>}
                    </div>
                    <div className="text-right w-24 flex-shrink-0">
                      <p className={`text-lg font-bold ${theme.textBase}`}>{entry.seedScore}</p>
                      <p className={`text-[11px] ${theme.textMuted}`}>Seed Score</p>
                    </div>
                    {isAdmin && (
                      <div className="w-10 flex items-center justify-center flex-shrink-0 ml-2">
                        {!isMe && (
                           <button onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id); }} className="p-2 text-slate-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                             <Eye size={18} />
                           </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              }

              // ── STANDARD ROW ──
              return (
                <div key={entry.profile.id} className={`flex items-center gap-3 p-4 rounded-xl border ${theme.borderBase} ${isMe ? `${theme.bgMd} border-amber-500/30 shadow-md` : 'bg-white dark:bg-[#11141d]'}`}>
                  <span className="w-8 text-center font-bold text-slate-500 text-sm">
                     #{i + 1}
                  </span>
                  <Avatar profile={entry.profile} size="md" />
                  <span className={`flex-1 font-semibold text-base truncate ${theme.textBase}`}>
                    {entry.profile.display_name} {isMe && <span className="text-[11px] font-normal text-slate-500 ml-1.5">(you)</span>}
                  </span>
                  <div className="text-right w-24 flex-shrink-0">
                    <p className={`text-lg font-bold ${theme.accent}`}>{entry.points} pts</p>
                    <p className={`text-[11px] ${theme.textMuted}`}>Max {entry.maxPossible}</p>
                  </div>
                  {isAdmin && (
                    <div className="w-10 flex items-center justify-center flex-shrink-0 ml-2">
                      {!isMe && (
                         <button onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id); }} className="p-2 text-slate-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                           <Eye size={18} />
                         </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}