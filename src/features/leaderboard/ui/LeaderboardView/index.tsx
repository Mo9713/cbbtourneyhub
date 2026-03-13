// src/features/leaderboard/ui/LeaderboardView/index.tsx

import { useState, useMemo, useEffect } from 'react'
import { BarChart2, Shield }             from 'lucide-react'
import { useTheme }                      from '../../../../shared/lib/theme'
import { useAuth }                       from '../../../auth/model/useAuth'
import { useTournamentListQuery }        from '../../../../entities/tournament/model/queries'
import { useLeaderboardRaw }             from '../../../../entities/leaderboard/model/queries'
import { computeLeaderboard }            from '../../model/selectors'
import Avatar                            from '../../../../shared/ui/Avatar'
import type { Game }                     from '../../../../shared/types'

interface LeaderboardViewProps {
  onSnoop: (targetId: string) => void
}

export default function LeaderboardView({ onSnoop }: LeaderboardViewProps) {
  const theme  = useTheme()
  const medals = ['🥇', '🥈', '🥉']

  const { profile }                          = useAuth()
  const { data: tournaments = [] }           = useTournamentListQuery()
  const { data: raw }                        = useLeaderboardRaw()

  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(
    () => new Set(tournaments.map((t) => t.id)),
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
      const serverIds = new Set(tournaments.map((t) => t.id))
      const next      = new Set(prev)
      let   changed   = false

      tournaments.forEach((t) => {
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
    const tournamentMap = new Map(tournaments.map((t) => [t.id, t]))
    const scopedGames   =
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

  const maxPoints = leaderboard[0]?.points ?? 0
  const isAdmin   = profile?.is_admin ?? false
  const currentId = profile?.id ?? ''

  return (
    <div className="flex flex-col h-full">

      <div className={`px-6 py-4 border-b flex-shrink-0 ${useTheme().headerBg}`}>
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
            {tournaments.map((t) => (
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
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {leaderboard.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            No picks recorded yet.
          </div>
        ) : (
          <div className="max-w-2xl space-y-2">
            {leaderboard.map((entry, i) => {
              const isMe   = entry.profile.id === currentId
              const medal  = medals[i] ?? null
              const barPct = maxPoints > 0 ? (entry.points / maxPoints) * 100 : 0

              return (
                <div
                  key={entry.profile.id}
                  onClick={() => isAdmin && !isMe && onSnoop(entry.profile.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
                    ${isMe
                      ? `${theme.bg} ${theme.border}`
                      : 'bg-slate-900/50 border-slate-800'
                    }
                    ${isAdmin && !isMe ? 'cursor-pointer hover:border-slate-600' : ''}`}
                >
                  <div className="w-8 text-center flex-shrink-0">
                    {medal
                      ? <span className="text-xl">{medal}</span>
                      : <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                    }
                  </div>

                  <Avatar profile={entry.profile} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isMe ? theme.accentB : 'text-white'}`}>
                      {entry.profile.display_name}
                      {isMe && <span className="text-xs font-normal text-slate-500 ml-1.5">(you)</span>}
                    </p>
                    <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden w-full max-w-xs">
                      <div
                        className={`h-full rounded-full transition-all ${isMe ? theme.btn.split(' ')[0] : 'bg-slate-600'}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold tabular-nums ${isMe ? theme.accentB : 'text-white'}`}>
                      {entry.points}
                      <span className="text-xs font-normal text-slate-500 ml-0.5">pts</span>
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {entry.correct}/{entry.total} correct
                    </p>
                    {entry.maxPossible > entry.points && (
                      <p className="text-[10px] text-emerald-600 tabular-nums">
                        +{entry.maxPossible - entry.points} possible
                      </p>
                    )}
                  </div>

                  {isAdmin && !isMe && (
                    <BarChart2 size={13} className="text-slate-600 flex-shrink-0" />
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