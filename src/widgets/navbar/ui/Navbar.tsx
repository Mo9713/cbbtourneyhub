import { useState, useRef, useEffect, useMemo } from 'react'
import { Home, Users, BarChart3, ChevronDown, Clock, Trophy } from 'lucide-react'
import { useAuth } from '../../../features/auth'
import { useUIStore } from '../../../shared/store/uiStore'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery } from '../../../entities/group'
import { Avatar } from '../../../shared/ui'
import { getRoundLabel } from '../../../shared/lib/helpers'
import type { ActiveView, Tournament } from '../../../shared/types'

// ── Custom SVG Bracket Icon ──
const BracketIcon = ({ size = 24, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
  >
    <path d="M3 4h5v4H3" />
    <path d="M8 6h6" />
    <path d="M3 16h5v4H3" />
    <path d="M8 18h6" />
    <path d="M14 6v12" />
    <path d="M14 12h7" />
  </svg>
)

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
  const { data: groups = [] } = useUserGroupsQuery() 
  
  const [bracketsDropdownOpen, setBracketsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [currentTime, setCurrentTime] = useState(Date.now())
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const nextSurvivorLock = useMemo(() => {
    let earliestTime = Infinity
    let earliestRoundNum = 0
    let earliestRoundNames: string[] | null = null

    tournaments.forEach(t => {
      if (t.status !== 'open' || t.game_type !== 'survivor' || !t.round_locks) return
      
      Object.entries(t.round_locks).forEach(([roundStr, lock]) => {
        const time = new Date(lock).getTime()
        if (time > currentTime && time < earliestTime) {
          earliestTime = time
          earliestRoundNum = parseInt(roundStr, 10)
          earliestRoundNames = t.round_names ?? null
        }
      })
    })
    
    if (earliestTime === Infinity) return null

    // Pass maxRound as 6 for standard 64-team tournaments to resolve the name correctly
    const roundLabel = getRoundLabel(earliestRoundNum, 6, earliestRoundNames)

    return { time: earliestTime, roundLabel }
  }, [tournaments, currentTime])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBracketsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navigateTo = (view: ActiveView) => {
    if (view === 'group' && !ui.activeGroupId && groups.length > 0) {
      ui.setActiveGroup(groups[0].id)
    }
    ui.setActiveView(view)
    setBracketsDropdownOpen(false)
  }

  const navigateToBracket = (tId: string) => {
    ui.selectTournament(tId)
    ui.setActiveView('bracket')
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
      <div className="max-w-[79rem] mx-auto px-2 sm:px-6">
        <div className="flex items-center justify-between h-[72px]">
          
          {/* ── Left: Unified Nav Icons (Shifted to where Logo was) ── */}
          <div className="flex items-center gap-0.5 sm:gap-2 md:gap-3 flex-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = ui.activeView === link.id
              return (
                <button
                  key={link.id}
                  onClick={() => navigateTo(link.id as ActiveView)}
                  title={link.label}
                  className={`flex items-center justify-center px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-2xl text-[10px] sm:text-sm font-black tracking-wide transition-all ${
                    isActive 
                      ? `bg-white text-slate-950 shadow-md` 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={18} className={`sm:w-5 sm:h-5 ${isActive ? 'text-slate-900' : 'opacity-70'}`} />
                  <span className="ml-1.5 sm:ml-2">{link.label}</span>
                </button>
              )
            })}

            {/* My Brackets Dropdown (Custom Bracket Icon) */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setBracketsDropdownOpen(!bracketsDropdownOpen)}
                className={`flex items-center justify-center px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-2xl text-[10px] sm:text-sm font-black tracking-wide transition-all ${
                  ui.activeView === 'bracket'
                    ? `bg-white text-slate-950 shadow-md` 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="My Brackets"
              >
                <BracketIcon size={18} className={`sm:w-5 sm:h-5 ${ui.activeView === 'bracket' ? 'text-slate-900' : 'opacity-70'}`} />
                <span className="ml-1.5 sm:ml-2">Brackets</span>
                <ChevronDown size={14} className={`hidden sm:block ml-1 transition-transform duration-200 ${bracketsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {bracketsDropdownOpen && (
                <div className="absolute top-full left-0 sm:left-1/2 sm:-translate-x-1/2 mt-4 w-56 sm:w-64 rounded-[1.5rem] border shadow-2xl bg-slate-900 border-slate-700 overflow-hidden py-2 z-50">
                  {tournaments.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-500 font-bold text-center">No active brackets.</div>
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
                        <Trophy size={16} className={ui.selectedTournamentId === t.id && ui.activeView === 'bracket' ? 'text-amber-500' : 'opacity-40'} />
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Timer & Avatar ── */}
          <div className="flex items-center justify-end gap-3 flex-shrink-0 ml-2">
            
            {/* Survivor Countdown Timer with Round Label */}
            {nextSurvivorLock && (
              <div className="hidden lg:flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock size={14} className="text-amber-500 animate-pulse" />
                <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest leading-none mt-[1px]">
                  {nextSurvivorLock.roundLabel} picks lock in:
                </span>
                <span className="text-xs font-bold text-amber-400 tracking-wider tabular-nums leading-none mt-[1px] ml-1">
                  {formatTimeLeft(nextSurvivorLock.time, currentTime)}
                </span>
              </div>
            )}

            <div 
              className="cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigateTo('settings')}
              title="Settings & Profile"
            >
              <Avatar profile={profile} size="sm" /> 
            </div>
          </div>

        </div>
      </div>
    </nav>
  )
}