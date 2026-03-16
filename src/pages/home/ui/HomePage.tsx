// src/pages/home/ui/HomePage.tsx

import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  Plus, UserPlus, Trophy, Users, Shield, ArrowRight,
  Activity, AlertCircle, Clock, Play, CheckCircle,
} from 'lucide-react'
import { deriveEffectiveNames, deriveChampion } from '../../../shared/lib/bracketMath'
import { useAuth }                                     from '../../../features/auth'
import { useUIStore }                                  from '../../../shared/store/uiStore'
import { useTournamentListQuery, useGames }            from '../../../entities/tournament/model/queries'
import { useMyPicks }                                  from '../../../entities/pick/model/queries'
import { useUserGroupsQuery }                          from '../../../entities/group'
import type { Tournament, Group }                      from '../../../shared/types'
import { useTheme }                                    from '../../../shared/lib/theme'
import { getActiveSurvivorRound }                      from '../../../shared/lib/time'

// ── Effective status helper (mirrors Sidebar logic) ───────────
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

// ── TournamentBannerRow ───────────────────────────────────────
// Renders a single tournament row inside the persistent action banner.
// Fetches its own picks, computes completion + pick detail, and reports
// status upward via onStatus so the parent can determine banner color.
interface BannerRowProps {
  tournament:  Tournament
  currentTime: number
  onClick:     (id: string) => void
  onStatus:    (id: string, isComplete: boolean) => void
}

