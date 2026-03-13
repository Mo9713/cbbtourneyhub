// src/shared/ui/Sidebar.tsx

import { useMemo }    from 'react'
import {
  Trophy, Plus, AlertTriangle, Settings,
  Home, BarChart2, LogOut, PanelLeftClose, Sun, Moon,
} from 'lucide-react'

import { useTheme }                from '../lib/theme'
import { useUIStore }              from '../store/uiStore'
import { useAuthContext }          from '../../features/auth'
import { useTournamentContext }    from '../../features/tournament'
import { useBracketPickCounts }   from '../../features/bracket'
import {
  useAllTournamentGames,
}                                  from '../../entities/tournament/model/queries'
import {
  useUpdateUIModeMutation,
}                                  from '../../entities/profile/model/queries'
import * as authService            from '../infra/authService'
import { useQueryClient }          from '@tanstack/react-query'
import { profileKeys }             from '../../entities/profile/model/queries'
import Avatar                      from './Avatar'

interface SidebarProps {
  onClose:             () => void
  onOpenAddTournament: () => void
  onToggleDesktop?:    () => void
}

const statusDot = (s: string) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

export default function Sidebar({ onClose, onOpenAddTournament, onToggleDesktop }: SidebarProps) {
  const theme      = useTheme()
  const qc         = useQueryClient()
  const activeView = useUIStore((s) => s.activeView)

  // Navigation — from Zustand directly (not through TournamentContext)
  const navigateTo   = useUIStore((s) => s.setActiveView)
  const navigateHome = useUIStore((s) => s.navigateHome)

  // Profile & auth
  const { profile }    = useAuthContext()
  const updateUIModeM  = useUpdateUIModeMutation(profile?.id)

  const handleSignOut = async () => {
    const result = await authService.signOut()
    if (result.ok) {
      qc.removeQueries({ queryKey: profileKeys.me(profile?.id) })
    }
  }

  const handleToggleUIMode = () => {
    if (!profile) return
    updateUIModeM.mutate(profile.ui_mode === 'dark' ? 'light' : 'dark')
  }

  // Tournament data — tournaments and selectTournament still live on context
  const { tournaments, selectedTournament, selectTournament } = useTournamentContext()

  // Pick counts for missing-picks indicator
  const myPickCounts = useBracketPickCounts()

  // ── Game counts per tournament (for missing-picks badge) ──
  // @deprecated useAllTournamentGames fan-out — We will replace
  // this with a leaner solution once TournamentContext is fully dissolved.
  // TanStack Query deduplicates these fetches with BracketContext's own
  // useAllTournamentGames call — no extra network requests.
  const gameQueries = useAllTournamentGames(tournaments)
  const gameCounts  = useMemo(() => {
    const counts: Record<string, number> = {}
    tournaments.forEach((t, i) => {
      counts[t.id] = gameQueries[i]?.data?.length ?? 0
    })
    return counts
  }, [tournaments, gameQueries])

  const missingPicks = useMemo(() => {
    const s = new Set<string>()
    tournaments
      .filter((t) => t.status === 'open')
      .forEach((t) => {
        const total   = gameCounts[t.id] ?? 0
        const myCount = myPickCounts[t.id] ?? 0
        if (myCount < total) s.add(t.id)
      })
    return s
  }, [tournaments, gameCounts, myPickCounts])

  if (!profile) return null

  const nav = (fn: () => void) => { fn(); onClose() }

  return (
    <div className={`flex flex-col w-64 h-full ${theme.sidebarBg} border-r border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300`}>

      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Trophy size={18} className={theme.accent} />
          <span className={`font-display text-lg font-bold uppercase tracking-widest ${theme.accent}`}>
            Bracket Hub
          </span>
        </div>
        {onToggleDesktop && (
          <button
            onClick={onToggleDesktop}
            className="hidden md:block text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 space-y-0.5 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => nav(() => navigateHome())}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
            ${activeView === 'home'
              ? `${theme.bg} ${theme.accent} font-semibold`
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
        >
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <Home size={20} />
          </div>
          Home
        </button>

        <button
          onClick={() => nav(() => navigateTo('leaderboard'))}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
            ${activeView === 'leaderboard'
              ? `${theme.bg} ${theme.accent}`
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
        >
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={20} />
          </div>
          Leaderboard
        </button>

        <button
          onClick={() => nav(() => navigateTo('settings'))}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
            ${activeView === 'settings'
              ? `${theme.bg} ${theme.accent}`
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
        >
          <Avatar profile={profile} size="md" />
          Profile
        </button>
      </nav>

      {/* Tournaments */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-0.5">
        {tournaments.map((t) => {
          const isSelected = selectedTournament?.id === t.id
          const hasMissing = missingPicks.has(t.id)

          return (
            <div
              key={t.id}
              onClick={() => nav(() => selectTournament(t))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer group
                ${isSelected
                  ? `${theme.bg} ${theme.accent} font-semibold`
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(t.status)}`} />
              <span className="truncate flex-1 text-left">{t.name}</span>
              {hasMissing && (
                <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
              )}
              {profile.is_admin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    nav(() => { selectTournament(t); navigateTo('admin') })
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:scale-110"
                >
                  <Settings size={12} className="text-amber-500" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add tournament */}
      {profile.is_admin && (
        <div className="px-3 pb-2">
          <button
            onClick={() => nav(onOpenAddTournament)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <Plus size={13} />
            Add New Tournament
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar profile={profile} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {profile.display_name}
            </p>
            {profile.is_admin && (
              <p className="text-[10px] text-amber-500 font-medium">Admin</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>

        <button
          onClick={handleToggleUIMode}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
        >
          {profile.ui_mode === 'dark' ? (
            <><Sun size={13} /> Light Mode</>
          ) : (
            <><Moon size={13} /> Dark Mode</>
          )}
        </button>
      </div>
    </div>
  )
}