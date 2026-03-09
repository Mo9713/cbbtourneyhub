// src.views.LeaderboardView.tsx
import { useState, useMemo }         from 'react'
import { BarChart2, Shield }         from 'lucide-react'
import { useTheme }                  from '../../shared/utils/theme'
import { useAuthContext }            from '../auth'
import { useTournamentList }         from '../tournament'
import { useLeaderboardRaw }         from './queries'
import { computeLeaderboard }        from './selectors'
import Avatar                        from '../../shared/components/Avatar'

interface LeaderboardViewProps {
  onSnoop: (targetId: string) => void
}

export default function LeaderboardView({ onSnoop }: LeaderboardViewProps) {
  const theme  = useTheme()
  const medals = ['🥇', '🥈', '🥉']

  const { profile }          = useAuthContext()
  const { tournaments }      = useTournamentList()
  const { data: raw }        = useLeaderboardRaw()

  // Admin filter — local UI state, not server state
  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(
    () => new Set(tournaments.map(t => t.id)),
  )

  const toggleTournament = (id: string) => {
    setSelectedTournaments(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Seed new tournament IDs into the filter automatically
  useMemo(() => {
    setSelectedTournaments(prev => {
      const next     = new Set(prev)
      let   changed  = false
      tournaments.forEach(t => { if (!next.has(t.id)) { next.add(t.id); changed = true } })
      return changed ? next : prev
    })
  }, [tournaments])

  const leaderboard = useMemo(() => {
    if (!raw || !raw.allProfiles.length) return []
    const tournamentMap = new Map(tournaments.map(t => [t.id, t]))
    const scopedGames   = selectedTournaments.size > 0
      ? raw.allGames.filter(g => selectedTournaments.has(g.tournament_id))
      : raw.allGames
    return computeLeaderboard(raw.allPicks, scopedGames, raw.allGames, raw.allProfiles, tournamentMap)
  }, [raw, tournaments, selectedTournaments])

  const maxPoints = leaderboard[0]?.points ?? 0
  const isAdmin   = profile?.is_admin ?? false
  const currentId = profile?.id ?? ''

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">
          Global Leaderboard
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Custom scoring per tournament · {isAdmin ? 'Click a name to snoop' : 'Live standings'}
        </p>
      </div>

      {/* Admin tournament filter */}
      {isAdmin && tournaments.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-800 bg-amber-500/5 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1 mr-1">
              <Shield size={9} /> Filter:
            </span>
            {tournaments.map(t => (
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

      {/* Rows */}
      <div className="flex-1 overflow-auto p-6">
        {leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <BarChart2 size={40} className="mb-3 opacity-30" />
            <p>No scored picks yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">

            <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_80px_100px_120px] gap-3 px-4 pb-1">
              <div className="w-6 md:w-8" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Player</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Score</span>
              <span className="hidden md:block text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Accuracy</span>
              <span className="hidden md:block text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Max Possible</span>
            </div>

            {leaderboard.map((entry, idx) => {
              const isMe = entry.profile.id === currentId
              const pct  = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
              const barW = maxPoints > 0 ? Math.round((entry.points / maxPoints) * 100) : 0

              return (
                <div
                  key={entry.profile.id}
                  onClick={() => isAdmin && onSnoop(entry.profile.id)}
                  className={`grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_80px_100px_120px] gap-3 items-center px-4 py-3 rounded-xl border transition-all
                    ${isAdmin ? 'cursor-pointer' : ''}
                    ${isMe
                      ? `${theme.bg} ${theme.border} border`
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                >
                  <div className="w-6 md:w-8 text-center">
                    {idx < 3
                      ? <span className="text-base">{medals[idx]}</span>
                      : <span className="text-xs font-bold text-slate-500">{idx + 1}</span>
                    }
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar profile={entry.profile} size="sm" />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? theme.accent : 'text-white'}`}>
                        {entry.profile.display_name}
                        {isMe && <span className="ml-1.5 text-[10px] font-bold opacity-60">(you)</span>}
                      </p>
                      <div className="h-1 mt-1 rounded-full bg-slate-800 overflow-hidden w-full max-w-[120px]">
                        <div
                          className={`h-full rounded-full transition-all ${isMe ? theme.accent : 'bg-slate-600'}`}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-bold ${isMe ? theme.accent : 'text-white'}`}>
                      {entry.points}
                    </span>
                    <span className="text-xs text-slate-500"> pts</span>
                  </div>

                  <div className="hidden md:block text-right">
                    <span className="text-sm font-semibold text-slate-300">{pct}%</span>
                    <p className="text-[10px] text-slate-600">{entry.correct}/{entry.total}</p>
                  </div>

                  <div className="hidden md:block text-right">
                    <span className="text-sm font-semibold text-slate-400">{entry.maxPossible}</span>
                    <p className="text-[10px] text-slate-600">max pts</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


