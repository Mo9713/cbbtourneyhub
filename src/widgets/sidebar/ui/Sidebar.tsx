// src/widgets/sidebar/ui/Sidebar.tsx

import { useState, useEffect, useMemo } from 'react'
import {
  Trophy, Home, Settings, LogOut, PanelLeftClose,
  Settings2, Moon, Sun, Shield, Users,
  Pin, Check, X, Clock
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

const formatTimeLeft = (targetTime: number, now: number) => {
  const diff = targetTime - now;
  if (diff <= 0) return 'Locked';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

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
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  const [pinnedIds, setPinnedIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tourneyhub-pins')
      if (stored) setPinnedIds(JSON.parse(stored))
    } catch (e) {
      console.error('Failed to parse pins from local storage', e)
    }
  }, [])

  const nextDeadline = useMemo(() => {
    let earliestTime = Infinity;
    let earliestName = '';

    allTournaments.forEach(t => {
      if (t.status !== 'open') return;

      if (t.game_type === 'survivor' && t.round_locks) {
        Object.values(t.round_locks).forEach(lock => {
          const time = new Date(lock).getTime();
          if (time > Date.now() && time < earliestTime) {
            earliestTime = time;
            earliestName = `${t.name} (Survivor)`;
          }
        });
      } else if (t.locks_at) {
        const time = new Date(t.locks_at).getTime();
        if (time > Date.now() && time < earliestTime) {
          earliestTime = time;
          earliestName = `${t.name} (Bracket)`;
        }
      }
    });

    return earliestTime === Infinity ? null : { time: earliestTime, name: earliestName };
  }, [allTournaments]);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      localStorage.setItem('tourneyhub-pins', JSON.stringify(next))
      return next
    })
  }

  const pinnedGroups      = groups.filter((g: Group) => pinnedIds.includes(g.id))
  const unpinnedGroups    = groups.filter((g: Group) => !pinnedIds.includes(g.id))
  const globalTournaments = allTournaments.filter((t: Tournament) => !t.group_id)

  const handleLogout = async () => await signOut()

  const navigateTo = (view: ActiveView) => {
    setActiveView(view)
    onClose()
  }

  return (
    <aside className={`w-72 md:w-80 h-full flex flex-col border-r shadow-2xl overflow-hidden relative bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 transition-colors duration-300`}>

      {/* ── 1. UNIFIED HEADER: Home Button (Left) & Actions (Right) ── */}
      <div className="flex items-center justify-between px-5 pt-12 pb-5 md:pt-6 md:pb-6 flex-shrink-0 border-b border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-black/10 z-20">
        
        {/* Huge, sleek Home button replacing the empty space */}
        <button
          onClick={() => { setActiveGroup(null); selectTournament(null); navigateTo('home') }}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-base transition-all duration-200
            ${activeView === 'home'
              ? `${theme.bgMd} text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-white/10`
              : `text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5`
            }
          `}
        >
          <Home size={22} className={activeView === 'home' ? theme.accent : 'opacity-70'} />
          <span className="tracking-wide">Home</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Desktop Collapse Button */}
          {onToggleDesktop && (
            <button
              onClick={onToggleDesktop}
              className="hidden md:flex p-3 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={22} />
            </button>
          )}

          {/* Mobile Close Drawer Button */}
          <button
            onClick={onClose}
            className="flex md:hidden p-3 rounded-xl text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
            title="Close sidebar"
          >
            <X size={26} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 py-6 px-5 space-y-8">

        {/* ── 2. NEXT LOCK WIDGET ── */}
        {nextDeadline && (
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/20 shadow-md relative overflow-hidden group/lock">
            <div className="absolute -right-6 -top-6 opacity-[0.04] dark:opacity-10 group-hover/lock:scale-110 group-hover/lock:-rotate-12 transition-transform duration-700 pointer-events-none">
              <Clock size={140} />
            </div>
            <div className="relative z-10 flex flex-col">
              <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-500">
                <Clock size={16} strokeWidth={3} />
                <span className="text-xs uppercase tracking-widest font-black">Next Lock</span>
              </div>
              <span className="text-base font-bold text-slate-900 dark:text-white truncate mb-1" title={nextDeadline.name}>
                {nextDeadline.name}
              </span>
              <span className="text-3xl font-black text-amber-600 dark:text-amber-400 drop-shadow-sm tracking-tight">
                {formatTimeLeft(nextDeadline.time, currentTime)}
              </span>
            </div>
          </div>
        )}

        {/* ── 3. MY GROUPS SECTION ── */}
        {(groups.length > 0) && (
          <div className="flex flex-col gap-6">
            
            {/* Sleek Centered Header */}
            <div className="flex items-center justify-center gap-4 opacity-70">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700"></div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">My Groups</span>
              <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-700"></div>
            </div>
            
            {/* Group Cards & Unnested Tournaments */}
            <div className="space-y-8">
              {[...pinnedGroups, ...unpinnedGroups].map((group: Group) => {
                const isActive = activeGroupId === group.id
                const isPinned = pinnedIds.includes(group.id)
                const groupTournaments = allTournaments.filter((t: Tournament) => t.group_id === group.id)

                return (
                  <div key={group.id} className="flex flex-col gap-3">
                    
                    {/* HUGE Clickable Group Widget */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { setActiveGroup(group.id); selectTournament(null); navigateTo('group') }}
                      className={`
                        w-full text-left p-5 rounded-3xl border shadow-md relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group/grpitem
                        ${isActive && activeView !== 'bracket'
                          ? 'bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 border-indigo-300 dark:border-indigo-500/40 ring-4 ring-indigo-500/10' 
                          : 'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-lg'
                        }
                      `}
                    >
                      <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.06] group-hover/grpitem:scale-110 group-hover/grpitem:-rotate-12 transition-transform duration-700 pointer-events-none">
                        <Users size={140} />
                      </div>

                      <div className="relative z-10 flex flex-col pr-8">
                        <div className={`flex items-center gap-2 mb-2 ${isActive && activeView !== 'bracket' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          <Shield size={14} strokeWidth={3} />
                          <span className="text-[10px] uppercase tracking-[0.15em] font-black">Group Dashboard</span>
                        </div>
                        <span className={`text-xl font-black truncate tracking-wide ${isActive && activeView !== 'bracket' ? 'text-indigo-950 dark:text-white' : 'text-slate-900 dark:text-white'}`}>
                          {group.name}
                        </span>
                      </div>

                      {/* Pin Button */}
                      <button 
                        onClick={(e) => togglePin(group.id, e)} 
                        className={`absolute top-4 right-4 p-2 rounded-xl transition-all z-20 ${isPinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 opacity-0 group-hover/grpitem:opacity-100 hover:bg-white/50 dark:hover:bg-black/20 hover:text-amber-500'}`}
                        title={isPinned ? "Unpin Group" : "Pin Group"}
                      >
                        <Pin size={16} className={isPinned ? "fill-amber-500" : ""} />
                      </button>
                    </div>

                    {/* BIG Unnested Tournaments */}
                    {groupTournaments.length > 0 && (
                      <div className="flex flex-col gap-2.5">
                        {groupTournaments.map((t: Tournament) => {
                          const isTourneySelected = selectedTournamentId === t.id && activeView !== 'home'
                          const effStatus = getEffectiveStatus(t, currentTime)
                          return (
                            <button
                              key={t.id}
                              onClick={() => { setActiveGroup(group.id); selectTournament(t.id); navigateTo('bracket') }}
                              className={`
                                w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-base transition-all duration-200 min-w-0 group/tourney
                                ${isTourneySelected 
                                  ? `${theme.bgMd} text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/10 shadow-md scale-[1.02]` 
                                  : `bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm`
                                }
                              `}
                            >
                              <Trophy size={18} className={isTourneySelected ? 'text-amber-500 shrink-0' : 'opacity-40 shrink-0 group-hover/tourney:text-amber-500 group-hover/tourney:opacity-100 transition-colors'} />
                              <span className="truncate flex-1 text-left tracking-wide">{t.name}</span>
                              
                              <div className="flex gap-2 items-center shrink-0 ml-auto">
                                {effStatus === 'completed' ? (
                                  <Check size={16} className="text-violet-500" />
                                ) : effStatus === 'open' ? (
                                  <div className="relative flex h-2.5 w-2.5 items-center justify-center mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </div>
                                ) : null}

                                {isAdmin && (
                                  <div 
                                    onClick={(e) => { e.stopPropagation(); setActiveGroup(group.id); selectTournament(t.id); navigateTo('admin') }} 
                                    className={`opacity-0 group-hover/tourney:opacity-100 p-2 rounded-xl transition-colors ${activeView === 'admin' && isTourneySelected ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} 
                                    title="Admin Builder"
                                  >
                                    <Settings2 size={18} />
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 4. GLOBAL TOURNAMENTS ── */}
        {(!isLoading && globalTournaments.length > 0) && (
          <div className="mt-10">
            <div className="mb-6 flex items-center justify-center gap-4 opacity-70">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700"></div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Global</span>
              <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-700"></div>
            </div>

            <div className="space-y-3">
              {globalTournaments.map((t: Tournament) => {
                const isSelected = selectedTournamentId === t.id && activeView !== 'home'
                const effStatus = getEffectiveStatus(t, currentTime)
                
                return (
                  <button
                    key={t.id}
                    onClick={() => { selectTournament(t.id); navigateTo('bracket') }}
                    className={`
                      w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-base transition-all duration-200 min-w-0 group/tourney
                      ${isSelected 
                        ? `${theme.bgMd} text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/10 shadow-md scale-[1.02]` 
                        : `bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm`
                      }
                    `}
                  >
                    <Trophy size={18} className={isSelected ? 'text-amber-500 shrink-0' : 'opacity-40 shrink-0 group-hover/tourney:text-amber-500 group-hover/tourney:opacity-100 transition-colors'} />
                    <span className="truncate flex-1 text-left tracking-wide">{t.name}</span>
                    
                    <div className="flex gap-2 items-center shrink-0 ml-auto">
                      {effStatus === 'completed' ? (
                        <Check size={16} className="text-violet-500" />
                      ) : effStatus === 'open' ? (
                        <div className="relative flex h-2.5 w-2.5 items-center justify-center mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </div>
                      ) : null}

                      {isAdmin && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); selectTournament(t.id); navigateTo('admin') }} 
                          className={`opacity-0 group-hover/tourney:opacity-100 p-2 rounded-xl transition-colors ${activeView === 'admin' && isSelected ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} 
                          title="Admin Builder"
                        >
                          <Settings2 size={18} />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>

      <div className="border-t border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-black/20 shrink-0 p-3">
        {profile && (
          <button 
            onClick={() => { selectTournament(null); navigateTo('settings') }} 
            className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-colors ${activeView === 'settings' ? 'bg-slate-200/80 dark:bg-white/10 shadow-sm' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
          >
            <Avatar profile={profile} size="sm" />
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-base font-black text-slate-900 dark:text-white truncate">{profile.display_name}</span>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
                <span>Account</span>
                {isAdmin && <><span className="text-amber-600 dark:text-amber-500 font-bold flex items-center"><Shield size={10} className="mr-0.5" /> Admin</span></>}
              </div>
            </div>
            <Settings size={20} className={`flex-shrink-0 ${activeView === 'settings' ? theme.accent : 'text-slate-400'}`} />
          </button>
        )}

        <div className="flex items-center justify-between mt-2 px-2">
          <button 
            onClick={() => updateUIMode(profile?.ui_mode === 'dark' ? 'light' : 'dark')} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-200 dark:hover:bg-white/10 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {profile?.ui_mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />} 
            {profile?.ui_mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button 
            onClick={handleLogout} 
            className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}