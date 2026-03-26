import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, UserPlus, Trophy, Users, Shield, ArrowRight,
  Zap, LayoutGrid
} from 'lucide-react'
import { useAuth }                     from '../../../features/auth'
import { useUIStore }                  from '../../../shared/store/uiStore'
import { useTournamentListQuery }      from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery }          from '../../../entities/group'
import { useLeaderboardRaw }           from '../../../entities/leaderboard/model/queries'
import { isPicksLocked }               from '../../../shared/lib/time'
import { useTheme }                    from '../../../shared/lib/theme'
import { StandardTournamentCard, SurvivorTournamentCard } from '../../../entities/tournament'
import { useTournamentProgress }       from '../../../entities/tournament/model/hooks'
import { useStabilizedLoading }        from '../../../shared/lib/useStabilizedLoading'
import { computeLeaderboard }          from '../../../features/leaderboard/model/selectors'
import type { Tournament, Group }      from '../../../shared/types'

// FSD WIDGETS & FEATURES
import { HomeHero }   from '../../../widgets/home-hero/ui/HomeHero'
import { MobileFab }  from '../../../widgets/mobile-fab/ui/MobileFab'
import { RulesModal } from '../../../features/rules-modal/ui/RulesModal'

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

  const { data: allTournaments, isLoading: isLoadingTourneys } = useTournamentListQuery()
  const { data: groups,         isLoading: isLoadingGroups }   = useUserGroupsQuery()
  const { data: rawData,        isLoading: isLoadingBoard }    = useLeaderboardRaw()

  const isAdmin = profile?.is_admin ?? false

  const [currentTime, setCurrentTime] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const [showAllTourneys, setShowAllTourneys] = useState(false)
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({})
  const [showRulesModal, setShowRulesModal] = useState(false)

  const handleBannerStatus = useCallback((id: string, isComplete: boolean) => {
    setCompletionMap(prev => {
      if (prev[id] === isComplete) return prev
      return { ...prev, [id]: isComplete }
    })
  }, [])

  const openTournaments = useMemo(() => (allTournaments || []).filter(
    (t: Tournament) => t.status === 'open' && !isPicksLocked(t, isAdmin),
  ), [allTournaments, currentTime, isAdmin])

  const activeTournaments = useMemo(() => (allTournaments || []).filter(
    (t: Tournament) => t.status !== 'completed' && t.status !== 'draft' && (t.status === 'locked' || (t.status === 'open' && isPicksLocked(t, isAdmin))),
  ), [allTournaments, currentTime, isAdmin])

  const completedTournaments = useMemo(() => (allTournaments || []).filter(
    (t: Tournament) => t.status === 'completed'
  ), [allTournaments])

  const displayedTournaments = showAllTourneys ? (allTournaments || []) : (allTournaments || []).slice(0, 4)

  const userStats = useMemo(() => {
    if (!rawData || !allTournaments || !profile) return {}
    const stats: Record<string, { rank: number; totalPlayers: number; score: number; seedScore: number; isEliminated: boolean; firstPlaceScore: number; firstPlaceSeed: number }> = {}

    allTournaments.forEach((t: Tournament) => {
      const tMap = new Map([[t.id, t]])
      const games = rawData.allGames.filter(g => g.tournament_id === t.id)
      const gameIds = new Set(games.map(g => g.id))
      const picks = rawData.allPicks.filter(p => gameIds.has(p.game_id))
      const pickUserIds = new Set(picks.map(p => p.user_id))
      const activeProfiles = rawData.allProfiles.filter(p => pickUserIds.has(p.id))

      const board = computeLeaderboard(picks, games, rawData.allGames, activeProfiles, tMap)
      const userIndex = board.findIndex(e => e.profile.id === profile.id)
      
      if (board.length > 0) {
        stats[t.id] = {
          rank: userIndex !== -1 ? userIndex + 1 : 0,
          totalPlayers: board.length,
          score: userIndex !== -1 ? board[userIndex].points : 0,
          seedScore: userIndex !== -1 ? board[userIndex].seedScore : 0,
          isEliminated: userIndex !== -1 ? board[userIndex].isEliminated : false,
          firstPlaceScore: board[0].points,
          firstPlaceSeed: board[0].seedScore
        }
      }
    })
    return stats
  }, [rawData, allTournaments, profile])

  const navigateToBracket = useCallback((tId: string) => {
    selectTournament(tId)
    setActiveView('bracket')
  }, [selectTournament, setActiveView])

  const navigateToGroup = useCallback((gId: string) => {
    setActiveGroup(gId)
    selectTournament(null)
    setActiveView('group')
  }, [setActiveGroup, selectTournament, setActiveView])

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const scrollToCard = useCallback((id: string) => {
    const el = cardRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(id)
      setTimeout(() => setHighlightedId(null), 2000)
    }
  }, [])

  const isCalculatingProgress = openTournaments.length > 0 && openTournaments.some(t => completionMap[t.id] === undefined)
  const incompleteTournaments = openTournaments.filter(t => completionMap[t.id] === false)
  const allPicksComplete = openTournaments.length > 0 && incompleteTournaments.length === 0

  const isDataLoading = isLoadingTourneys || isLoadingGroups || isLoadingBoard || !allTournaments || !groups || !rawData || !profile || isCalculatingProgress;
  const showSkeleton = useStabilizedLoading(isDataLoading, 150);

  if (showSkeleton || !allTournaments || !groups || !rawData || !profile) {
    return (
      <>
        <div className="hidden">
          {openTournaments.map(t => (
            <ProgressReporter key={`reporter-${t.id}`} tournament={t} onStatus={handleBannerStatus} />
          ))}
        </div>
        <div className={`w-full h-full flex flex-col overflow-y-auto p-4 md:p-8 ${theme.appBg}`}>
          <div className="max-w-7xl mx-auto w-full space-y-8 pb-12 animate-in fade-in duration-300">
            <div className="w-full h-[320px] rounded-[2rem] bg-slate-200 dark:bg-slate-800/50 animate-pulse border border-slate-300 dark:border-slate-800" />
            <div className="flex gap-3 md:gap-4 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 w-32 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800/50 animate-pulse flex-shrink-0 border border-slate-300 dark:border-slate-800" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-6">
                <div className="w-48 h-8 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-[180px] bg-slate-200 dark:bg-slate-800/50 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
                  ))}
                </div>
              </div>
              <div className="space-y-8">
                <div className="w-40 h-8 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800/50 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 ${theme.appBg} transition-colors duration-300 relative`}>
      
      {openTournaments.map(t => (
        <ProgressReporter key={`reporter-${t.id}`} tournament={t} onStatus={handleBannerStatus} />
      ))}

      <div className="max-w-7xl mx-auto w-full space-y-8 pb-32 md:pb-12 p-4 md:p-8">

        <HomeHero 
          allTournaments={allTournaments}
          openTournaments={openTournaments}
          activeTournaments={activeTournaments}
          completedTournaments={completedTournaments}
          incompleteTournaments={incompleteTournaments}
          allPicksComplete={allPicksComplete}
          onOpenRules={() => setShowRulesModal(true)}
          onScrollToCard={scrollToCard}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <LayoutGrid className={theme.accent} size={20} />
              <h2 className={`text-xl font-display font-black uppercase tracking-wider ${theme.textBase}`}>
                Your Brackets
              </h2>
            </div>

            {allTournaments.length === 0 ? (
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
                      ref={(el) => { cardRefs.current[t.id] = el; }}
                      className={`transition-all duration-700 rounded-2xl ${
                        highlightedId === t.id 
                          ? 'ring-4 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.02] z-10' 
                          : 'ring-0 ring-transparent scale-100 z-0'
                      }`}
                    >
                      {t.game_type === 'survivor' 
                        ? <SurvivorTournamentCard tournament={t} isAdmin={isAdmin} onSelect={(tourney) => navigateToBracket(tourney.id)} variant="compact" userStat={userStats[t.id]} />
                        : <StandardTournamentCard tournament={t} isAdmin={isAdmin} onSelect={(tourney) => navigateToBracket(tourney.id)} variant="compact" userStat={userStats[t.id]} />
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
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                <Users className={theme.accent} size={20} />
                <h2 className={`text-xl font-display font-black uppercase tracking-wider ${theme.textBase}`}>
                  Your Groups
                </h2>
              </div>

              {groups.length === 0 ? (
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

            <div className={`hidden sm:block p-6 rounded-3xl border shadow-sm ${theme.panelBg} ${theme.borderBase}`}>
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

            {isAdmin && (
              <div className="hidden sm:flex items-center justify-center gap-2 py-3">
                <Shield size={12} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Privileges Active</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <MobileFab 
        isAdmin={isAdmin}
        openJoinGroup={openJoinGroup}
        openCreateGroup={openCreateGroup}
        openAddTournament={openAddTournament}
      />

      <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
    </div>
  )
}