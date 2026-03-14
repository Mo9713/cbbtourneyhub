// src/widgets/sidebar/ui/Sidebar.tsx
//
// MOD-01 FIX: useUserGroupsQuery is now imported from the
// entities/group public API (index.ts), not the internal model
// sublayer. Direct imports into a slice's internals violate the
// FSD Public API Enforcement rule and create fragile coupling to
// internal file structure.

import {
  Trophy, Home, Settings, LogOut, Plus, PanelLeftClose,
  Users, UserPlus, Settings2, Moon, Sun, Shield,
} from 'lucide-react'

import { useTheme }               from '../../../shared/lib/theme'
import { useUIStore }             from '../../../shared/store/uiStore'
import { useAuth }                from '../../../features/auth'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
// MOD-01 FIX: Import from the public slice index, not the internal /model sublayer.
import { useUserGroupsQuery }     from '../../../entities/group'
import { Avatar }                 from '../../../shared/ui'
import type { ActiveView, Tournament, Group } from '../../../shared/types'

interface SidebarProps {
  onClose:              () => void
  onOpenAddTournament?: () => void
  onToggleDesktop?:     () => void
}

export default function Sidebar({ onClose, onOpenAddTournament, onToggleDesktop }: SidebarProps) {
  const theme = useTheme()
  const { profile, signOut, updateUIMode } = useAuth()

  const activeView           = useUIStore(s => s.activeView)
  const setActiveView        = useUIStore(s => s.setActiveView)
  const activeGroupId        = useUIStore(s => s.activeGroupId)
  const setActiveGroup       = useUIStore(s => s.setActiveGroup)
  const selectedTournamentId = useUIStore(s => s.selectedTournamentId)
  const selectTournament     = useUIStore(s => s.selectTournament)
  const openCreateGroup      = useUIStore(s => s.openCreateGroup)
  const openJoinGroup        = useUIStore(s => s.openJoinGroup)

  const { data: allTournaments = [], isLoading } = useTournamentListQuery()
  const { data: groups = [] }                    = useUserGroupsQuery()

  const isAdmin = profile?.is_admin

  const tournaments = activeGroupId
    ? allTournaments.filter((t: Tournament) => t.group_id === activeGroupId)
    : allTournaments.filter((t: Tournament) => !t.group_id)

  const handleLogout = async () => {
    await signOut()
  }

  const navigateTo = (view: ActiveView) => {
    setActiveView(view)
    onClose()
  }

  const navItemCls = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200`
  const hoverCls   = `hover:bg-slate-200/60 dark:hover:bg-white/5`

  return (
    <aside className={`w-64 h-full flex flex-col border-r shadow-2xl overflow-hidden relative bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 transition-colors duration-300`}>

      <div className="p-5 flex-shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-slate-200 dark:bg-black/20 shadow-inner">
            <span className="text-xl leading-none drop-shadow-md">{theme.logo}</span>
          </div>
          <span className={`font-display font-extrabold text-xl tracking-tight uppercase text-slate-900 dark:text-white`}>
            Tourney<span className={theme.accent}>Hub</span>
          </span>
        </div>
        {onToggleDesktop && (
          <button
            onClick={onToggleDesktop}
            className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 py-4 px-3 space-y-6">

        <div className="space-y-1">
          <button
            onClick={() => { setActiveGroup(null); selectTournament(null); navigateTo('home') }}
            className={`${navItemCls} ${activeView === 'home' && !selectedTournamentId
              ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10`
              : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 ${hoverCls}`}`}
          >
            <Home size={18} className={activeView === 'home' && !selectedTournamentId ? theme.accent : 'opacity-70'} />
            Home
          </button>
        </div>

        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400`}>
              My Groups
            </span>
          </div>
          <div className="space-y-1">
            {groups.map((group: Group) => {
              const isActive = activeGroupId === group.id
              return (
                <div key={group.id} className="group flex items-center justify-between">
                  <button
                    onClick={() => {
                      setActiveGroup(group.id)
                      selectTournament(null)
                      navigateTo('group')
                    }}
                    className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 min-w-0 ${isActive
                      ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10`
                      : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 ${hoverCls}`
                    }`}
                  >
                    <Users size={16} className={isActive ? theme.accent : 'opacity-70'} />
                    <span className="truncate flex-1 text-left">{group.name}</span>
                  </button>
                </div>
              )
            })}

            <div className="flex gap-2 px-1 pt-2">
              <button
                onClick={() => { onClose(); openCreateGroup() }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-300 dark:border-white/5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white`}
              >
                <Plus size={12} /> Create
              </button>
              <button
                onClick={() => { onClose(); openJoinGroup() }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-300 dark:border-white/5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white`}
              >
                <UserPlus size={12} /> Join
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400`}>
              {activeGroupId ? 'Group Tournaments' : 'Global Tournaments'}
            </span>
            {isAdmin && onOpenAddTournament && (
              <button
                onClick={() => { onClose(); onOpenAddTournament() }}
                className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Create Tournament"
              >
                <Plus size={12} />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 animate-pulse flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                Loading...
              </div>
            ) : tournaments.length === 0 ? (
              <div className={`px-3 py-2 text-xs italic text-slate-500 dark:text-slate-400`}>
                No active tournaments
              </div>
            ) : (
              tournaments.map((t: Tournament) => {
                const isSelected = selectedTournamentId === t.id
                return (
                  <div key={t.id} className="group flex items-center justify-between">
                    <button
                      onClick={() => { selectTournament(t.id); navigateTo('bracket') }}
                      className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 min-w-0 ${isSelected
                        ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10`
                        : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 ${hoverCls}`
                      }`}
                    >
                      <Trophy size={16} className={isSelected ? 'text-amber-500' : 'opacity-70'} />
                      <span className="truncate flex-1 text-left">{t.name}</span>
                      <div className="flex gap-1 opacity-60 ml-auto">
                        {t.status === 'locked' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" title="Locked" />
                        ) : t.status === 'open' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Open" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Draft" />
                        )}
                      </div>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          selectTournament(t.id)
                          navigateTo('admin')
                        }}
                        className={`p-2 ml-1 rounded-lg transition-colors ${activeView === 'admin' && isSelected
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-500'
                          : 'text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800/50 hover:text-amber-600 dark:hover:text-amber-400'}`}
                        title="Admin Builder"
                      >
                        <Settings2 size={16} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

      {/* ── Sidebar Footer ── */}
      <div className="border-t border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-black/20 shrink-0">
        {profile && (
          <button
            onClick={() => { selectTournament(null); navigateTo('settings') }}
            className={`w-full p-4 flex items-center gap-3 transition-colors ${activeView === 'settings' ? 'bg-slate-200 dark:bg-white/5' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
          >
            <Avatar profile={profile} size="sm" />
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {profile.display_name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
                <span>Account</span>
                {isAdmin && (
                  <>
                    <span>·</span>
                    <span className="flex items-center text-amber-600 dark:text-amber-500 font-bold">
                      <Shield size={10} className="mr-0.5" /> Admin
                    </span>
                  </>
                )}
              </div>
            </div>
            <Settings size={16} className={`flex-shrink-0 ${activeView === 'settings' ? theme.accent : 'text-slate-400'}`} />
          </button>
        )}

        <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800/50">
          <button
            onClick={() => updateUIMode(profile?.ui_mode === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            {profile?.ui_mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {profile?.ui_mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={handleLogout}
            title="Log out"
            className={`p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors`}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

    </aside>
  )
}