// src/components/Sidebar.tsx
import { useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Trophy, Plus, AlertTriangle, Settings, Shield,
  Home, BarChart2, LogOut,
} from 'lucide-react'
import { useTheme } from '../utils/theme'
import Avatar from './Avatar'
import type { Tournament, Game, Pick, Profile, ActiveView } from '../types'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

type StatusType = 'open' | 'draft' | 'locked'
const statusDot = (s: StatusType) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

interface SidebarProps {
  tournaments: Tournament[]
  selectedId: string | null
  gamesCache: Record<string, Game[]>
  picks: Pick[]
  profile: Profile
  activeView: ActiveView
  onSelectTournament: (t: Tournament) => void
  onAddTournament: () => void
  onSetView: (v: ActiveView) => void
  onHome: () => void
  onClose: () => void
}

export default function Sidebar({
  tournaments, selectedId, gamesCache, picks, profile, activeView,
  onSelectTournament, onAddTournament, onSetView, onHome, onClose,
}: SidebarProps) {
  const theme = useTheme()

  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'home',        label: 'Home',        icon: <Home      size={13} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <BarChart2 size={13} /> },
  ]

  const missingPicks = useMemo(() => {
    const s = new Set<string>()
    tournaments.filter(t => t.status === 'open').forEach(t => {
      const tGames = gamesCache[t.id] ?? []
      const picked = picks.filter(p => tGames.some(g => g.id === p.game_id))
      if (picked.length < tGames.length) s.add(t.id)
    })
    return s
  }, [tournaments, gamesCache, picks])

  const nav = (action: () => void) => { action(); onClose() }

  return (
    <aside className={`w-64 flex-shrink-0 border-r border-slate-800 flex flex-col overflow-hidden h-full ${theme.sidebarBg}`}>
      {/* Logo / Home */}
      <button onClick={() => nav(onHome)}
        className="px-4 py-4 border-b border-slate-800 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
        <div className={`w-8 h-8 rounded-lg ${theme.logo} flex items-center justify-center shadow-lg flex-shrink-0`}>
          <Trophy size={15} className="text-white" />
        </div>
        <div>
          <div className="font-display text-sm font-extrabold text-white uppercase tracking-wider">Predictor Hub</div>
          <div className="text-[10px] text-slate-500">Conference Basketball</div>
        </div>
      </button>

      {/* Profile row */}
      <button onClick={() => nav(() => onSetView('settings'))}
        className="px-4 py-3 border-b border-slate-800 flex items-center gap-2.5 hover:bg-white/5 transition-colors text-left">
        <Avatar profile={profile} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{profile.display_name}</div>
          {profile.is_admin
            ? <div className="flex items-center gap-1"><Shield size={9} className="text-amber-400" /><span className="text-[10px] text-amber-400/70">Admin</span></div>
            : <div className="text-[10px] text-slate-500 truncate">{profile.favorite_team ?? 'Edit settings'}</div>}
        </div>
        <Settings size={11} className="text-slate-600 flex-shrink-0" />
      </button>

      {/* Nav items */}
      <div className="px-3 py-2 border-b border-slate-800">
        {navItems.map(n => (
          <button key={n.id}
            onClick={() => nav(() => { if (n.id === 'home') onHome(); else onSetView(n.id) })}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === n.id ? `${theme.bg} ${theme.accent}` : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}>
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
          const isSelected = t.id === selectedId
          return (
            <button key={t.id} onClick={() => nav(() => onSelectTournament(t))}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-all group ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}`}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(t.status)} ${t.status === 'open' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium flex-1 truncate ${
                hasMissing ? 'text-rose-400' : isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
              }`}>{t.name}</span>
              {hasMissing && <AlertTriangle size={11} className="text-rose-400 flex-shrink-0 animate-pulse" />}
              {profile.is_admin && (
                <button
                  onClick={e => { e.stopPropagation(); nav(() => { onSelectTournament(t); onSetView('admin') }) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Settings size={10} className="text-amber-400" />
                </button>
              )}
            </button>
          )
        })}
      </div>

      {/* Add tournament (admin) */}
      {profile.is_admin && (
        <div className="p-3 border-t border-slate-800">
          <button onClick={() => nav(onAddTournament)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-all ${theme.btn}`}>
            <Plus size={13} /> Add New Tournament
          </button>
        </div>
      )}

      {/* Sign out */}
      <div className="p-3 border-t border-slate-800">
        <button onClick={() => supabase.auth.signOut()}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs font-semibold transition-all">
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </aside>
  )
}