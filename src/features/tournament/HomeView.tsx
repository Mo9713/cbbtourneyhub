// src/features/tournament/HomeView.tsx

import { useTheme }                 from '../../shared/lib/theme'
import { isPicksLocked }            from '../../shared/lib/time'
import { statusLabel, statusIcon }  from '../../shared/lib/helpers'
import { useAuth }                  from '../auth/model/useAuth'
import { useUIStore }               from '../../shared/store/uiStore'
import { useTournamentListQuery, useGames } from '../../entities/tournament/model/queries'
import { useMyPicks }               from '../../entities/pick/model/queries'
import type { Tournament }          from '../../shared/types'

// ── TournamentCard ────────────────────────────────────────────
// Isolated component. Fetches games and picks directly from entity layers.

interface CardProps {
  t:           Tournament
  isAdmin:     boolean
  onSelect:    (t: Tournament) => void
}

function TournamentCard({ t, isAdmin, onSelect }: CardProps) {
  const theme = useTheme()

  const { data: games = [] } = useGames(t.id)
  const { data: picks = [] } = useMyPicks(t.id, games)

  const myPickCount = picks.length
  const locked = isPicksLocked(t, isAdmin)
  const pct    = games.length > 0 ? Math.round((myPickCount / games.length) * 100) : 0

  const isEffectivelyLocked = t.status === 'locked' || (t.status === 'open' && locked)
  const displayStatus       = t.status === 'draft' ? 'draft' : isEffectivelyLocked ? 'locked' : 'open'

  return (
    <button
      onClick={() => onSelect(t)}
      className={`text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.99] w-full
        ${displayStatus === 'open'
          ? `${theme.border} ${theme.bg} hover:${theme.bgMd}`
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide leading-tight">
          {t.name}
        </h3>
        <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest
          ${displayStatus === 'open'   ? `${theme.bg} ${theme.accent}` :
            displayStatus === 'draft'  ? 'bg-amber-500/20 text-amber-400' :
                                         'bg-slate-800 text-slate-500'
          }`}
        >
          {statusIcon(displayStatus)} {statusLabel(displayStatus)}
        </span>
      </div>

      {/* Pick progress bar — only shown for open, non-admin tournaments */}
      {displayStatus === 'open' && !isAdmin && games.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Your picks</span>
            <span className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-400' : theme.accent}`}>
              {myPickCount} / {games.length}
            </span>
          </div>
          <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : theme.btn.split(' ')[0]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Draft: show game count for admin */}
      {displayStatus === 'draft' && isAdmin && (
        <p className="text-[11px] text-slate-500 mt-1">
          {games.length} game{games.length !== 1 ? 's' : ''} · Draft
        </p>
      )}
    </button>
  )
}

// ── HomeView ──────────────────────────────────────────────────

export default function HomeView() {
  const theme = useTheme()
  const { profile }                = useAuth()
  const { data: tournaments = [] } = useTournamentListQuery()
  const selectTournamentId         = useUIStore((s) => s.selectTournament)

  if (!profile) return null

  const isAdmin = profile.is_admin

  const open   = tournaments.filter((t) => t.status === 'open'   && !isPicksLocked(t, isAdmin))
  const draft  = isAdmin ? tournaments.filter((t) => t.status === 'draft') : []
  const locked = tournaments.filter(
    (t) => t.status === 'locked' || (t.status === 'open' && isPicksLocked(t, isAdmin)),
  )

  const handleSelect = (t: Tournament) => selectTournamentId(t.id)

  const renderSection = (label: string, items: Tournament[]) => {
    if (!items.length) return null
    return (
      <div className="mb-8">
        <h2 className="font-display text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
          {label}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              isAdmin={isAdmin}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    )
  }

  const noTournaments = !open.length && !draft.length && !locked.length

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-5 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h1 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">
          Tournaments
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Select a bracket to make your picks
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {noTournaments ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-slate-500 text-sm">No tournaments yet.</p>
            {isAdmin && (
              <p className="text-slate-600 text-xs mt-1">
                Use the sidebar to create your first tournament.
              </p>
            )}
          </div>
        ) : (
          <>
            {renderSection('Open', open)}
            {renderSection('Draft', draft)}
            {renderSection('Locked / Completed', locked)}
          </>
        )}
      </div>
    </div>
  )
}