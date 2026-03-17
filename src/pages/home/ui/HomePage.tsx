import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, UserPlus, Trophy, Users, Shield, ArrowRight,
  Activity, AlertCircle, Play, CheckCircle, Zap, LayoutGrid,
  BookOpen, Target, TrendingUp, Clock
} from 'lucide-react'
import { useAuth }                     from '../../../features/auth'
import { useUIStore }                  from '../../../shared/store/uiStore'
import { useTournamentListQuery }      from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery }          from '../../../entities/group'
import { getEffectiveStatus }          from '../../../entities/tournament/model/selectors'
import { useTheme }                    from '../../../shared/lib/theme'
import { StandardTournamentCard, SurvivorTournamentCard } from '../../../entities/tournament'
import { useTournamentProgress }       from '../../../entities/tournament/model/hooks'
import type { Tournament, Group }      from '../../../shared/types'

// ── Headless Progress Reporter ──
function ProgressReporter({ tournament, onStatus }: { tournament: Tournament, onStatus: (id: string, isComplete: boolean) => void }) {
  const progress = useTournamentProgress(tournament)
  
  useEffect(() => {
    onStatus(tournament.id, progress.isComplete)
  }, [tournament.id, progress.isComplete, onStatus])

  return null
}

export default function HomePage() {
  const theme = useTheme()
  const { profile } = useAuth()

  const openCreateGroup   = useUIStore(s => s.openCreateGroup)
  const openJoinGroup     = useUIStore(s => s.openJoinGroup)
  const openAddTournament = useUIStore(s => s.openAddTournament)
  const selectTournament  = useUIStore(s => s.selectTournament)
  const setActiveGroup    = useUIStore(s => s.setActiveGroup)
  const setActiveView     = useUIStore(s => s.setActiveView)

  const { data: allTournaments = [], isLoading: isLoadingTourneys } = useTournamentListQuery()
  const { data: groups = [],        isLoading: isLoadingGroups }    = useUserGroupsQuery()

  const isAdmin = profile?.is_admin

  const [currentTime, setCurrentTime] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const [showAllTourneys, setShowAllTourneys] = useState(false)

  // ── Safely track completion status ──
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({})

  const handleBannerStatus = useCallback((id: string, isComplete: boolean) => {
    setCompletionMap(prev => {
      if (prev[id] === isComplete) return prev
      return { ...prev, [id]: isComplete }
    })
  }, [])

  const openTournaments   = useMemo(() => allTournaments.filter(
    (t: Tournament) => getEffectiveStatus(t, currentTime) === 'open',
  ), [allTournaments, currentTime])

  const activeTournaments = useMemo(() => allTournaments.filter(
    (t: Tournament) => getEffectiveStatus(t, currentTime) === 'locked',
  ), [allTournaments, currentTime])

  const displayedTournaments = showAllTourneys ? allTournaments : allTournaments.slice(0, 4)

  const navigateToBracket = useCallback((tId: string) => {
    selectTournament(tId)
    setActiveView('bracket')
  }, [selectTournament, setActiveView])

  const navigateToGroup = useCallback((gId: string) => {
    setActiveGroup(gId)
    selectTournament(null)
    setActiveView('group')
  }, [setActiveGroup, selectTournament, setActiveView])

  // ── Scroll & Highlight Logic ──
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const scrollToCard = useCallback((id: string) => {
    const el = cardRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(id)
      setTimeout(() => setHighlightedId(null), 2000) // Remove highlight after 2s
    }
  }, [])

  const incompleteTournaments = openTournaments.filter(t => completionMap[t.id] === false)
  const allPicksComplete = openTournaments.length > 0 && incompleteTournaments.length === 0

  return (
    <div className={`w-full h-full flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 ${theme.appBg} transition-colors duration-300`}>
      
      {/* Invisible Progress Reporters */}
      {openTournaments.map(t => (
        <ProgressReporter key={`reporter-${t.id}`} tournament={t} onStatus={handleBannerStatus} />
      ))}

      <div className="max-w-7xl mx-auto w-full space-y-8 pb-12 p-4 md:p-8">

        {/* ── 1. The Unified Hero Hub ── */}
<div className={`relative w-full rounded-[2rem] overflow-hidden shadow-xl border transition-all duration-500 ${
  allPicksComplete 
    ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800' 
    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20 shadow-amber-500/5'
}`}>
  {/* Background Glows - Shift colors based on status */}
  <div className={`absolute top-0 right-0 w-96 h-96 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none transition-colors duration-1000 ${
    allPicksComplete ? 'bg-emerald-500/10' : 'bg-amber-500/20'
  }`} />
  <div className={`absolute bottom-0 left-0 w-96 h-96 blur-3xl rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none transition-colors duration-1000 ${
    allPicksComplete ? 'bg-blue-500/10' : 'bg-orange-500/10'
  }`} />
  
  <div className="relative z-10 px-8 py-10 md:py-14 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
    <div className="flex flex-col max-w-2xl">
      {/* Dynamic Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
          allPicksComplete ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 animate-pulse'
        }`}>
          {allPicksComplete ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
        </div>
        <span className={`text-xs font-black uppercase tracking-[0.2em] ${allPicksComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
          {allPicksComplete ? 'Status: All Set' : 'Status: Action Required'}
        </span>
      </div>

      <h1 className="text-4xl md:text-5xl font-display font-black text-slate-100 dark:text-white tracking-tight leading-tight">
        {allPicksComplete ? (
          <>All your picks are locked in.</>
        ) : (
          <>Picks not completed!</>
        )}
      </h1>

      <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium text-lg">
        {allPicksComplete 
          ? "No action required." 
          : `You have ${incompleteTournaments.length} tournament${incompleteTournaments.length > 1 ? 's' : ''} waiting for your picks.`}
      </p>

      {/* Action Buttons inside Hero */}
      {!allPicksComplete && (
        <div className="mt-8 flex flex-wrap gap-2">
          {incompleteTournaments.map(t => (
            <button
              key={t.id}
              onClick={() => scrollToCard(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-black hover:bg-amber-600 transition-all hover:scale-105 shadow-lg shadow-amber-500/25"
            >
              {t.name} <ArrowRight size={14} />
            </button>
          ))}
        </div>
      )}
    </div>

    {/* The 3-Stat Grid */}
    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mb-2 scrollbar-none snap-x">
      {[
        { label: 'Open', val: openTournaments.length, color: 'text-emerald-500', icon: <Activity size={16} /> },
        { label: 'Active', val: activeTournaments.length, color: 'text-blue-500', icon: <Play size={16} /> },
        { label: 'Groups', val: groups.length, color: 'text-amber-500', icon: <Users size={16} /> }
      ].map((stat) => (
        <div key={stat.label} className="snap-start bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-[1.5rem] p-6 shadow-sm min-w-[120px] flex flex-col items-center text-center">
          <div className={`flex items-center gap-2 ${stat.color} mb-2`}>
            {stat.icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
          </div>
          <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">{stat.val}</span>
        </div>
      ))}
    </div>
  </div>
</div>


        {/* ── 3. Main Grid (2/3 Tournaments, 1/3 Dashboard) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Left Column: Tournaments */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <LayoutGrid className={theme.accent} size={20} />
              <h2 className={`text-xl font-display font-black uppercase tracking-wider ${theme.textBase}`}>
                Your Brackets
              </h2>
            </div>

            {isLoadingTourneys ? (
              <div className="animate-pulse h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
            ) : allTournaments.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-3xl ${theme.borderBase} ${theme.panelBg}`}>
                <Trophy size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className={`text-lg font-bold mb-1 ${theme.textBase}`}>No Tournaments Yet</h3>
                <p className={`text-sm max-w-sm ${theme.textMuted}`}>Join a group or wait for an admin to start the madness.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {displayedTournaments.map((t: Tournament) => (
                    <div 
                      key={t.id} 
                      // ── FIX: Add curly braces so it returns void instead of HTMLDivElement
                      ref={(el) => { cardRefs.current[t.id] = el; }}
                      className={`transition-all duration-700 rounded-2xl ${
                        highlightedId === t.id 
                          ? 'ring-4 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.02] z-10' 
                          : 'ring-0 ring-transparent scale-100 z-0'
                      }`}
                    >
                      {t.game_type === 'survivor' 
                        ? <SurvivorTournamentCard tournament={t} isAdmin={isAdmin ?? false} onSelect={(tourney) => navigateToBracket(tourney.id)} variant="compact" />
                        : <StandardTournamentCard tournament={t} isAdmin={isAdmin ?? false} onSelect={(tourney) => navigateToBracket(tourney.id)} variant="compact" />
                      }
                    </div>
                  ))}
                </div>

                {allTournaments.length > 4 && (
                  <button
                    onClick={() => setShowAllTourneys(!showAllTourneys)}
                    className={`w-full py-3 rounded-xl border-2 border-dashed font-bold transition-colors ${theme.borderBase} text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-600`}
                  >
                    {showAllTourneys ? 'Show Less' : `View All ${allTournaments.length} Tournaments`}
                  </button>
                )}

                {/* ── Space Filler / Rules Explainer ── */}
                <div className={`mt-2 p-6 md:p-8 rounded-3xl border flex flex-col gap-6 ${theme.panelBg} ${theme.borderBase}`}>
                  <div className="flex items-center gap-3 mb-1">
                    <BookOpen size={24} className={theme.accent} />
                    <h4 className={`text-xl font-black uppercase tracking-widest ${theme.textBase}`}>How to Play Survivor</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme.bgMd}`}>
                        <Target size={18} className={theme.accent} />
                      </div>
                      <div>
                        <span className={`text-sm font-bold uppercase tracking-wider ${theme.textBase}`}>Rules</span>
                        <p className={`text-xs leading-relaxed mt-1.5 ${theme.textMuted}`}>
                          Pick one team to win each round. If they lose, you're eliminated. <strong>You can only pick a team once per tournament.</strong> Survive to the end!
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme.bgMd}`}>
                        <TrendingUp size={18} className={theme.accent} />
                      </div>
                      <div>
                        <span className={`text-sm font-bold uppercase tracking-wider ${theme.textBase}`}>Seed Scores</span>
                        <p className={`text-xs leading-relaxed mt-1.5 ${theme.textMuted}`}>
                          In case all players advance through the final round or all remaining players get eliminated in the same round, the <strong>Seed Score</strong> breaks the tie. Correctly picking a team adds their seed value to your score. Highest Seed Score wins the tiebreaker.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 mt-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme.bgMd}`}>
                      <Clock size={18} className={theme.accent} />
                    </div>
                    <div>
                      <span className={`text-sm font-bold uppercase tracking-wider ${theme.textBase}`}>Deadlines</span>
                      <p className={`text-xs leading-relaxed mt-1.5 ${theme.textMuted}`}>
                        Picks lock exactly when the first game of the round tips off. Once a round locks, you can make picks for the following round as soon as your team advances.
                      </p>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>

          {/* Right Column: Groups & Control Panel */}
          <div className="space-y-8">
            
            {/* My Groups List (Moved to top) */}
            <div>
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                <Users className={theme.accent} size={20} />
                <h2 className={`text-xl font-display font-black uppercase tracking-wider ${theme.textBase}`}>
                  Your Groups
                </h2>
              </div>

              {isLoadingGroups ? (
                <div className="animate-pulse h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
              ) : groups.length === 0 ? (
                <div className={`p-6 text-center border-2 border-dashed rounded-2xl ${theme.borderBase}`}>
                  <p className={`text-sm font-medium mb-3 ${theme.textMuted}`}>You aren't in any groups.</p>
                  <button onClick={() => openJoinGroup()} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${theme.btn}`}>
                    Join Group
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(groups as Group[]).map(g => (
                    <button
                      key={g.id}
                      onClick={() => navigateToGroup(g.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left shadow-sm group border hover:border-amber-500 dark:hover:border-amber-500 hover:-translate-y-0.5 ${theme.panelBg} ${theme.borderBase}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-amber-500/10 transition-colors">
                          <Users size={16} className="text-slate-500 group-hover:text-amber-500" />
                        </div>
                        <span className={`text-base font-bold truncate ${theme.textBase}`}>{g.name}</span>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className={`p-6 rounded-3xl border shadow-sm ${theme.panelBg} ${theme.borderBase}`}>
              <div className="flex items-center gap-2 mb-5 text-slate-900 dark:text-white">
                <Zap size={18} className={theme.accent} />
                <h2 className="text-lg font-display font-black uppercase tracking-wider">Quick Actions</h2>
              </div>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => openJoinGroup()} className="flex items-center justify-between w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><UserPlus size={16} /></div>
                    <span>Join a Group</span>
                  </div>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors transform group-hover:translate-x-1" />
                </button>
                
                {isAdmin && (
                  <>
                    <button onClick={() => openCreateGroup()} className="flex items-center justify-between w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center"><Users size={16} /></div>
                        <span>Create Group</span>
                      </div>
                      <ArrowRight size={16} className="text-slate-400 group-hover:text-amber-500 transition-colors transform group-hover:translate-x-1" />
                    </button>

                    <button onClick={() => openAddTournament()} className="flex items-center justify-between w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><Plus size={16} /></div>
                        <span>New Tournament</span>
                      </div>
                      <ArrowRight size={16} className="text-slate-400 group-hover:text-emerald-500 transition-colors transform group-hover:translate-x-1" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Admin Status Footer */}
            {isAdmin && (
              <div className="flex items-center justify-center gap-2 py-3">
                <Shield size={12} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Privileges Active</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}