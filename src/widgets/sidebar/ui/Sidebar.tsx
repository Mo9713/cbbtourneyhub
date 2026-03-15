// src/widgets/sidebar/ui/Sidebar.tsx

import { useState, useEffect, useMemo } from 'react'
import {
  Trophy, Home, Settings, LogOut, PanelLeftClose,
  Settings2, Moon, Sun, Shield,
  ChevronDown, ChevronRight, Search, Pin,
  Check
} from 'lucide-react'

import { useTheme }               from '../../../shared/lib/theme'
import { useUIStore }             from '../../../shared/store/uiStore'
import { useAuth }                from '../../../features/auth'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery }     from '../../../entities/group'
import { Avatar }                 from '../../../shared/ui'
import type { ActiveView, Tournament, Group } from '../../../shared/types'

interface SidebarProps {
  onClose:              () => void
  onOpenAddTournament?: () => void
  onToggleDesktop?:     () => void
}

const getEffectiveStatus = (t: Tournament, now: number): Tournament['status'] => {
  if (t.status !== 'open') return t.status 
  if (t.game_type === 'survivor' && t.round_locks) {
    const hasFutureRound = Object.values(t.round_locks).some(lock => new Date(lock).getTime() > now)
    if (!hasFutureRound && Object.keys(t.round_locks).length > 0) return 'locked'
  } else if (t.locks_at) {
    if (new Date(t.locks_at).getTime() <= now) return 'locked'
  }
  return 'open'
}

