// src/widgets/leaderboard/ui/LeaderboardView.tsx
//
// M-NEW-2 integration: standard bracket rows now render the user's tiebreaker
// prediction when tournament.requires_tiebreaker is true. The chip is suppressed
// entirely when the tournament does not use tiebreakers so the layout is
// unaffected for the majority of tournaments.
//
// Tiebreaker chip rendering rules:
//   · requires_tiebreaker false  → chip column hidden entirely
//   · tiebreakerScore null       → "TB: —" (user has not submitted)
//   · tiebreakerScore set        → "TB: N" (user's prediction)
// Survivor rows are unaffected — they never display a tiebreaker chip.

import { useMemo }                    from 'react'
import { Eye, Skull, Target }         from 'lucide-react'
import { useTheme }                   from '../../../shared/lib/theme'
import { useAuth }                    from '../../../features/auth'
import { useUIStore }                 from '../../../shared/store/uiStore'
import { useLeaderboardRaw }          from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }         from '../../../features/leaderboard/model/selectors'
import { Avatar }                     from '../../../shared/ui'
import type { Game, Tournament, Pick } from '../../../shared/types'

export interface LeaderboardViewProps {
  tournament: Tournament
}

export default function LeaderboardView({ tournament }: LeaderboardViewProps) {
  const theme       = useTheme()
  const { profile } = useAuth()
  const { data: raw } = useLeaderboardRaw()
  const openSnoop     = useUIStore(s => s.openSnoop)

  const leaderboard = useMemo(() => {
    if (!raw || !raw.allProfiles.length) return []

    const tournamentMap  = new Map<string, Tournament>([[tournament.id, tournament]])
    const scopedGames    = raw.allGames.filter((g: Game) => g.tournament_id === tournament.id)
    const scopedGameIds  = new Set(scopedGames.map(g => g.id))
    const scopedPicks    = raw.allPicks.filter((p: Pick) => scopedGameIds.has(p.game_id))

    // Only score and display users who have actively made picks.
    const activeParticipantIds = new Set(scopedPicks.map(p => p.user_id))
    const participants         = raw.allProfiles.filter(p => activeParticipantIds.has(p.id))

    return computeLeaderboard(
      scopedPicks,
      scopedGames,
      raw.allGames,
      participants,
      tournamentMap,
    )
  }, [raw, tournament])

  const isAdmin        = profile?.is_admin ?? false
  const currentId      = profile?.id ?? ''
  const isSurvivorMode = tournament.game_type === 'survivor'
  // Only show the tiebreaker chip column for standard bracket tournaments
  // that have requires_tiebreaker enabled.
  const showTiebreaker = !isSurvivorMode && (tournament.requires_tiebreaker === true)

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-3">

          {/* Tiebreaker active badge — shown at the top of the leaderboard */}
          {showTiebreaker && (
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-violet-500/30 text-violet-400 bg-violet-500/10">
                <Target size={10} />
                Tiebreaker: Championship Combined Score
              </span>
            </div>
          )}

          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-sm gap-2">
              <span>No picks recorded yet.</span>
            </div>
          ) : (
            leaderboard.map((entry, i) => {
              const isMe = entry.profile.id === currentId

              // ── SURVIVOR ROW ──────────────────────────────────────────────
              if (isSurvivorMode) {
                return (
                  <div
                    key={entry.profile.id}
                    className={`flex items-center gap-3 p-4 rounded-xl border ${theme.borderBase} ${
                      entry.isEliminated ? 'opacity-50 grayscale' : ''
                    } ${
                      isMe && !entry.isEliminated
                        ? `${theme.bgMd} border-amber-500/30 shadow-md`
                        : 'bg-white dark:bg-[#11141d]'
                    }`}
                  >
                    {/* Rank or skull */}
                    <span className="w-8 text-center font-bold text-slate-500 text-sm flex-shrink-0">
                      {entry.isEliminated
                        ? <Skull size={16} className="mx-auto text-rose-500" />
                        : `#${i + 1}`
                      }
                    </span>

                    <Avatar profile={entry.profile} size="md" />

                    {/* Name + eliminated label */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className={`font-semibold text-base truncate ${entry.isEliminated ? 'line-through' : theme.textBase}`}>
                        {entry.profile.display_name}
                        {isMe && (
                          <span className="text-[11px] font-normal text-slate-500 ml-1.5 no-underline">(you)</span>
                        )}
                      </span>
                      {entry.isEliminated && (
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">
                          Eliminated
                        </span>
                      )}
                    </div>

                    {/* Seed score */}
                    <div className="text-right w-24 flex-shrink-0">
                      <p className={`text-lg font-bold ${theme.textBase}`}>{entry.seedScore}</p>
                      <p className={`text-[11px] ${theme.textMuted}`}>Seed Score</p>
                    </div>

                    {/* Admin snoop */}
                    {isAdmin && (
                      <div className="w-10 flex items-center justify-center flex-shrink-0 ml-2">
                        {!isMe && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id) }}
                            className="p-2 text-slate-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              }

              // ── STANDARD BRACKET ROW ──────────────────────────────────────
              return (
                <div
                  key={entry.profile.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${theme.borderBase} ${
                    isMe
                      ? `${theme.bgMd} border-amber-500/30 shadow-md`
                      : 'bg-white dark:bg-[#11141d]'
                  }`}
                >
                  {/* Rank */}
                  <span className="w-8 text-center font-bold text-slate-500 text-sm flex-shrink-0">
                    #{i + 1}
                  </span>

                  <Avatar profile={entry.profile} size="md" />

                  {/* Name */}
                  <span className={`flex-1 font-semibold text-base truncate ${theme.textBase}`}>
                    {entry.profile.display_name}
                    {isMe && (
                      <span className="text-[11px] font-normal text-slate-500 ml-1.5">(you)</span>
                    )}
                  </span>

                  {/* Tiebreaker chip — only rendered when tournament.requires_tiebreaker is true */}
                  {showTiebreaker && (
                    <div className="flex-shrink-0 text-right w-14">
                      {entry.tiebreakerScore != null ? (
                        <p className="font-bold text-sm text-violet-400">
                          {entry.tiebreakerScore}
                        </p>
                      ) : (
                        <p className={`text-sm font-bold ${theme.textMuted} opacity-40`}>—</p>
                      )}
                      <p className={`text-[9px] uppercase tracking-widest ${theme.textMuted}`}>TB</p>
                    </div>
                  )}

                  {/* Points */}
                  <div className="text-right w-24 flex-shrink-0">
                    <p className={`text-lg font-bold ${theme.accent}`}>{entry.points} pts</p>
                    <p className={`text-[11px] ${theme.textMuted}`}>Max {entry.maxPossible}</p>
                  </div>

                  {/* Correct picks */}
                  <div className="text-right w-16 flex-shrink-0 hidden sm:block">
                    <p className={`text-base font-bold ${theme.textBase}`}>{entry.correct}</p>
                    <p className={`text-[11px] ${theme.textMuted}`}>Correct</p>
                  </div>

                  {/* Admin snoop */}
                  {isAdmin && (
                    <div className="w-10 flex items-center justify-center flex-shrink-0 ml-2">
                      {!isMe && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id) }}
                          className="p-2 text-slate-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
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