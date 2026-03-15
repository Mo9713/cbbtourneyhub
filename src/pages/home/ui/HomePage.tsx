// src/pages/home/ui/HomePage.tsx

import { useMemo, useState, useEffect } from 'react'
import { 
  Plus, UserPlus, Trophy, Users, Shield, ArrowRight, Activity, AlertCircle, Clock, Play
} from 'lucide-react'

import { useAuth }                from '../../../features/auth'
import { useUIStore }             from '../../../shared/store/uiStore'
import { useTournamentListQuery, useGames } from '../../../entities/tournament/model/queries'
import { useMyPicks }             from '../../../entities/pick/model/queries'
import { useUserGroupsQuery }     from '../../../entities/group'
import type { Tournament, Group } from '../../../shared/types'
import { useTheme }               from '../../../shared/lib/theme'

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

interface ActionCardProps {
  tournament: Tournament
  currentTime: number
  onClick: (id: string) => void
  onComplete: (id: string) => void
}

function TournamentActionCard({ tournament, currentTime, onClick, onComplete }: ActionCardProps) {
  const { data: games = [] } = useGames(tournament.id)
  const { data: picks = [] } = useMyPicks(tournament.id, games)

  let targetTime = 0
  let phase = 'open' 
  let label = 'Picks'
  let requiredPicks = 63
  let currentPicks = picks.length

  const unlockTime = tournament.unlocks_at ? new Date(tournament.unlocks_at).getTime() : 0
  let lockTime = 0

  if (tournament.game_type === 'survivor' && tournament.round_locks) {
    requiredPicks = 1
    const rounds = Object.keys(tournament.round_locks).map(Number).sort((a, b) => a - b)
    let activeRound = rounds[0]
    for (const r of rounds) {
      const rTime = new Date(tournament.round_locks[r]).getTime()
      if (rTime > currentTime) {
        activeRound = r
        lockTime = rTime
        break
      }
    }
    label = `Round ${activeRound}`
    currentPicks = picks.some((p: any) => p.round_num === activeRound) ? 1 : 0
  } else {
    lockTime = tournament.locks_at ? new Date(tournament.locks_at).getTime() : 0
    requiredPicks = tournament.game_type === 'bracket' || !tournament.game_type ? 63 : (games.length || 63)
  }

  if (unlockTime > currentTime) {
    phase = 'waiting'
    targetTime = unlockTime
  } else if (lockTime > currentTime) {
    phase = 'open'
    targetTime = lockTime
  } else if (lockTime > 0 && lockTime <= currentTime) {
    phase = 'locked'
  }

  const isComplete = currentPicks >= requiredPicks
  const effStatus = getEffectiveStatus(tournament, currentTime)

  useEffect(() => {
    if (isComplete || effStatus !== 'open') {
      onComplete(tournament.id)
    }
  }, [isComplete, effStatus, tournament.id, onComplete])

  if (isComplete || effStatus !== 'open') return null

  let timeStr = ''
  if (targetTime > 0) {
    const diff = targetTime - currentTime
    const h = Math.floor(diff / (1000 * 60 * 60))
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    timeStr = h > 48 ? `${Math.floor(h / 24)} days` : `${h}h ${m}m`
  }

  const isUrgent = phase === 'open' && targetTime > 0 && (targetTime - currentTime) <= (8 * 60 * 60 * 1000)
  const progressPercent = Math.min(100, Math.round((currentPicks / requiredPicks) * 100))

  return (
    <button
      onClick={() => onClick(tournament.id)}
      className={`relative overflow-hidden px-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold text-slate-900 dark:text-white transition-all shadow-sm flex flex-col gap-2 min-w-[180px]
        ${isUrgent ? 'border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500'}`}
    >
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex flex-col text-left min-w-0">
          <span className="truncate">{tournament.name}</span>
          <span className={`text-[10px] uppercase tracking-wider flex items-center gap-1 mt-0.5 ${isUrgent ? 'text-rose-500' : 'text-slate-500'}`}>
            <Clock size={10} className="shrink-0" />
            <span className="truncate">
              {phase === 'waiting' ? `Opens in ${timeStr}` : timeStr ? `${label} lock in ${timeStr}` : `${label} Open`}
            </span>
          </span>
        </div>
        <ArrowRight size={14} className={isUrgent ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
      </div>

      {phase === 'open' && (
        <div className="w-full space-y-1.5 mt-1">
          <div className="flex justify-between text-[9px] font-bold text-slate-400 dark:text-slate-500">
            <span>{currentPicks} / {requiredPicks} Picks</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isUrgent ? 'bg-rose-500' : 'bg-amber-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </button>
  )
}

export default function HomePage() {
  const theme = useTheme()
  const { profile } = useAuth()
  const firstName = profile?.display_name?.split(' ')[0] || 'Hoops Fan'

  const openCreateGroup      = useUIStore(s => s.openCreateGroup)
  const openJoinGroup        = useUIStore(s => s.openJoinGroup)
  const openAddTournament    = useUIStore(s => s.openAddTournament)
  const selectTournament     = useUIStore(s => s.selectTournament)
  const setActiveGroup       = useUIStore(s => s.setActiveGroup)
  const setActiveView        = useUIStore(s => s.setActiveView)

  const { data: allTournaments = [], isLoading: isLoadingTourneys } = useTournamentListQuery()
  const { data: groups = [], isLoading: isLoadingGroups }           = useUserGroupsQuery()
  
  const isAdmin = profile?.is_admin

  const [currentTime, setCurrentTime] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const [showAllTourneys, setShowAllTourneys] = useState(false)
  const [completedTourneyIds, setCompletedTourneyIds] = useState<Set<string>>(new Set())

  const openTournaments   = useMemo(() => allTournaments.filter((t: Tournament) => getEffectiveStatus(t, currentTime) === 'open'), [allTournaments, currentTime])
  const activeTournaments = useMemo(() => allTournaments.filter((t: Tournament) => getEffectiveStatus(t, currentTime) === 'locked'), [allTournaments, currentTime])
  
  const actionRequiredTournaments = openTournaments.filter((t: Tournament) => !completedTourneyIds.has(t.id))
  const displayedTournaments = showAllTourneys ? allTournaments : allTournaments.slice(0, 5)

  const handleTourneyComplete = (id: string) => {
    setCompletedTourneyIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const navigateToBracket = (tId: string) => {
    selectTournament(tId)
    setActiveView('bracket')
  }

  const navigateToGroup = (gId: string) => {
    setActiveGroup(gId)
    selectTournament(null)
    setActiveView('group')
  }

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
        
        {/* ── Header Area ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {firstName}
            </h1>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 -mb-2">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm min-w-[120px]">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Activity size={14} className="text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Open</span>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{openTournaments.length}</span>
            </div>
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm min-w-[120px]">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Play size={14} className="text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Active</span>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{activeTournaments.length}</span>
            </div>
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm min-w-[120px]">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Users size={14} className="text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Groups</span>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{groups.length}</span>
            </div>
          </div>
        </div>

        {/* ── Action Required Panel ── */}
        {actionRequiredTournaments.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-4 shrink-0">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Picks Action Required</h3>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                  Check your incomplete brackets to the right.
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap w-full md:w-auto md:ml-auto">
              {actionRequiredTournaments.map((t: Tournament) => (
                <TournamentActionCard 
                  key={t.id} 
                  tournament={t} 
                  currentTime={currentTime} 
                  onClick={navigateToBracket} 
                  onComplete={handleTourneyComplete}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Command Actions Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={openCreateGroup} className="group relative overflow-hidden bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-6 text-left transition-all shadow-sm hover:shadow-md">
            <div className={`w-12 h-12 rounded-xl ${theme.bgMd} flex items-center justify-center mb-4 text-white shadow-inner`}>
              <Plus size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">Create a Group</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Start a new private league for your friends or office.</p>
          </button>

          <button onClick={openJoinGroup} className="group relative overflow-hidden bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-6 text-left transition-all shadow-sm hover:shadow-md">
            <div className={`w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300 shadow-inner group-hover:bg-slate-200 dark:group-hover:bg-white/10 transition-colors`}>
              <UserPlus size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">Join a Group</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Enter a secret code to compete in an existing league.</p>
          </button>

          {isAdmin ? (
            <button onClick={openAddTournament} className="group relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-6 text-left transition-all shadow-sm hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4 text-white shadow-inner">
                <Shield size={24} />
              </div>
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-100 mb-1">Create Tournament</h3>
              <p className="text-xs text-amber-700/70 dark:text-amber-400/70 font-medium">Admin Only: Initialize a new master bracket template.</p>
            </button>
          ) : (
            <div className="border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 flex items-center justify-center opacity-50">
               <span className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center">More Features<br/>Coming Soon</span>
            </div>
          )}
        </div>

        {/* ── Your Spaces Split View ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              My Active Groups
            </h2>
            {isLoadingGroups ? (
              <div className="animate-pulse h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
            ) : groups.length === 0 ? (
              <div className="bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-2xl p-8 text-center">
                <p className="text-sm text-slate-500 font-medium">You aren't in any groups yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {groups.map((g: Group) => (
                  <button key={g.id} onClick={() => navigateToGroup(g.id)} className="flex items-center gap-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 p-4 rounded-xl transition-all text-left shadow-sm group">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      <Users size={18} className="text-slate-500 group-hover:text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{g.name}</h4>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Private League</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <span>All Tournaments</span>
            </h2>
            {isLoadingTourneys ? (
              <div className="animate-pulse h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
            ) : allTournaments.length === 0 ? (
               <div className="bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-2xl p-8 text-center">
                <p className="text-sm text-slate-500 font-medium">No active tournaments found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedTournaments.map((t: Tournament) => {
                  const effStatus = getEffectiveStatus(t, currentTime)
                  return (
                    <button key={t.id} onClick={() => navigateToBracket(t.id)} className="w-full flex items-center justify-between bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 p-4 rounded-xl transition-all text-left shadow-sm group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${effStatus === 'open' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                          <Trophy size={14} />
                        </div>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${effStatus === 'open' ? 'text-emerald-500' : effStatus === 'completed' ? 'text-violet-500' : 'text-slate-400'}`}>
                              {effStatus === 'locked' ? 'active' : effStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-slate-400 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                    </button>
                  )
                })}

                {allTournaments.length > 5 && (
                  <button 
                    onClick={() => setShowAllTourneys(!showAllTourneys)} 
                    className="w-full py-2.5 mt-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {showAllTourneys ? 'Show Less' : `Show All (${allTournaments.length})`}
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}