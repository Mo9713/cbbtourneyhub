import { useState, useMemo }                        from 'react'
import { ChevronDown, Globe, Users }                from 'lucide-react'
import { useTheme }                                 from '../../../shared/lib/theme'
import { isPicksLocked }                            from '../../../shared/lib/time'
import { useAuth }                                  from '../../../features/auth'
import { useUIStore }                               from '../../../shared/store/uiStore'
import { useTournamentListQuery }                   from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery, useGroupMembersQuery } from '../../../entities/group/model/queries'
import { useLeaderboardRaw }                        from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }                       from '../../../features/leaderboard/model/selectors'
import { StandardStandingsTable }                   from '../../../features/leaderboard/ui/StandardStandingsTable'
import { SurvivorStandingsTable }                   from '../../../features/leaderboard/ui/SurvivorStandingsTable'
import { StandardTournamentCard, SurvivorTournamentCard } from '../../../entities/tournament'
import type { Tournament }                          from '../../../shared/types'

export default function TournamentListView() {
  const theme = useTheme()
  const { profile }                = useAuth()
  const { data: tournaments = [], isLoading: isLoadingTourneys } = useTournamentListQuery()
  const { data: groups = [],      isLoading: isLoadingGroups } = useUserGroupsQuery()
  const { data: rawData,          isLoading: isLoadingBoard } = useLeaderboardRaw()

  const selectTournamentId = useUIStore((s) => s.selectTournament)

  const [activeContext, setActiveContext] = useState<string>('global')
  const [dropdownOpen, setDropdownOpen]   = useState(false)

  const { data: activeGroupMembers = [] } = useGroupMembersQuery(
    activeContext !== 'global' ? activeContext : '',
  )

  const isAdmin = profile?.is_admin ?? false
  const isMe    = (id: string) => id === profile?.id

  const activeTournaments = useMemo(() => tournaments.filter((t: Tournament) => {
    if (activeContext === 'global') return !t.group_id
    return t.group_id === activeContext && (isAdmin || t.status !== 'draft')
  }), [tournaments, activeContext, isAdmin])

  const standardTourneys = useMemo(
    () => activeTournaments.filter((t: Tournament) => t.game_type !== 'survivor'),
    [activeTournaments],
  )
  const survivorTourneys = useMemo(
    () => activeTournaments.filter((t: Tournament) => t.game_type === 'survivor'),
    [activeTournaments],
  )

  const standardBoard = useMemo(() => {
    if (!rawData || !standardTourneys.length) return []
    const tMap    = new Map(standardTourneys.map((t: Tournament) => [t.id, t]))
    const games   = rawData.allGames.filter(g => tMap.has(g.tournament_id))
    const gameIds = new Set(games.map(g => g.id))
    const picks   = rawData.allPicks.filter(p => gameIds.has(p.game_id))
    const pickUserIds = new Set(picks.map(p => p.user_id))

    let contextProfiles = rawData.allProfiles
    if (activeContext !== 'global') {
      const memberUserIds = new Set(activeGroupMembers.map(m => m.user_id))
      contextProfiles = contextProfiles.filter(p => memberUserIds.has(p.id) || pickUserIds.has(p.id))
    } else {
      contextProfiles = contextProfiles.filter(p => pickUserIds.has(p.id))
    }
    return computeLeaderboard(picks, games, rawData.allGames, contextProfiles, tMap)
  }, [rawData, standardTourneys, activeGroupMembers, activeContext])

  const survivorBoards = useMemo(() => {
    if (!rawData || !survivorTourneys.length) return []
    return survivorTourneys.map((t: Tournament) => {
      const tMap    = new Map([[t.id, t]])
      const games   = rawData.allGames.filter(g => g.tournament_id === t.id)
      const gameIds = new Set(games.map(g => g.id))
      const picks   = rawData.allPicks.filter(p => gameIds.has(p.game_id))
      const pickUserIds = new Set(picks.map(p => p.user_id))

      let contextProfiles = rawData.allProfiles
      if (activeContext !== 'global') {
        const memberUserIds = new Set(activeGroupMembers.map(m => m.user_id))
        contextProfiles = contextProfiles.filter(p => memberUserIds.has(p.id) || pickUserIds.has(p.id))
      } else {
        contextProfiles = contextProfiles.filter(p => pickUserIds.has(p.id))
      }
      return {
        tournamentName: t.name,
        tournamentId: t.id,
        board: computeLeaderboard(picks, games, rawData.allGames, contextProfiles, tMap),
      }
    })
  }, [rawData, survivorTourneys, activeGroupMembers, activeContext])

  if (isLoadingTourneys || isLoadingGroups || isLoadingBoard || !profile) {
    return (
      <div className="flex flex-col h-full max-w-7xl mx-auto w-full animate-pulse">
        <div className={`px-6 py-5 border-b flex-shrink-0 flex items-center justify-between ${theme.headerBg}`}>
          <div className="space-y-2">
            <div className="w-48 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="w-64 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="w-32 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="flex-1 p-6 md:p-10 w-full max-w-5xl mx-auto space-y-10">
          <div className="flex items-center justify-center gap-4 w-full">
            <div className={`h-px flex-1 ${theme.borderBase} bg-slate-200 dark:bg-slate-800`} />
            <div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className={`h-px flex-1 ${theme.borderBase} bg-slate-200 dark:bg-slate-800`} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 w-full">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-full h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const open = activeTournaments.filter((t: Tournament) => t.status === 'open' && !isPicksLocked(t, isAdmin))
  const draft = isAdmin ? activeTournaments.filter((t: Tournament) => t.status === 'draft') : []
  const locked = activeTournaments.filter((t: Tournament) => t.status === 'locked' || (t.status === 'open' && isPicksLocked(t, isAdmin)))
  const completed = activeTournaments.filter((t: Tournament) => t.status === 'completed')

  const handleSelect = (t: Tournament) => selectTournamentId(t.id)

  const renderSection = (label: string, items: Tournament[]) => {
    if (!items.length) return null
    return (
      <div className="mb-10 w-full max-w-5xl mx-auto flex flex-col items-center">
        <div className="flex items-center justify-center gap-4 mb-6 w-full">
          <div className={`h-px flex-1 ${theme.borderBase} bg-slate-200 dark:bg-slate-800`} />
          <h2 className="font-display text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">
            {label} Tournaments
          </h2>
          <div className={`h-px flex-1 ${theme.borderBase} bg-slate-200 dark:bg-slate-800`} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 w-full">
          {items.map((t: Tournament) => (
             t.game_type === 'survivor' 
               ? <SurvivorTournamentCard key={t.id} tournament={t} isAdmin={isAdmin} onSelect={handleSelect} variant="compact" />
               : <StandardTournamentCard key={t.id} tournament={t} isAdmin={isAdmin} onSelect={handleSelect} variant="compact" />
          ))}
        </div>
      </div>
    )
  }

  const noTournaments = !open.length && !draft.length && !locked.length && !completed.length
  const activeGroupName = groups.find(g => g.id === activeContext)?.name || 'Global'

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto w-full">
      <div className={`px-6 py-5 border-b flex-shrink-0 flex items-center justify-between ${theme.headerBg} relative z-20`}>
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
            Tournaments
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Select a bracket to make your picks
          </p>
        </div>

        {groups.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${theme.panelBg} ${theme.borderBase} hover:border-amber-500/50 shadow-sm`}
            >
              {activeContext === 'global' ? <Globe size={18} className={theme.textMuted} /> : <Users size={18} className={theme.textMuted} />}
              <span className={`font-bold text-sm ${theme.textBase}`}>{activeGroupName}</span>
              <ChevronDown size={16} className={`${theme.textMuted} transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl z-50 overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
                <button
                  onClick={() => { setActiveContext('global'); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all ${activeContext === 'global' ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
                >
                  <Globe size={16} /> Global
                </button>
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { setActiveContext(g.id); setDropdownOpen(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all ${activeContext === g.id ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
                  >
                    <Users size={16} /> {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10 scrollbar-thin flex flex-col items-center">
        {noTournaments ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-800 w-full max-w-5xl">
            <img src="/logo.png" alt="No Tournaments" className="w-16 h-16 object-contain opacity-40 mb-3 drop-shadow-md rounded-xl" />
            <p className="text-slate-500 text-sm font-bold">No active tournaments in this view.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {renderSection('Open', open)}
            {renderSection('Draft', draft)}
            {renderSection('Locked', locked)}
            {renderSection('Finished', completed)}

            {(standardTourneys.length > 0 || survivorTourneys.length > 0) && (
              <div className="mt-12 w-full flex flex-col items-center">
                <h2 className={`font-display text-2xl font-black uppercase tracking-widest mb-8 text-center ${theme.textBase}`}>
                  {activeGroupName} Standings
                </h2>
                <div className={`grid grid-cols-1 ${(standardTourneys.length > 0 && survivorTourneys.length > 0) ? 'xl:grid-cols-2' : 'max-w-4xl mx-auto'} gap-8 items-start w-full max-w-7xl`}>
                  {standardTourneys.length > 0 && (
                    <StandardStandingsTable 
                      title="Overall Bracket Standings" 
                      board={standardBoard} 
                      isMe={isMe} 
                      tournamentId={standardTourneys[0]?.id} 
                      showTiebreaker={standardTourneys.some(t => t.requires_tiebreaker === true)} 
                      variant="compact" 
                    />
                  )}
                  {survivorBoards.map(({ tournamentName, board, tournamentId }) => (
                    <SurvivorStandingsTable 
                      key={tournamentName} 
                      title={`${tournamentName} — Survivor`} 
                      board={board} 
                      isMe={isMe} 
                      tournamentId={tournamentId}
                      variant="compact" 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}