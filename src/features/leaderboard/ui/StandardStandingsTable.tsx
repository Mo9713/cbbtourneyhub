// src/features/leaderboard/ui/StandardStandingsTable.tsx
//
// M-NEW-2 integration: accepts `showTiebreaker` prop. When true, each row
// renders the user's tiebreaker prediction as a small chip. The chip is
// only shown when the tournament has requires_tiebreaker enabled — callers
// derive this from tournament.requires_tiebreaker and pass it down, so this
// component stays presentational and never reads the tournament directly.
//
// Chip states:
//   · tiebreakerScore is null  → "TB: —"  (not submitted)
//   · tiebreakerScore is set   → "TB: N"  (submitted, game not yet scored)
// The caller may add a delta display in the future once actual scores exist;
// for now the raw prediction is surfaced so users can see their own entry.

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
  // Show the tiebreaker chip column — pass tournament.requires_tiebreaker.
  showTiebreaker?: boolean
}

export function StandardStandingsTable({
  title,
  board,
  isMe,
  isAdmin,
  showTiebreaker = false,
}: Props) {
  const theme     = useTheme()
  const openSnoop = useUIStore(s => s.openSnoop)

  return (
    <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm`}>
      {/* ── Panel header ── */}
      <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20 flex items-center justify-between gap-3`}>
        <h3 className={`font-display text-lg font-black uppercase tracking-widest ${theme.textBase}`}>
          {title}
        </h3>
        {/* Tiebreaker indicator in header so users know the column exists */}
        {showTiebreaker && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-violet-500/30 text-violet-400 bg-violet-500/10`}>
            <Target size={9} />
            Tiebreaker On
          </span>
        )}
      </div>

      <div className="flex-1 p-4">
        {board.length === 0 ? (
          <p className={`text-sm text-center py-8 ${theme.textMuted}`}>No active players.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {board.map((entry, i) => {
              const me = isMe(entry.profile.id)
              return (
                <div
                  key={entry.profile.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${theme.borderBase} ${
                    me ? `${theme.bgMd} border-amber-500/30` : 'bg-white dark:bg-[#11141d]'
                  }`}
                >
                  {/* Rank */}
                  <span className="w-6 text-center font-bold text-slate-500 text-xs flex-shrink-0">
                    #{i + 1}
                  </span>

                  <Avatar profile={entry.profile} size="sm" />

                  {/* Name */}
                  <span className={`flex-1 font-semibold text-sm truncate ${theme.textBase}`}>
                    {entry.profile.display_name}
                    {me && (
                      <span className="text-[10px] font-normal text-slate-500 ml-1">(you)</span>
                    )}
                  </span>

                  {/* Tiebreaker chip — only rendered when the tournament uses it */}
                  {showTiebreaker && (
                    <div className="flex-shrink-0 text-right w-14">
                      {entry.tiebreakerScore != null ? (
                        <p className={`font-bold text-xs text-violet-400`}>
                          {entry.tiebreakerScore}
                        </p>
                      ) : (
                        <p className={`text-xs ${theme.textMuted} opacity-40`}>—</p>
                      )}
                      <p className={`text-[9px] ${theme.textMuted} uppercase tracking-widest`}>TB</p>
                    </div>
                  )}

                  {/* Points */}
                  <div className="text-right w-16 flex-shrink-0">
                    <p className={`font-bold ${theme.accent}`}>{entry.points} pts</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>Max {entry.maxPossible}</p>
                  </div>

                  {/* Admin snoop button */}
                  {isAdmin && (
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      {!me && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id) }}
                          className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
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