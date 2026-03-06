// src/views/LeaderboardView.tsx
import { useState, useMemo, useEffect } from 'react'
import { BarChart2, Shield, TrendingUp, ExternalLink } from 'lucide-react'
import { useTheme } from '../utils/theme'
import { getScore } from '../utils/helpers'
import Avatar from '../components/Avatar'
import type { Pick, Game, Profile, Tournament } from '../types'

interface Props {
  allPicks: Pick[]
  allGames: Game[]
  allProfiles: Profile[]
  allTournaments: Tournament[]
  currentUserId: string
  isAdmin: boolean
  onSnoopUser: (id: string) => void
}

export default function LeaderboardView({
  allPicks, allGames, allProfiles, allTournaments,
  currentUserId, isAdmin, onSnoopUser,
}: Props) {
  const theme = useTheme()
  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(
    () => new Set(allTournaments.map(t => t.id))
  )

  useEffect(() => {
    setSelectedTournaments(new Set(allTournaments.map(t => t.id)))
  }, [allTournaments.length])

  const toggleTournament = (id: string) => {
    setSelectedTournaments(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredGames = useMemo(() =>
    isAdmin
      ? allGames.filter(g => selectedTournaments.has(g.tournament_id))
      : allGames,
    [allGames, selectedTournaments, isAdmin]
  )

  const gameMap = useMemo(() =>
    new Map(filteredGames.map(g => [g.id, g])),
    [filteredGames]
  )

  const ranked = useMemo(() => {
    const scores: Record<string, {
      profile: Profile; points: number; correct: number; total: number; maxPossible: number
    }> = {}
    allProfiles.forEach(p => {
      scores[p.id] = { profile: p, points: 0, correct: 0, total: 0, maxPossible: 0 }
    })
    allPicks.forEach(pick => {
      if (!scores[pick.user_id]) return
      const game = gameMap.get(pick.game_id)
      if (!game) return
      scores[pick.user_id].total++
      if (game.actual_winner) {
        if (game.actual_winner === pick.predicted_winner) {
          scores[pick.user_id].points  += getScore(game.round_num)
          scores[pick.user_id].correct += 1
        }
      } else {
        const eliminated = filteredGames.some(g =>
          g.actual_winner &&
          g.actual_winner !== pick.predicted_winner &&
          (g.team1_name === pick.predicted_winner || g.team2_name === pick.predicted_winner)
        )
        if (!eliminated) scores[pick.user_id].maxPossible += getScore(game.round_num)
      }
    })
    Object.values(scores).forEach(s => { s.maxPossible += s.points })
    return Object.values(scores).sort((a, b) => b.points - a.points || b.correct - a.correct)
  }, [allPicks, filteredGames, allProfiles, gameMap])

  const medals   = ['🥇', '🥈', '🥉']
  const maxPoints = ranked[0]?.points ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">
          Global Leaderboard
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Fibonacci scoring · Click a name to snoop their bracket
        </p>
      </div>

      {isAdmin && allTournaments.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-800 bg-amber-500/5 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1 mr-1">
              <Shield size={9} /> Filter:
            </span>
            {allTournaments.map(t => (
              <label key={t.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer text-xs font-medium transition-all select-none
                  ${selectedTournaments.has(t.id)
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}>
                <input
                  type="checkbox"
                  checked={selectedTournaments.has(t.id)}
                  onChange={() => toggleTournament(t.id)}
                  className="w-3 h-3 accent-amber-500"
                />
                {t.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {ranked.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <BarChart2 size={40} className="mb-3 opacity-30" />
            <p>No scored picks yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            <div className="grid grid-cols-[auto_1fr_80px_100px_120px] gap-3 px-4 pb-1">
              <div className="w-8" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Player</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Score</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Accuracy</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Max Possible</span>
            </div>

            {ranked.map((entry, idx) => {
              const isMe  = entry.profile.id === currentUserId
              const pct   = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
              const barW  = maxPoints > 0 ? (entry.points / maxPoints) * 100 : 0

              return (
                <div key={entry.profile.id}
                  className={`relative group grid grid-cols-[auto_1fr_80px_100px_120px] gap-3 items-center px-4 py-3 rounded-xl border transition-all
                    ${isMe
                      ? `${theme.bg} ${theme.border} shadow-lg ${theme.glow}`
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}>
                  <div className="w-8 text-center flex-shrink-0">
                    {idx < 3
                      ? <span className="text-lg">{medals[idx]}</span>
                      : <span className="text-slate-600 font-bold text-xs">#{idx + 1}</span>
                    }
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar profile={entry.profile} size="sm" />
                    <div className="min-w-0">
                      <button
                        onClick={() => onSnoopUser(entry.profile.id)}
                        className={`font-semibold text-sm truncate flex items-center gap-1.5 hover:underline
                          ${isMe ? theme.accentB : 'text-white hover:text-slate-200'}`}>
                        {entry.profile.display_name}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isMe && <span className={`text-[10px] font-bold uppercase ${theme.accent}`}>You</span>}
                        {entry.profile.is_admin && <Shield size={9} className="text-amber-400 flex-shrink-0" />}
                        {entry.profile.favorite_team && (
                          <span className="text-[10px] text-slate-600 truncate">{entry.profile.favorite_team}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-display text-2xl font-extrabold tabular-nums
                      ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600/80' : 'text-slate-400'}`}>
                      {entry.points}
                    </div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">pts</div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-300 tabular-nums">{pct}%</div>
                    <div className="text-[10px] text-slate-600">{entry.correct}/{entry.total}</div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm font-bold tabular-nums ${entry.maxPossible > entry.points ? theme.accent : 'text-slate-600'}`}>
                      {entry.maxPossible}
                    </div>
                    <div className="text-[10px] text-slate-600 flex items-center justify-end gap-0.5">
                      <TrendingUp size={8} /> max pts
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isMe ? theme.bar : idx < 3 ? 'bg-slate-600' : 'bg-slate-800'}`}
                      style={{ width: `${barW}%` }}
                    />
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