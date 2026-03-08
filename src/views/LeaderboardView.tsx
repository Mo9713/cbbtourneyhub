// src/views/LeaderboardView.tsx
import { BarChart2, Shield, ExternalLink, TrendingUp } from 'lucide-react'
import { useTheme }              from '../utils/theme'
import { useAuthContext }        from '../context/AuthContext'
import {
  useLeaderboardContext,
  useLeaderboardFilter,
} from '../context/LeaderboardContext'
import { useTournamentList }     from '../context/TournamentContext'
import Avatar                    from '../components/Avatar'

interface LeaderboardViewProps {
  /** Called when an admin clicks a player row to open their bracket. */
  onSnoop: (targetId: string) => void
}

export default function LeaderboardView({ onSnoop }: LeaderboardViewProps) {
  const theme   = useTheme()
  const medals  = ['🥇', '🥈', '🥉']

  const { profile }                               = useAuthContext()
  const { leaderboard }                           = useLeaderboardContext()
  const { selectedTournaments, toggleTournament } = useLeaderboardFilter()
  const { tournaments }                           = useTournamentList()

  const maxPoints  = leaderboard[0]?.points ?? 0
  const isAdmin    = profile?.is_admin ?? false
  const currentId  = profile?.id ?? ''

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

            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_80px_100px_120px] gap-3 px-4 pb-1">
              <div className="w-8" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Player</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Score</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Accuracy</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Max Possible</span>
            </div>

            {leaderboard.map((entry, idx) => {
              const isMe = entry.profile.id === currentId
              const pct  = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
              const barW = maxPoints > 0 ? Math.round((entry.points / maxPoints) * 100) : 0

              return (
                <div
                  key={entry.profile.id}
                  className={`grid grid-cols-[auto_1fr_80px_100px_120px] gap-3 items-center px-4 py-3 rounded-xl border transition-all
                    ${isMe
                      ? `${theme.bg} ${theme.border} border`
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center">
                    {idx < 3
                      ? <span className="text-base leading-none">{medals[idx]}</span>
                      : <span className="text-xs font-bold text-slate-600">#{idx + 1}</span>
                    }
                  </div>

                  {/* Player — removed showTeam for perfect centering */}
                  <button
                    onClick={() => isAdmin && !isMe ? onSnoop(entry.profile.id) : undefined}
                    className={`flex items-center gap-3 min-w-0 text-left ${isAdmin && !isMe ? 'cursor-pointer group' : 'cursor-default'}`}
                  >
                    <Avatar profile={entry.profile} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold truncate ${isMe ? theme.accent : 'text-white'}`}>
                          {entry.profile.display_name}
                          {isMe && <span className="text-[10px] ml-1 opacity-60">(you)</span>}
                        </span>
                        {isAdmin && !isMe && (
                          <ExternalLink size={10} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                        )}
                      </div>
                      {/* Points bar */}
                      <div className="w-full max-w-[120px] h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${theme.bar}`}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Score */}
                  <div className="text-right">
                    <span className={`text-lg font-extrabold font-display ${isMe ? theme.accentB : 'text-white'}`}>
                      {entry.points}
                    </span>
                    <span className="text-[10px] text-slate-600 block">pts</span>
                  </div>

                  {/* Accuracy */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-300">
                      {entry.correct}/{entry.total}
                    </span>
                    <span className="text-[10px] text-slate-600 block flex items-center justify-end gap-0.5">
                      <TrendingUp size={8} /> {pct}%
                    </span>
                  </div>

                  {/* Max possible */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-400">{entry.maxPossible}</span>
                    <span className="text-[10px] text-slate-600 block">ceiling</span>
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