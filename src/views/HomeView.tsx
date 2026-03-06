// src/views/HomeView.tsx
import { useMemo } from 'react'
import { Trophy, Lock } from 'lucide-react'
import { useTheme } from '../utils/theme'
import { isPicksLocked } from '../utils/time'
import { statusLabel, statusIcon } from '../utils/helpers'
import type { Tournament, Profile, Game, Pick } from '../types'

interface Props {
  tournaments: Tournament[]
  profile: Profile
  allGames: Record<string, Game[]>
  picks: Pick[]
  onSelectTournament: (t: Tournament) => void
}

export default function HomeView({ tournaments, profile, allGames, picks, onSelectTournament }: Props) {
  const theme = useTheme()
  const open   = tournaments.filter(t => t.status === 'open')
  const draft  = tournaments.filter(t => t.status === 'draft')
  const locked = tournaments.filter(t => t.status === 'locked')

  const pickMap = useMemo(() => {
    const m: Record<string, number> = {}
    picks.forEach(p => {
      const g = Object.values(allGames).flat().find(g => g.id === p.game_id)
      if (g) m[g.tournament_id] = (m[g.tournament_id] ?? 0) + 1
    })
    return m
  }, [picks, allGames])

  const Card = ({ t }: { t: Tournament }) => {
    const games   = allGames[t.id] ?? []
    const myPicks = pickMap[t.id] ?? 0
    const locked  = isPicksLocked(t, profile.is_admin)
    const pct     = games.length > 0 ? Math.round((myPicks / games.length) * 100) : 0

    return (
      <button
        onClick={() => onSelectTournament(t)}
        className={`text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.99] w-full
          ${t.status === 'open'
            ? `${theme.border} ${theme.bg} hover:${theme.bgMd}`
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
          }`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide leading-tight">
            {t.name}
          </h3>
          <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest
            ${t.status === 'open'   ? `${theme.bg} ${theme.accent}` :
              t.status === 'draft'  ? 'bg-amber-500/10 text-amber-400' :
                                      'bg-slate-800 text-slate-500'}`}>
            {statusIcon(t.status)}
            {statusLabel(t.status)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{games.length} games</span>
            <span className={`font-semibold ${myPicks === games.length && games.length > 0 ? 'text-emerald-400' : theme.accent}`}>
              {myPicks}/{games.length} picks
            </span>
          </div>
          {games.length > 0 && (
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  myPicks === games.length ? 'bg-emerald-500' : theme.bar
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {locked && (
            <div className="flex items-center gap-1 text-[10px] text-slate-600">
              <Lock size={9} /> Picks locked
            </div>
          )}
        </div>
      </button>
    )
  }

  const isEmpty = tournaments.length === 0

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">Home</h2>
        <p className="text-xs text-slate-400 mt-0.5">Select a tournament to make your picks</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <Trophy size={48} className="mb-4 opacity-20" />
            <p className="text-sm">
              No tournaments yet.{profile.is_admin ? ' Create one to get started.' : ''}
            </p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            {open.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
                  Open for Picks
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {open.map(t => <Card key={t.id} t={t} />)}
                </div>
              </div>
            )}
            {locked.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
                  Locked
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {locked.map(t => <Card key={t.id} t={t} />)}
                </div>
              </div>
            )}
            {draft.length > 0 && profile.is_admin && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
                  Drafts (Admin Only)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {draft.map(t => <Card key={t.id} t={t} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}