function TournamentBannerRow({ tournament, currentTime, onClick, onStatus }: BannerRowProps) {
  const { data: games = [] } = useGames(tournament.id)
  const { data: picks = [] } = useMyPicks(tournament.id, games)
  const isSurvivor = tournament.game_type === 'survivor'

  const activeRound = isSurvivor ? getActiveSurvivorRound(tournament) : 0

  let requiredPicks = isSurvivor ? 1 : (games.length || 63)
  let currentPicks  = 0
  let pickLabel     = isSurvivor ? 'Current Round Pick' : 'Champion Pick'
  let pickTeamName: string | null = null

  if (isSurvivor) {
    if (activeRound > 0) {
      const pick = picks.find(p => {
        const g = games.find(game => game.id === p.game_id)
        return g?.round_num === activeRound
      })
      currentPicks = pick ? 1 : 0

      if (pick) {
        const g = games.find(game => game.id === pick.game_id)
        if (g) {
          pickTeamName =
            pick.predicted_winner === 'team1' ? g.team1_name :
            pick.predicted_winner === 'team2' ? g.team2_name :
            pick.predicted_winner
        }
      }
    }
  } else {
    currentPicks = picks.length
    // Use deriveEffectiveNames + deriveChampion to resolve the predicted bracket
    // chain. This prevents "Winner of Game #N" appearing when the slot key
    // resolves to a game whose team_name is still a placeholder string.
    if (games.length > 0) {
      const effectiveNames = deriveEffectiveNames(games, picks)
      pickTeamName         = deriveChampion(games, picks, effectiveNames)
    }
  }

  const isComplete = currentPicks >= requiredPicks
  const pct        = requiredPicks > 0 ? Math.min(100, Math.round((currentPicks / requiredPicks) * 100)) : 0

  // Compute lock countdown for display label
  let lockTimeStr = ''
  const lockIso = isSurvivor && activeRound > 0
    ? tournament.round_locks?.[activeRound]
    : tournament.locks_at

  if (lockIso) {
    const diff = new Date(lockIso).getTime() - currentTime
    if (diff > 0) {
      const h = Math.floor(diff / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      lockTimeStr = h > 48 ? `${Math.floor(h / 24)}d` : `${h}h ${m}m`
    }
  }

  // Report completion status to parent on every change
  useEffect(() => {
    onStatus(tournament.id, isComplete)
  }, [isComplete, tournament.id, onStatus])

  return (
    <button
      onClick={() => onClick(tournament.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all shadow-sm
        bg-white dark:bg-slate-900/50
        ${isComplete
          ? 'border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400 dark:hover:border-emerald-600/60'
          : 'border-amber-200 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600/60'
        }`}
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} />

      {/* Main content block */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Tournament name + lock countdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {tournament.name}
          </span>
          {lockTimeStr && (
            <span className={`text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ${
              isComplete ? 'text-slate-400' : 'text-amber-500'
            }`}>
              <Clock size={10} />
              {lockTimeStr}
            </span>
          )}
        </div>

        {/* Pick detail label + team name */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5 truncate">
            {pickLabel}:
            {pickTeamName ? (
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 normal-case tracking-normal">
                {pickTeamName}
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-500 normal-case tracking-normal">
                No pick yet
              </span>
            )}
          </span>
          <span className={`text-[10px] font-bold flex-shrink-0 ${
            isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
          }`}>
            {currentPicks}/{requiredPicks}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />
    </button>
  )
}

// ── HomePage ──────────────────────────────────────────────────
export default function HomePage() {
  const theme = useTheme()
  const { profile } = useAuth()
  const firstName = profile?.display_name?.split(' ')[0] || 'Hoops Fan'

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

  // Tracks per-tournament completion state reported by TournamentBannerRow children.
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

  // Banner is green only once every open tournament has confirmed completion
  const allPicksComplete = openTournaments.length > 0 &&
    openTournaments.every(t => completionMap[t.id] === true)

  const displayedTournaments = showAllTourneys ? allTournaments : allTournaments.slice(0, 5)

  const navigateToBracket = useCallback((tId: string) => {
    selectTournament(tId)
    setActiveView('bracket')
  }, [selectTournament, setActiveView])

  const navigateToGroup = useCallback((gId: string) => {
    setActiveGroup(gId)
    selectTournament(null)
    setActiveView('group')
  }, [setActiveGroup, selectTournament, setActiveView])

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">

        {/* ── Welcome Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {firstName}
            </h1>
          </div>

          {/* Stat cards */}
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

        {/* ── Persistent Action Banner ──
            Always visible when the user has open tournaments.
            Switches between amber (missing picks) and emerald (all done). */}
        {openTournaments.length > 0 && (
          <div className={`border rounded-2xl p-5 flex flex-col gap-4 transition-colors duration-300 ${
            allPicksComplete
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
          }`}>
            {/* Banner header */}
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                allPicksComplete ? 'bg-emerald-500/20' : 'bg-amber-500/20'
              }`}>
                {allPicksComplete
                  ? <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-500" />
                  : <AlertCircle  size={20} className="text-amber-600 dark:text-amber-500" />
                }
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {allPicksComplete ? 'No action required' : 'Pick action required'}
                </h3>
                <p className={`text-xs font-medium mt-0.5 ${
                  allPicksComplete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {allPicksComplete
                    ? "You're all set — all picks submitted."
                    : 'You have open tournaments awaiting picks.'}
                </p>
              </div>
            </div>

            {/* Per-tournament rows with pick detail */}
            <div className="flex flex-col gap-2">
              {openTournaments.map((t: Tournament) => (
                <TournamentBannerRow
                  key={t.id}
                  tournament={t}
                  currentTime={currentTime}
                  onClick={navigateToBracket}
                  onStatus={handleBannerStatus}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Main Grid: Tournaments + Groups ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left 2/3 — All Tournaments */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-display font-black uppercase tracking-widest ${theme.textBase}`}>
                All Tournaments
              </h2>
              {isAdmin && (
                <button
                  onClick={() => openAddTournament()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${theme.btn}`}
                >
                  <Plus size={12} /> New Tournament
                </button>
              )}
            </div>

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
                    <button
                      key={t.id}
                      onClick={() => navigateToBracket(t.id)}
                      className="w-full flex items-center justify-between bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 p-4 rounded-xl transition-all text-left shadow-sm group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          effStatus === 'open'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                        }`}>
                          <Trophy size={14} />
                        </div>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              effStatus === 'open'      ? 'text-emerald-500' :
                              effStatus === 'completed' ? 'text-violet-500'  :
                              'text-slate-400'
                            }`}>
                              {effStatus === 'locked' ? 'active' : effStatus}
                            </span>
                            {t.game_type === 'survivor' && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">· Survivor</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-slate-400 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all shrink-0 ml-2"
                      />
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

          {/* Right 1/3 — Groups */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-display font-black uppercase tracking-widest ${theme.textBase}`}>
                My Groups
              </h2>
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    onClick={() => openCreateGroup()}
                    title="Create group"
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${theme.btn}`}
                  >
                    <Plus size={14} />
                  </button>
                )}
                <button
                  onClick={() => openJoinGroup()}
                  title="Join group"
                  className="p-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-slate-500 hover:text-amber-500 transition-all"
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

            {isLoadingGroups ? (
              <div className="animate-pulse h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
            ) : groups.length === 0 ? (
              <div className="bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-2xl p-6 text-center space-y-3">
                <p className="text-sm text-slate-500 font-medium">You're not in any groups yet.</p>
                <button
                  onClick={() => openJoinGroup()}
                  className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:border-amber-500 text-slate-500 hover:text-amber-500 transition-all"
                >
                  <UserPlus size={12} /> Join a Group
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(groups as Group[]).map(g => (
                  <button
                    key={g.id}
                    onClick={() => navigateToGroup(g.id)}
                    className="w-full flex items-center justify-between bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 p-4 rounded-xl transition-all text-left shadow-sm group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Users size={14} className="text-indigo-500" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{g.name}</span>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-slate-400 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all shrink-0 ml-2"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Admin badge */}
            {isAdmin && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield size={14} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Admin Mode Active</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}