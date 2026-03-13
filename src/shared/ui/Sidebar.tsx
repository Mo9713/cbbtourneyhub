// src/shared/ui/Sidebar.tsx

import {
  Trophy, Home, Settings, LogOut, Code, Plus, Database, PanelLeftClose, Users, UserPlus
} from 'lucide-react'
import { supabase }               from '../infra/supabaseClient'
import { useTheme }               from '../lib/theme'
import { useAuth }                from '../../features/auth/model/useAuth'
import { useTournamentListQuery } from '../../entities/tournament/model/queries'
import { useUserGroupsQuery }     from '../../entities/group/api'
import { useUIStore }             from '../store/uiStore'

interface SidebarProps {
  onClose: () => void
  onOpenAddTournament?: () => void
  onToggleDesktop?: () => void
}

export default function Sidebar({ onClose, onOpenAddTournament, onToggleDesktop }: SidebarProps) {
  const theme = useTheme()
  const { profile } = useAuth()
  
  const activeView           = useUIStore(s => s.activeView)
  const setActiveView        = useUIStore(s => s.setActiveView)
  const selectedTournamentId = useUIStore(s => s.selectedTournamentId)
  const selectTournament     = useUIStore(s => s.selectTournament)
  
  const openCreateGroup      = useUIStore(s => s.openCreateGroup)
  const openJoinGroup        = useUIStore(s => s.openJoinGroup)

  const { data: tournaments = [], isLoading } = useTournamentListQuery()
  const { data: groups = [] }                 = useUserGroupsQuery()

  const isAdmin = profile?.is_admin

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const navigateTo = (view: 'home' | 'bracket' | 'leaderboard' | 'admin' | 'settings' | 'group', hash: string) => {
    setActiveView(view)
    window.location.hash = hash
    onClose()
  }

  const navItemCls = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200`

  return (
    <aside className={`w-64 h-full flex flex-col border-r shadow-2xl overflow-hidden relative ${theme.sidebarBg} border-slate-200 dark:border-slate-800 transition-colors duration-300`}>
      
      {/* ── Header ── */}
      <div className="p-5 flex-shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-slate-100 dark:bg-black/20 shadow-inner">
            <span className="text-xl leading-none drop-shadow-md">{theme.logo}</span>
          </div>
          <span className={`font-display font-extrabold text-xl tracking-tight uppercase ${theme.textBase}`}>
            Tourney<span className={theme.accent}>Hub</span>
          </span>
        </div>
        
        {/* Desktop toggle button (hidden on mobile) */}
        {onToggleDesktop && (
          <button
            onClick={onToggleDesktop}
            className={`hidden md:flex p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors`}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 py-4 px-3 space-y-6">

        {/* ── Global Hub ── */}
        <div className="space-y-1">
          <button
            onClick={() => { selectTournament(null); navigateTo('home', 'home') }}
            className={`${navItemCls} ${activeView === 'home' && !selectedTournamentId 
              ? `${theme.bgMd} ${theme.textBase} shadow-sm ring-1 ring-slate-200 dark:ring-white/10` 
              : `${theme.textMuted} hover:${theme.bg} hover:${theme.textBase}`}`}
          >
            <Home size={18} className={activeView === 'home' && !selectedTournamentId ? theme.accent : 'opacity-70'} />
            Global Hub
          </button>
        </div>

        {/* ── My Groups ── */}
        <div>
          <div className={`px-3 mb-2 flex items-center justify-between`}>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
              My Groups
            </span>
          </div>
          <div className="space-y-1">
            {groups.map((group) => {
              const isActive = activeView === 'group' && window.location.hash.includes(group.id)
              return (
                <button
                  key={group.id}
                  onClick={() => { selectTournament(null); navigateTo('group', `group/${group.id}`) }}
                  className={`${navItemCls} ${isActive
                    ? `${theme.bgMd} ${theme.textBase} shadow-sm ring-1 ring-slate-200 dark:ring-white/10`
                    : `${theme.textMuted} hover:${theme.bg} hover:${theme.textBase}`
                  }`}
                >
                  <Users size={16} className={isActive ? theme.accent : 'opacity-70'} />
                  <span className="truncate flex-1 text-left">{group.name}</span>
                </button>
              )
            })}
            
            <div className="flex gap-2 px-1 pt-2">
              <button
                onClick={() => { onClose(); openCreateGroup(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 ${theme.textBase}`}
              >
                <Plus size={12} /> Create
              </button>
              <button
                onClick={() => { onClose(); openJoinGroup(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 ${theme.textBase}`}
              >
                <UserPlus size={12} /> Join
              </button>
            </div>
          </div>
        </div>

        {/* ── Tournaments ── */}
        <div>
          <div className={`px-3 mb-2 flex items-center justify-between`}>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
              Tournaments
            </span>
            {isAdmin && onOpenAddTournament && (
              <button
                onClick={() => { onClose(); onOpenAddTournament() }}
                className={`p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors`}
                title="Create Tournament"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
          
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-slate-400 animate-pulse flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                Loading...
              </div>
            ) : tournaments.length === 0 ? (
              <div className={`px-3 py-2 text-xs italic ${theme.textMuted}`}>
                No active tournaments
              </div>
            ) : (
              tournaments.map((t) => {
                const isSelected = selectedTournamentId === t.id
                return (
                  <div key={t.id} className="group flex flex-col">
                    <button
                      onClick={() => { selectTournament(t.id); navigateTo('bracket', 'bracket') }}
                      className={`${navItemCls} ${isSelected
                        ? `${theme.bgMd} ${theme.textBase} shadow-sm ring-1 ring-slate-200 dark:ring-white/10` 
                        : `${theme.textMuted} hover:${theme.bg} hover:${theme.textBase}`
                      }`}
                    >
                      <Trophy size={16} className={isSelected ? 'text-amber-500' : 'opacity-70'} />
                      <span className="truncate flex-1 text-left">{t.name}</span>
                      
                      <div className="flex gap-1 opacity-60">
                        {t.status === 'locked' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" title="Locked" />
                        ) : t.status === 'open' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Open" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Draft" />
                        )}
                      </div>
                    </button>

                    {isSelected && (
                      <div className="ml-9 mt-1 mb-2 space-y-1 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-slate-700/50">
                        <button
                          onClick={() => navigateTo('bracket', 'bracket')}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'bracket' ? `${theme.textBase} bg-slate-100 dark:bg-white/5` : `${theme.textMuted} hover:${theme.textBase} hover:bg-slate-50 dark:hover:bg-white/5`}`}
                        >
                          <Database size={12} className={activeView === 'bracket' ? theme.accent : ''} />
                          My Bracket
                        </button>
                        <button
                          onClick={() => navigateTo('leaderboard', 'leaderboard')}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'leaderboard' ? `${theme.textBase} bg-slate-100 dark:bg-white/5` : `${theme.textMuted} hover:${theme.textBase} hover:bg-slate-50 dark:hover:bg-white/5`}`}
                        >
                          <Trophy size={12} className={activeView === 'leaderboard' ? theme.accent : ''} />
                          Leaderboard
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => navigateTo('admin', 'admin')}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'admin' ? `${theme.textBase} bg-amber-500/10 text-amber-600 dark:text-amber-400` : `${theme.textMuted} hover:${theme.textBase} hover:bg-slate-50 dark:hover:bg-white/5`}`}
                          >
                            <Code size={12} className={activeView === 'admin' ? 'text-amber-500' : ''} />
                            Admin Builder
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <div className={`p-4 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-black/20 shrink-0`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => { selectTournament(null); navigateTo('settings', 'settings') }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${activeView === 'settings' ? `${theme.textBase} ${theme.bgMd} shadow-sm ring-1 ring-slate-200 dark:ring-white/10` : `${theme.textMuted} hover:${theme.bg} hover:${theme.textBase}`}`}
          >
            <Settings size={16} className={activeView === 'settings' ? theme.accent : 'opacity-70'} />
            Settings
          </button>
          
          <button
            onClick={handleLogout}
            title="Log out"
            className={`p-2 rounded-xl ${theme.textMuted} hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors`}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}