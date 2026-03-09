// src.views.HomeView.tsx
import { useMemo }             from 'react'
import { useTheme }            from '../../shared/utils/theme'
import { isPicksLocked }       from '../../shared/utils/time'
import { statusLabel, statusIcon } from '../../shared/utils/helpers'
import { useAuthContext }          from '../auth'
import { useTournamentContext }    from './TournamentContext'
// THE FIX: Import the renamed hook
import { useBracketPickCounts }    from '../bracket'
import type { Tournament }         from '../../shared/types'

export default function HomeView() {
  const theme = useTheme()
  const { profile }                                       = useAuthContext()
  const { tournaments, gamesCache, selectTournament }     = useTournamentContext()
  // THE FIX: Call the renamed hook
  const myPickCounts                                      = useBracketPickCounts()

  if (!profile) return null

  const open   = tournaments.filter(t => t.status === 'open')
  const draft  = profile.is_admin ? tournaments.filter(t => t.status === 'draft') : []
  const locked = tournaments.filter(t => t.status === 'locked')

  const Card = ({ t }: { t: Tournament }) => {
    const games   = gamesCache[t.id] ?? []
    const myPicks = myPickCounts[t.id] ?? 0
    const locked  = isPicksLocked(t, profile.is_admin)
    const pct     = games.length > 0 ? Math.round((myPicks / games.length) * 100) : 0

    return (
      <button
        onClick={() => selectTournament(t)}
        className={`text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.99] w-full
          ${t.status === 'open'
            ? `${theme.border} ${theme.bg} hover:${theme.bgMd}`
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
          }`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide leading-tight">
            {t.name}
          </h3>
          <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest
            ${t.status === 'open'  ? `${theme.bg} ${theme.accent}` :
              t.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
                                     'bg-slate-800 text-slate-500'}`}>
            {statusIcon(t.status)}
            {statusLabel(t.status)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{games.length} games</span>
            <span className={`font-semibold ${myPicks === games.length && games.length > 0
              ? 'text-emerald-400' : 'text-slate-400'}`}>
              {myPicks}/{games.length} picked
            </span>
          </div>

          {t.status === 'open' && !locked && games.length > 0 && (
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${theme.bgMd}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {locked && (
            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
              Picks locked
            </p>
          )}
        </div>
      </button>
    )
  }

  const Section = ({ title, items }: { title: string; items: Tournament[] }) => {
    if (items.length === 0) return null
    return (
      <div className="space-y-3">
        <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.accent}`}>{title}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(t => <Card key={t.id} t={t} />)}
        </div>
      </div>
    )
  }

  if (tournaments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
        <p className="text-sm">No tournaments yet.</p>
        {profile.is_admin && (
          <p className="text-xs">Use the sidebar to create one.</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 overflow-auto h-full">
      <Section title="Open" items={open} />
      <Section title="Draft" items={draft} />
      <Section title="Locked" items={locked} />
    </div>
  )
}