export default function Sidebar({ onClose, onToggleDesktop }: SidebarProps) {
  const theme = useTheme()
  const { profile, signOut, updateUIMode } = useAuth()

  const activeView           = useUIStore(s => s.activeView)
  const setActiveView        = useUIStore(s => s.setActiveView)
  const activeGroupId        = useUIStore(s => s.activeGroupId)
  const setActiveGroup       = useUIStore(s => s.setActiveGroup)
  const selectedTournamentId = useUIStore(s => s.selectedTournamentId)
  const selectTournament     = useUIStore(s => s.selectTournament)

  const { data: allTournaments = [], isLoading } = useTournamentListQuery()
  const { data: groups = [] }                    = useUserGroupsQuery()
  const isAdmin = profile?.is_admin

  const [currentTime, setCurrentTime] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const [searchTerm, setSearchTerm]               = useState('')
  const [isGroupsOpen, setIsGroupsOpen]           = useState(true)
  const [isTournamentsOpen, setIsTournamentsOpen] = useState(true)
  const [pinnedIds, setPinnedIds]                 = useState<string[]>([])
  
  const [expandedGroups, setExpandedGroups]       = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tourneyhub-pins')
      if (stored) setPinnedIds(JSON.parse(stored))
    } catch (e) {
      console.error('Failed to parse pins from local storage', e)
    }
  }, [])

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      localStorage.setItem('tourneyhub-pins', JSON.stringify(next))
      return next
    })
  }

  const toggleGroupExpand = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const filteredGroups = useMemo(() => {
    return groups.filter((g: Group) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [groups, searchTerm])

  const globalTournaments = useMemo(() => {
    return allTournaments.filter((t: Tournament) => !t.group_id && t.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [allTournaments, searchTerm])

  const pinnedGroups      = filteredGroups.filter((g: Group) => pinnedIds.includes(g.id))
  const unpinnedGroups    = filteredGroups.filter((g: Group) => !pinnedIds.includes(g.id))

  const handleLogout = async () => await signOut()

  const navigateTo = (view: ActiveView) => {
    setActiveView(view)
    onClose()
  }

  const navItemCls = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200`
  const hoverCls   = `hover:bg-slate-200/60 dark:hover:bg-white/5`

  return (
    <aside className={`w-64 h-full flex flex-col border-r shadow-2xl overflow-hidden relative bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 transition-colors duration-300`}>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between pl-4 pr-3 py-4 flex-shrink-0 border-b border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-black/10">
        <div className="flex-1 pr-4 flex items-center justify-start">
          <img
            src="/logo.png"
            alt="TourneyHub Logo"
            className="w-full h-auto object-contain object-left drop-shadow-sm"
          />
        </div>
        {onToggleDesktop && (
          <button
            onClick={onToggleDesktop}
            className="hidden md:flex p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <div className="px-4 pt-4 flex-shrink-0">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            placeholder="Filter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-200/50 dark:bg-black/20 border border-slate-300 dark:border-slate-800/50 rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 py-4 px-3 space-y-4">

        <div className="space-y-1">
          <button
            onClick={() => { setActiveGroup(null); selectTournament(null); navigateTo('home') }}
            className={`
              ${navItemCls} 
              ${activeView === 'home'
                ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10`
                : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 ${hoverCls}`
              }
            `}
          >
            <Home size={18} className={activeView === 'home' ? theme.accent : 'opacity-70'} />
            Home
          </button>
        </div>

        <div>
          <button 
            onClick={() => setIsGroupsOpen(!isGroupsOpen)} 
            className="w-full px-3 mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <span>My Groups</span>
            {isGroupsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          
          {isGroupsOpen && (
            <div className="space-y-1">
              {[...pinnedGroups, ...unpinnedGroups].map((group: Group) => {
                const isActive = activeGroupId === group.id
                const isPinned = pinnedIds.includes(group.id)
                const isExpanded = expandedGroups[group.id]
                const groupTournaments = allTournaments.filter((t: Tournament) => t.group_id === group.id)

                return (
                  <div key={group.id} className="flex flex-col">
                    <div className="group/item flex items-center justify-between">
                      <button
                        onClick={() => { setActiveGroup(group.id); selectTournament(null); navigateTo('group') }}
                        className={`
                          flex-1 flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-sm transition-all duration-200 min-w-0 
                          ${isActive 
                            ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10` 
                            : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 ${hoverCls}`
                          }
                        `}
                      >
                        <span className="truncate flex-1 text-left">{group.name}</span>
                        
                        <div className={`flex items-center gap-1 ${isPinned ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'} transition-opacity`}>
                           <button 
                              onClick={(e) => togglePin(group.id, e)} 
                              className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                           >
                              {isPinned ? <Pin size={12} className="fill-amber-500 text-amber-500" /> : <Pin size={12} />}
                           </button>
                           {groupTournaments.length > 0 && (
                             <button 
                                onClick={(e) => toggleGroupExpand(group.id, e)} 
                                className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                             >
                               {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                             </button>
                           )}
                        </div>
                      </button>
                    </div>

                    {isExpanded && groupTournaments.length > 0 && (
                      <div className="ml-5 pl-3 mt-1 space-y-1 border-l-2 border-slate-200 dark:border-slate-800/50">
                        {groupTournaments.map((t: Tournament) => {
                          const isTourneySelected = selectedTournamentId === t.id && activeView !== 'home'
                          const effStatus = getEffectiveStatus(t, currentTime)
                          return (
                            <div key={t.id} className="group/subitem flex items-center justify-between gap-1">
                              <button
                                onClick={() => { setActiveGroup(group.id); selectTournament(t.id); navigateTo('bracket') }}
                                className={`
                                  flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg font-bold text-xs transition-all duration-200 min-w-0 
                                  ${isTourneySelected 
                                    ? `${theme.bgMd} text-slate-900 dark:text-white` 
                                    : `text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5`
                                  }
                                `}
                              >
                                <Trophy size={12} className={isTourneySelected ? 'text-amber-500 shrink-0' : 'opacity-50 shrink-0'} />
                                <span className="truncate flex-1 text-left">{t.name}</span>
                                
                                <div className="flex gap-1 items-center shrink-0 ml-auto">
                                  {effStatus === 'completed' ? (
                                    <Check size={10} className="text-violet-500" />
                                  ) : effStatus === 'open' ? (
                                    <div className="relative flex h-1.5 w-1.5 items-center justify-center mr-1">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                                    </div>
                                  ) : null}

                                  {isAdmin && (
                                    <div 
                                      onClick={(e) => { e.stopPropagation(); setActiveGroup(group.id); selectTournament(t.id); navigateTo('admin') }} 
                                      className={`opacity-0 group-hover/subitem:opacity-100 p-1 rounded transition-colors ${activeView === 'admin' && isTourneySelected ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-300 dark:hover:bg-slate-700'}`} 
                                      title="Admin Builder"
                                    >
                                      <Settings2 size={12} />
                                    </div>
                                  )}
                                </div>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {(!isLoading && globalTournaments.length === 0) ? null : (
          <div>
            <button 
              onClick={() => setIsTournamentsOpen(!isTournamentsOpen)} 
              className="w-full px-3 mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <span>Global Tournaments</span>
              {isTournamentsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {isTournamentsOpen && (
              <div className="space-y-1">
                {isLoading ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 animate-pulse flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                    Loading...
                  </div>
                ) : (
                  globalTournaments.map((t: Tournament) => {
                    const isSelected = selectedTournamentId === t.id && activeView !== 'home'
                    const effStatus = getEffectiveStatus(t, currentTime)
                    
                    return (
                      <div key={t.id} className="group/item flex items-center justify-between">
                        <button
                          onClick={() => { selectTournament(t.id); navigateTo('bracket') }}
                          className={`
                            flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold text-sm transition-all duration-200 min-w-0 
                            ${isSelected 
                              ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10` 
                              : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 ${hoverCls}`
                            }
                          `}
                        >
                          <Trophy size={14} className={isSelected ? 'text-amber-500 shrink-0' : 'opacity-70 shrink-0'} />
                          <span className="truncate flex-1 text-left">{t.name}</span>
                          
                          <div className="flex gap-2 items-center shrink-0 ml-auto">
                            {effStatus === 'completed' ? (
                              <span title="Completed" className="flex items-center">
                                <Check size={12} className="text-violet-500" />
                              </span>
                            ) : effStatus === 'open' ? (
                              <div className="relative flex h-2 w-2 items-center justify-center">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              </div>
                            ) : null}

                            <div className={`flex gap-0.5 items-center opacity-0 group-hover/item:opacity-100 transition-opacity`}>
                              {isAdmin && (
                                <div 
                                  onClick={(e) => { e.stopPropagation(); selectTournament(t.id); navigateTo('admin') }} 
                                  className={`p-1 rounded transition-colors ${activeView === 'admin' && isSelected ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} 
                                  title="Admin Builder"
                                >
                                  <Settings2 size={12} />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}

      </div>

      <div className="border-t border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-black/20 shrink-0">
        {profile && (
          <button 
            onClick={() => { selectTournament(null); navigateTo('settings') }} 
            className={`w-full p-4 flex items-center gap-3 transition-colors ${activeView === 'settings' ? 'bg-slate-200 dark:bg-white/5' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
          >
            <Avatar profile={profile} size="sm" />
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile.display_name}</span>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
                <span>Account</span>
                {isAdmin && <><span className="text-amber-600 dark:text-amber-500 font-bold flex items-center"><Shield size={10} className="mr-0.5" /> Admin</span></>}
              </div>
            </div>
            <Settings size={16} className={`flex-shrink-0 ${activeView === 'settings' ? theme.accent : 'text-slate-400'}`} />
          </button>
        )}

        <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800/50">
          <button 
            onClick={() => updateUIMode(profile?.ui_mode === 'dark' ? 'light' : 'dark')} 
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-white/10 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {profile?.ui_mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />} 
            {profile?.ui_mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button 
            onClick={handleLogout} 
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}