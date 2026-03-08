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
  onClose: () => void
}

const statusDot = (s: string) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

export default function Sidebar({ onClose }: SidebarProps) {
  const theme = useTheme()

  const { profile, signOut, updateUIMode }   = useAuthContext()
  const {
    tournaments,
    selectedTournament,
    gamesCache,
    activeView,
    selectTournament,
    navigateTo,
    navigateHome,
    setShowAddTournament,
  } = useTournamentContext()
  const allMyPicks = useAllMyPicks()

  // Tournaments with at least one unpicked open game
  const missingPicks = useMemo(() => {
    const s = new Set<string>()
    tournaments.filter(t => t.status === 'open').forEach(t => {
      const tGames = gamesCache[t.id] ?? []
      const picked  = allMyPicks.filter(p => tGames.some(g => g.id === p.game_id))
      if (picked.length < tGames.length) s.add(t.id)
    })
    return s
  }, [tournaments, gamesCache, allMyPicks])

  if (!profile) return null

  const nav = (action: () => void) => { action(); onClose() }

  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'home',        label: 'Home',        icon: <Home      size={13} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <BarChart2 size={13} /> },
  ]

  return (
    <aside className={`w-64 flex-shrink-0 border-r border-slate-800 flex flex-col overflow-hidden h-full ${theme.sidebarBg}`}>

      {/* Logo */}
      <button
        onClick={() => nav(navigateHome)}
        className="px-4 py-4 border-b border-slate-800 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className={`w-8 h-8 rounded-lg ${theme.logo} flex items-center justify-center shadow-lg flex-shrink-0`}>
          <Trophy size={15} className="text-white" />
        </div>
        <div>
          <div className="font-display text-sm font-extrabold text-white uppercase tracking-wider">Predictor Hub</div>
          <div className="text-[10px] text-slate-500">Conference Basketball</div>
        </div>
      </button>

      {/* Profile row → Settings */}
      <button
        onClick={() => nav(() => navigateTo('settings'))}
        className="px-4 py-3 border-b border-slate-800 flex items-center gap-2.5 hover:bg-white/5 transition-colors text-left"
      >
        <Avatar profile={profile} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{profile.display_name}</div>
          {profile.is_admin
            ? <div className="flex items-center gap-1"><Shield size={9} className="text-amber-400" /><span className="text-[10px] text-amber-400/70">Admin</span></div>
            : <div className="text-[10px] text-slate-500 truncate">{profile.favorite_team ?? 'Edit settings'}</div>
          }
        </div>
        <Settings size={11} className="text-slate-600 flex-shrink-0" />
      </button>

      {/* Nav links */}
      <div className="px-3 py-2 border-b border-slate-800">
        {navItems.map(n => (
          <button
            key={n.id}
            onClick={() => nav(() => n.id === 'home' ? navigateHome() : navigateTo(n.id))}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === n.id ? `${theme.bg} ${theme.accent}` : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* Tournament list */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-5 pt-2 pb-1">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Tournaments</span>
        </div>

        {tournaments.length === 0 && (
          <div className="px-5 py-3 text-xs text-slate-600 italic">No tournaments yet.</div>
        )}

        {tournaments.map(t => {
          const hasMissing = missingPicks.has(t.id)
          const isSelected = t.id === selectedTournament?.id
          return (
            <div
              key={t.id}
              onClick={() => nav(() => {
                selectTournament(t)
                // Auto-route to admin if it's a draft tournament!
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
                    e.stopPropagation(); // Stops the outer div from clicking
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
            onClick={() => nav(() => setShowAddTournament(true))}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-all ${theme.btn}`}
          >
            <Plus size={13} /> Add New Tournament
          </button>
        </div>
      )}

      {/* Theme Toggle */}
      <div className="px-3 py-2 border-t border-slate-800">
        <button
          onClick={() => updateUIMode(profile.ui_mode === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs font-semibold transition-all"
        >
          <Moon size={13} /> Toggle Theme
        </button>
      </div>

      {/* Sign out */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs font-semibold transition-all"
        >
          <LogOut size={13} /> Sign Out
        </button>
      </div>

    </aside>
  )
}
