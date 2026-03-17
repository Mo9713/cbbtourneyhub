import { useState, useRef, useEffect, useMemo } from 'react'
import { Home, Users, BarChart3, Trophy, ChevronDown, Menu, X, Clock } from 'lucide-react'
import { useAuth } from '../../../features/auth'
import { useUIStore } from '../../../shared/store/uiStore'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery } from '../../../entities/group'
import { Avatar } from '../../../shared/ui'
import type { ActiveView, Tournament } from '../../../shared/types'

// ── Time Formatting Helper (Now with Seconds) ──
const formatTimeLeft = (targetTime: number, now: number) => {
  const diff = targetTime - now
  if (diff <= 0) return 'Locked'
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / (1000 * 60)) % 60)
  const s = Math.floor((diff / 1000) % 60)
  
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  return `${h}h ${m}m ${s}s`
}

export function Navbar() {
  const { profile } = useAuth()
  const ui = useUIStore()
  
  const { data: tournaments = [] } = useTournamentListQuery()
  const { data: groups = [] } = useUserGroupsQuery() // Fetched to fix routing
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bracketsDropdownOpen, setBracketsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Survivor "Next Lock" Logic ──
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  useEffect(() => {
    // Ticking every 1 second for smooth countdown
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const nextSurvivorLock = useMemo(() => {
    let earliestTime = Infinity
    let earliestName = ''
    
    tournaments.forEach(t => {
      // ONLY look at open Survivor tournaments
      if (t.status !== 'open' || t.game_type !== 'survivor' || !t.round_locks) return
      
      Object.values(t.round_locks).forEach(lock => {
        const time = new Date(lock).getTime()
        if (time > currentTime && time < earliestTime) {
          earliestTime = time
          earliestName = t.name
        }
      })
    })
    
    return earliestTime === Infinity ? null : { time: earliestTime, name: earliestName }
  }, [tournaments, currentTime])

  // ── Click Outside Handler ──
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBracketsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Smart Navigation ──
  const navigateTo = (view: ActiveView) => {
    // FIX: Auto-select first group if none is active
    if (view === 'group' && !ui.activeGroupId && groups.length > 0) {
      ui.setActiveGroup(groups[0].id)
    }

    ui.setActiveView(view)
    setMobileMenuOpen(false)
    setBracketsDropdownOpen(false)
  }

  const navigateToBracket = (tId: string) => {
    ui.selectTournament(tId)
    ui.setActiveView('bracket')
    setMobileMenuOpen(false)
    setBracketsDropdownOpen(false)
  }

  if (!profile) return null

  const navLinks = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'group', label: 'Groups', icon: Users },
    { id: 'standings', label: 'Standings', icon: BarChart3 },
  ]

  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-950 border-b border-slate-900 shadow-lg">
      <div className="max-w-[79rem] mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-[72px]">
          
          <div className="flex items-center gap-6">
            {/* ── Left: Avatar (Acts as Logo) ── */}
            <div 
              className="flex-shrink-0 flex items-center cursor-pointer hover:scale-105 transition-transform" 
              onClick={() => navigateTo('settings')}
              title="Settings"
            >
              <Avatar profile={profile} size="md" /> 
            </div>

            {/* Stark Divider */}
            <div className="hidden md:block w-px h-8 bg-slate-800" />

            {/* ── Center: Desktop Navigation ── */}
            <div className="hidden md:flex items-center gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = ui.activeView === link.id
                return (
                  <button
                    key={link.id}
                    onClick={() => navigateTo(link.id as ActiveView)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-black tracking-wide transition-all ${
                      isActive 
                        ? `bg-white text-slate-950 shadow-md` 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-slate-900' : 'opacity-70'} />
                    {link.label}
                  </button>
                )
              })}

              {/* My Brackets Dropdown */}
              <div className="relative ml-1" ref={dropdownRef}>
                <button
                  onClick={() => setBracketsDropdownOpen(!bracketsDropdownOpen)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-black tracking-wide transition-all ${
                    ui.activeView === 'bracket'
                      ? `bg-white text-slate-950 shadow-md` 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Trophy size={18} className={ui.activeView === 'bracket' ? 'text-slate-900' : 'opacity-70'} />
                  My Brackets
                  <ChevronDown size={16} className={`transition-transform duration-200 ${bracketsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {bracketsDropdownOpen && (
                  <div className="absolute top-full left-0 mt-3 w-64 rounded-2xl border shadow-2xl bg-slate-900 border-slate-700 overflow-hidden py-2 z-50">
                    {tournaments.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 font-bold">No active brackets.</div>
                    ) : (
                      tournaments.map((t: Tournament) => (
                        <button
                          key={t.id}
                          onClick={() => navigateToBracket(t.id)}
                          className={`w-full text-left px-5 py-3 text-sm font-black tracking-wide transition-colors flex items-center gap-3 ${
                            ui.selectedTournamentId === t.id && ui.activeView === 'bracket'
                              ? `bg-slate-800 text-white`
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <Trophy size={14} className={ui.selectedTournamentId === t.id && ui.activeView === 'bracket' ? 'text-amber-500' : 'opacity-40'} />
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Survivor Timer & Mobile Menu ── */}
          <div className="flex items-center gap-5">
            
            {/* Next Lock Countdown (Desktop Only) */}
            {nextSurvivorLock && (
              <div className="hidden lg:flex items-center justify-center gap-3 px-5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 min-w-[180px]">
                <div className="flex flex-col items-center justify-center w-full">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={12} className="text-amber-500 animate-pulse" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-500/80 leading-none">
                      Next round locks in:
                    </span>
                  </div>
                  <span className="text-sm font-bold text-amber-400 tracking-wider text-center tabular-nums">
                    {formatTimeLeft(nextSurvivorLock.time, currentTime)}
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Navigation Menu (Stark Theme) ── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 space-y-2 shadow-2xl absolute w-full left-0 z-50">
          
          {/* Mobile Timer */}
          {nextSurvivorLock && (
            <div className="flex flex-col items-center justify-center mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-amber-500 animate-pulse" />
                <span className="text-xs uppercase font-black tracking-widest text-amber-500/80">Next round locks in:</span>
              </div>
              <span className="text-lg font-bold text-amber-400 tracking-wider tabular-nums">
                {formatTimeLeft(nextSurvivorLock.time, currentTime)}
              </span>
            </div>
          )}

          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = ui.activeView === link.id
            return (
              <button
                key={link.id}
                onClick={() => navigateTo(link.id as ActiveView)}
                className={`flex items-center gap-3 w-full px-5 py-4 rounded-xl text-base font-black tracking-wide transition-all ${
                  isActive ? `bg-white text-slate-950` : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-slate-900' : 'opacity-70'} />
                {link.label}
              </button>
            )
          })}
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <div className="px-5 mb-2 text-xs font-black uppercase tracking-widest text-slate-500">My Brackets</div>
            {tournaments.map((t: Tournament) => (
              <button
                key={t.id}
                onClick={() => navigateToBracket(t.id)}
                className="w-full text-left flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-black tracking-wide text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
              >
                <Trophy size={18} className="opacity-50" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}