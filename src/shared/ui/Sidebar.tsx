// src/shared/ui/Sidebar.tsx
import { useMemo }             from 'react'
import {
  Trophy, Plus, AlertTriangle, Settings,
  Home, BarChart2, LogOut, PanelLeftClose
} from 'lucide-react'

import { useTheme }             from '../lib/theme'
import { useAuthContext }       from '../../features/auth/model/AuthContext'
import { useTournamentContext } from '../../features/tournament/model/TournamentContext'

// FIX: Changed from useBracketPickCounts to useMyPickCounts
import { useMyPickCounts }      from '../../features/bracket/model/queries' 
import Avatar                   from './Avatar'

interface SidebarProps {
  onClose:             () => void
  onOpenAddTournament: () => void
  onToggleDesktop?:    () => void
}

const statusDot = (s: string) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

export default function Sidebar({ onClose, onOpenAddTournament, onToggleDesktop }: SidebarProps) {
  const theme = useTheme()

  const { profile, signOut } = useAuthContext()
  const {
    tournaments, selectedTournament, gamesCache,
    activeView, selectTournament, navigateTo, navigateHome,
  } = useTournamentContext()
  const myPickCounts = useMyPickCounts(gamesCache)

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

  return (
    <div className={`flex flex-col w-64 h-full ${theme.sidebarBg} border-r border-slate-800 overflow-hidden`}>

      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Trophy size={18} className={theme.accent} />
          <span className={`font-display text-lg font-bold uppercase tracking-widest ${theme.accent}`}>
            Bracket Hub
          </span>
        </div>
        {onToggleDesktop && (
          <button
            onClick={onToggleDesktop}
            className="hidden md:block text-slate-500 hover:text-slate-300 transition-colors p-1"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 space-y-0.5 border-b border-slate-800">
        <button onClick={() => nav(() => navigateHome())}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeView === 'home' ? `${theme.bg} ${theme.accent}` : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <Home size={24} />
          </div>
          Home
        </button>
        <button onClick={() => nav(() => navigateTo('leaderboard'))}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeView === 'leaderboard' ? `${theme.bg} ${theme.accent}` : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={24} />
          </div>
          Leaderboard
        </button>
        <button onClick={() => nav(() => navigateTo('settings'))}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeView === 'settings' ? `${theme.bg} ${theme.accent}` : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
          <Avatar profile={profile} size="md" />
          Profile
        </button>
      </nav>

      {/* Tournaments */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {tournaments.map(t => {
          const isSelected = selectedTournament?.id === t.id
          const hasMissing = missingPicks.has(t.id)

          return (
            <div
              key={t.id}
              onClick={() => nav(() => selectTournament(t))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer group
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
              {/* Admin settings gear restored */}
              {profile.is_admin && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    nav(() => { selectTournament(t); navigateTo('admin') })
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:scale-110"
                >
                  <Settings size={12} className="text-amber-400" />
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 border border-dashed border-slate-700 hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-all"
          >
            <Plus size={13} />
            Add New Tournament
          </button>
        </div>
      )}

      {/* User footer */}
      <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-3">
        <Avatar profile={profile} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{profile.display_name}</p>
          {profile.is_admin && (
            <p className="text-[10px] text-amber-400 font-medium">Admin</p>
          )}
        </div>
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


