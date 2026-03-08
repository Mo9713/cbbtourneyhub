// src/components/Sidebar.tsx
import { useMemo }             from 'react'
import {
  Trophy, Plus, AlertTriangle, Settings,
  Shield, Home, BarChart2, LogOut, Moon,
} from 'lucide-react'

import { useTheme }             from '../utils/theme'
import { useAuthContext }       from '../context/AuthContext'
import { useTournamentContext } from '../context/TournamentContext'
import { useMyPickCounts }      from '../context/BracketContext'
import Avatar                   from './Avatar'
import type { ActiveView }      from '../types'

interface SidebarProps {
  onClose:             () => void
  onOpenAddTournament: () => void
}

const statusDot = (s: string) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

export default function Sidebar({ onClose, onOpenAddTournament }: SidebarProps) {
  const theme = useTheme()

  const { profile, signOut, updateUIMode } = useAuthContext()
  const {
    tournaments, selectedTournament, gamesCache,
    activeView, selectTournament, navigateTo, navigateHome,
  } = useTournamentContext()
  const myPickCounts = useMyPickCounts()

  const missingPicks = useMemo(() => {
    const s = new Set<string>()
    tournaments.filter(t => t.status === 'open').forEach(t => {
      const tGames = gamesCache[t.id] ?? []
      if ((myPickCounts[t.id] ?? 0) < tGames.length) s.add(t.id)
    })
    return s
  }, [tournaments, gamesCache, myPickCounts])

  if (!profile) return null

  const nav = (fn: () => void) => { fn(); onClose() }

  const navItems: Array<{ view: ActiveView; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
    { view: 'home',        label: 'Home',        icon: <Home     size={16} /> },
    { view: 'leaderboard', label: 'Leaderboard', icon: <BarChart2 size={16} /> },
    ...(profile.is_admin ? [{ view: 'admin' as ActiveView, label: 'Admin', icon: <Shield size={16} />, adminOnly: true }] : []),
    { view: 'settings',    label: 'Settings',    icon: <Settings  size={16} /> },
  ]

  return (
    <div className={`flex flex-col w-64 h-full ${theme.sidebarBg} border-r border-slate-800 overflow-hidden`}>

      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2.5">
        <Trophy size={18} className={theme.accent} />
        <span className={`font-display text-lg font-bold uppercase tracking-widest ${theme.accent}`}>
          {theme.logo}
        </span>
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 space-y-0.5 border-b border-slate-800">
        {navItems.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => nav(() => view === 'home' ? navigateHome() : navigateTo(view))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
              ${activeView === view
                ? `${theme.bg} ${theme.accent}`
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* Tournaments */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {tournaments.map(t => {
          const isSelected = selectedTournament?.id === t.id
          const hasMissing = missingPicks.has(t.id)

          return (
            <button
              key={t.id}
              onClick={() => nav(() => selectTournament(t))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all
                ${isSelected
                  ? `${theme.bg} ${theme.accent} font-semibold`
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(t.status)}`} />
              <span className="truncate flex-1 text-left">{t.name}</span>
              {hasMissing && (
                <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Add tournament */}
      {profile.is_admin && (
        <div className="px-3 pb-2">
          <button
            onClick={() => nav(onOpenAddTournament)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500
              hover:text-slate-300 hover:bg-slate-800/60 transition-all"
          >
            <Plus size={13} />
            Add New Tournament
          </button>
        </div>
      )}

      {/* User footer */}
      <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-3">
        <Avatar profile={profile} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{profile.display_name}</p>
          {profile.is_admin && (
            <p className="text-[10px] text-amber-400 font-medium">Admin</p>
          )}
        </div>
        <button
          onClick={() => updateUIMode(profile.ui_mode === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          title="Toggle theme"
        >
          <Moon size={13} />
        </button>
        <button
          onClick={() => signOut()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>

    </div>
  )
}