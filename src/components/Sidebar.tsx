// src/components/Sidebar.tsx

import { useMemo } from 'react'
import { Trophy, Plus, AlertTriangle, Settings, Shield, Home, BarChart2, LogOut, Moon } from 'lucide-react'

import { useTheme }            from '../utils/theme'
import { useAuthContext }      from '../context/AuthContext'
import { useTournamentContext } from '../context/TournamentContext'
import { useAllMyPicks }       from '../context/BracketContext'
import Avatar                  from './Avatar'
import type { ActiveView }     from '../types'

interface SidebarProps {
  /** Mobile overlay: called after any navigation action to close the drawer. */
  onClose:             () => void
  /** Opens the Add Tournament modal. Owned by AppShell's useLayoutState(). */
  onOpenAddTournament: () => void
}

const statusDot = (s: string) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

export default function Sidebar({ onClose, onOpenAddTournament }: SidebarProps) {
  const theme = useTheme()

  const { profile, signOut, updateUIMode } = useAuthContext()
  const {
    tournaments,
    selectedTournament,
    gamesCache,
    activeView,
    selectTournament,
    navigateTo,
    navigateHome,
  } = useTournamentContext()
  const allMyPicks = useAllMyPicks()

  // Tournaments with at least one unpicked open game
  const missingPicks = useMemo(() => {
    const s = new Set<string>()
    tournaments.filter(t => t.status === 'open').forEach(t => {
      const tGames  = gamesCache[t.id] ?? []
      const myCount = allMyPicks.filter(p => tGames.some(g => g.id === p.game_id)).length
      if (myCount < tGames.length) s.add(t.id)
    })
    return s
  }, [tournaments, gamesCache, allMyPicks])

  if (!profile) return null

  // Wraps a navigation action with the mobile-close side-effect.
  const nav = (fn: () => void) => { fn(); onClose() }

  const navItems: Array<{ view: ActiveView; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
    { view: 'home',        label: 'Home',        icon: <Home size={14} /> },
    { view: 'leaderboard', label: 'Leaderboard', icon: <BarChart2 size={14} /> },
    { view: 'settings',    label: 'Settings',    icon: <Settings size={14} /> },
    { view: 'admin',       label: 'Admin',       icon: <Shield size={14} />, adminOnly: true },
  ]

  return (
    <aside className={`w-64 h-full flex flex-col border-r border-slate-800 ${theme.sidebarBg} overflow-hidden`}>

      {/* Logo / brand */}
      <div className={`px-5 py-4 border-b border-slate-800 flex items-center gap-2.5 ${theme.headerBg}`}>
        <Trophy size={18} className={theme.accent} />
        <span className={`font-display text-lg font-extrabold uppercase tracking-wide ${theme.accent}`}>
          {theme.logo}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-3 border-b border-slate-800">
        {navItems
          .filter(item => !item.adminOnly || profile.is_admin)
          .map(item => (
            <button
              key={item.view}
              onClick={() => nav(() => navigateTo(item.view))}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                ${activeView === item.view
                  ? `${theme.bg} ${theme.accent}`
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))
        }
      </nav>

      {/* Tournament list */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-4 py-1.5">
          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
            Tournaments
          </span>
        </div>
        {tournaments.map(t => {
          const isSelected  = selectedTournament?.id === t.id
          const hasMissing  = missingPicks.has(t.id)

          return (
            <div
              key={t.id}
              onClick={() => nav(() => {
                selectTournament(t)
                if (profile?.is_admin && t.status === 'draft') navigateTo('admin')
              })}
              className={`w-full cursor-pointer text-left px-4 py-2.5 flex items-center gap-2.5 transition-all group ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(t.status)} ${t.status === 'open' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium flex-1 truncate ${
                hasMissing ? 'text-rose-400' : isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
              }`}>
                {t.name}
              </span>
              {hasMissing && <AlertTriangle size={11} className="text-rose-400 flex-shrink-0 animate-pulse" />}
              {profile.is_admin && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    nav(() => { selectTournament(t); navigateTo('admin') })
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Settings size={12} className="text-amber-400 hover:scale-110 transition-transform" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add tournament (admin only) */}
      {profile.is_admin && (
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => nav(onOpenAddTournament)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-all ${theme.btn}`}
          >
            <Plus size={13} /> Add New Tournament
          </button>
        </div>
      )}

      {/* Theme toggle */}
      <div className="px-3 py-2 border-t border-slate-800">
        <button
          onClick={() => updateUIMode(profile.ui_mode === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs font-semibold transition-all"
        >
          <Moon size={13} /> Toggle Theme
        </button>
      </div>

      {/* Avatar + sign out */}
      <div className="p-3 border-t border-slate-800 flex items-center gap-2.5">
        <Avatar profile={profile} size={28} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{profile.display_name}</p>
          {profile.favorite_team && (
            <p className="text-[10px] text-slate-500 truncate">{profile.favorite_team}</p>
          )}
        </div>
        <button
          onClick={() => signOut()}
          title="Sign out"
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut size={13} />
        </button>
      </div>

    </aside>
  )
}