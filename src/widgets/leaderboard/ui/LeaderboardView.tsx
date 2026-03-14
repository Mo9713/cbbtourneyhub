// src/widgets/leaderboard/ui/LeaderboardView.tsx

import { useState, useMemo, useEffect }  from 'react'
import { BarChart2, Shield, Skull }      from 'lucide-react'
import { useTheme }                      from '../../../shared/lib/theme'
import { useAuth }                       from '../../../features/auth'
import { useTournamentListQuery }        from '../../../entities/tournament/model/queries'
import { useLeaderboardRaw }             from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }            from '../../../features/leaderboard/model/selectors'
import { Avatar }                        from '../../../shared/ui'
import type { Game, Tournament }         from '../../../shared/types'

export interface LeaderboardViewProps {
  onSnoop: (targetId: string) => void
}

export default function LeaderboardView({ onSnoop }: LeaderboardViewProps) {
  const theme  = useTheme()
  const medals = ['🥇', '🥈', '🥉']
  const { profile }                = useAuth()
  const { data: tournaments = [] } = useTournamentListQuery()
  const { data: raw }              = useLeaderboardRaw()

  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(
    () => new Set(tournaments.map((t: Tournament) => t.id)),
  )

  const toggleTournament = (id: string) => {
    setSelectedTournaments((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  useEffect(() => {
    setSelectedTournaments((prev) => {
      const serverIds = new Set(tournaments.map((t: Tournament) => t.id))
      const next      = new Set(prev)
      let   changed   = false
      tournaments.forEach((t: Tournament) => {
        if (!next.has(t.id)) { next.add(t.id); changed = true }
      })
      next.forEach((id) => {
        if (!serverIds.has(id)) { next.delete(id); changed = true }
      })
      return changed ? next : prev
    })
  }, [tournaments])

  const leaderboard = useMemo(() => {
    if (!raw || !raw.allProfiles.length) return []
    const tournamentMap = new Map<string, Tournament>(
      tournaments.map((t: Tournament) => [t.id, t]),
    )
    const scopedGames =
      selectedTournaments.size > 0
        ? raw.allGames.filter((g: Game) => selectedTournaments.has(g.tournament_id))
        : raw.allGames
    return computeLeaderboard(
      raw.allPicks,
      scopedGames,
      raw.allGames,
      raw.allProfiles,
      tournamentMap,
    )
  }, [raw, tournaments, selectedTournaments])

  const isAdmin   = profile?.is_admin ?? false
  const currentId = profile?.id ?? ''

  // N-02 FIX: dead placeholders removed — canSnoop always reduces to isAdmin.
  const canSnoop = isAdmin

  const isSurvivorMode = useMemo(() => {
    return Array.from(selectedTournaments).some(id => {
      const t = tournaments.find((t: Tournament) => t.id === id)
      return t?.game_type === 'survivor'
    })
  }, [selectedTournaments, tournaments])

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">
          Global Leaderboard
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Custom scoring per tournament · {isAdmin ? 'Click a name to snoop' : 'Live standings'}
        </p>
      </div>

      {isAdmin && tournaments.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-800 bg-amber-500/5 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1 mr-1">
              <Shield size={9} /> Filter:
            </span>
            {tournaments.map((t: Tournament) => (
              <label
                key={t.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer text-xs font-medium transition-all select-none
                  ${selectedTournaments.has(t.id)
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTournaments.has(t.id)}
                  onChange={() => toggleTournament(t.id)}
                  className="w-3 h-3 accent-amber-500"
                />
                {t.name}
                {t.scoring_config && (
                  <span className="text-[9px] text-amber-500/60 font-bold ml-0.5">CUSTOM</span>
                )}
                {t.game_type === 'survivor' && (
                  <span className="text-[9px] text-rose-500/80 font-bold ml-0.5">SURVIVOR</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-2">
          {leaderboard.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="w-8 text-center flex-shrink-0">Rank</div>
              <div className="flex-1 min-w-0">Player</div>
              {isSurvivorMode && (
                <div className="w-20 text-right flex-shrink-0 hidden sm:block">Tiebreaker</div>
              )}
              <div className="w-20 text-right flex-shrink-0">Score</div>
              {!isSurvivorMode && (
                <div className="w-24 text-right flex-shrink-0 hidden sm:block">Max Pts</div>
              )}
              {canSnoop && <div className="w-6 hidden sm:block flex-shrink-0"></div>}
            </div>
          )}

          {leaderboard.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              No picks recorded yet.
            </div>
          ) : (
            leaderboard.map((entry, i) => {
              const isMe  = entry.profile.id === currentId
              const medal = medals[i] ?? null
              const eliminatedCls = entry.isEliminated ? 'opacity-60 grayscale' : ''

              return (
                <div
                  key={entry.profile.id}
                  onClick={() => canSnoop && !isMe && onSnoop(entry.profile.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${eliminatedCls}
                    ${isMe
                      ? `${theme.bg} ${theme.border}`
                      : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                    }
                    ${canSnoop && !isMe ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-600' : ''}`}
                >
                  <div className="w-8 text-center flex-shrink-0">
                    {entry.isEliminated ? (
                      <span className="flex items-center justify-center text-red-500">
                        <Skull size={18} />
                      </span>
                    ) : medal ? (
                      <span className="text-xl">{medal}</span>
                    ) : (
                      <span className="text-sm font-bold text-slate-500">#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="relative">
                      <Avatar profile={entry.profile} size="md" />
                      {entry.isEliminated && (
                        <div className="absolute inset-0 bg-red-500/20 rounded-full" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className={`text-sm font-semibold truncate ${entry.isEliminated ? 'line-through text-slate-500' : isMe ? theme.accentB : 'text-slate-900 dark:text-white'}`}>
                        {entry.profile.display_name}
                        {isMe && <span className="text-xs font-normal text-slate-500 ml-1.5 no-underline">(you)</span>}
                      </p>
                      {entry.isEliminated && (
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-0.5">
                          Eliminated
                        </span>
                      )}
                    </div>
                  </div>

                  {isSurvivorMode && (
                    <div className="w-20 text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-bold text-slate-500 tabular-nums">
                        {entry.seedScore}
                      </p>
                    </div>
                  )}

                  <div className="w-20 text-right flex-shrink-0">
                    <p className={`text-lg font-bold tabular-nums ${entry.isEliminated ? 'text-slate-500' : isMe ? theme.accentB : 'text-slate-900 dark:text-white'}`}>
                      {entry.points}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {entry.correct}/{entry.total}
                    </p>
                  </div>

                  {!isSurvivorMode && (
                    <div className="w-24 text-right flex-shrink-0 hidden sm:block">
                      <p className={`text-sm font-medium tabular-nums ${entry.isEliminated ? 'text-slate-600' : 'text-slate-400'}`}>
                        {entry.maxPossible}
                      </p>
                    </div>
                  )}

                  {canSnoop && !isMe && (
                    <div className="w-6 hidden sm:flex items-center justify-center flex-shrink-0">
                      <BarChart2 size={14} className="text-slate-600 group-hover:text-slate-400" />
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