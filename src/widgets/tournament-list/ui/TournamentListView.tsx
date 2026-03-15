// src/widgets/tournament-list/ui/TournamentListView.tsx

import { useState, useMemo }                from 'react'
import { ChevronDown, Globe, Users }        from 'lucide-react'
import { useTheme }                         from '../../../shared/lib/theme'
import { isPicksLocked }                    from '../../../shared/lib/time'
import { statusLabel, statusIcon }          from '../../../shared/lib/helpers'
import { useAuth }                          from '../../../features/auth'
import { useUIStore }                       from '../../../shared/store/uiStore'
import { useTournamentListQuery, useGames } from '../../../entities/tournament/model/queries'
import { useMyPicks }                       from '../../../entities/pick/model/queries'
import { useUserGroupsQuery, useGroupMembersQuery } from '../../../entities/group/model/queries'
import { useLeaderboardRaw }                from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }               from '../../../features/leaderboard/model/selectors'
import { StandardStandingsTable, SurvivorStandingsTable } from '../../../features/leaderboard'
import type { Tournament }                  from '../../../shared/types'

// ── TournamentCard ────────────────────────────────────────────
interface CardProps {
  t:        Tournament
  isAdmin:  boolean
  onSelect: (t: Tournament) => void
}

function TournamentCard({ t, isAdmin, onSelect }: CardProps) {
  const theme = useTheme()
  const { data: games = [] } = useGames(t.id)
  const { data: picks = [] } = useMyPicks(t.id, games)
  const myPickCount          = picks.length
  const locked               = isPicksLocked(t, isAdmin)
  const pct                  = games.length > 0 ? Math.round((myPickCount / games.length) * 100) : 0
  const isEffectivelyLocked  = t.status === 'locked' || (t.status === 'open' && locked)
  const displayStatus        = t.status === 'draft' ? 'draft' : isEffectivelyLocked ? 'locked' : 'open'

  return (
    <button
      onClick={() => onSelect(t)}
      className={`text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.99] w-full
        ${displayStatus === 'open'
          ? `${theme.border} ${theme.bg} hover:${theme.bgMd}`
          : 'border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wide leading-tight">
          {t.name}
        </h3>
        <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest
          ${displayStatus === 'open'  ? `${theme.bg} ${theme.accent}` :
            displayStatus === 'draft' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                        'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500'
          }`}
        >
          {statusIcon(displayStatus)} {statusLabel(displayStatus)}
        </span>
      </div>

      {displayStatus === 'open' && !isAdmin && games.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Your picks</span>
            <span className={`text-[10px] font-bold ${pct === 100
              ? 'text-emerald-600 dark:text-emerald-400'
              : theme.accent}`}>
              {myPickCount} / {games.length}
            </span>
          </div>
          <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : theme.btn.split(' ')[0]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {displayStatus === 'draft' && isAdmin && (
        <p className="text-[11px] text-slate-500 mt-1">
          {games.length} game{games.length !== 1 ? 's' : ''} · Draft
        </p>
      )}
    </button>
  )
}

// ── Command Center View ───────────────────────────────────────
export default function TournamentListView() {
  const theme = useTheme()
  const { profile }                = useAuth()
  const { data: tournaments = [] } = useTournamentListQuery()
  const { data: groups = [] }      = useUserGroupsQuery()
  const { data: rawData }          = useLeaderboardRaw()
  
  const selectTournamentId         = useUIStore((s) => s.selectTournament)
  
  const [activeContext, setActiveContext] = useState<string>('global')
  const [dropdownOpen, setDropdownOpen]   = useState(false)

  // Fetch members for the active group if a group is selected
  const { data: activeGroupMembers = [] } = useGroupMembersQuery(
    activeContext !== 'global' ? activeContext : ''
  )

  const isAdmin = profile?.is_admin ?? false

  // 1. Filter Tournaments based on Active Context (Memoized)
  const activeTournaments = useMemo(() => tournaments.filter((t: Tournament) => {
    if (activeContext === 'global') return !t.group_id
    return t.group_id === activeContext && (isAdmin || t.status !== 'draft')
  }), [tournaments, activeContext, isAdmin])

  // 2. Separate into Standard and Survivor
  const standardTourneys = useMemo(() => activeTournaments.filter((t: Tournament) => t.game_type !== 'survivor'), [activeTournaments])
  const survivorTourneys = useMemo(() => activeTournaments.filter((t: Tournament) => t.game_type === 'survivor'), [activeTournaments])

  // 3. Compute Standard Board (All combined)
  const standardBoard = useMemo(() => {
    if (!rawData || !standardTourneys.length) return []
    const tMap = new Map(standardTourneys.map((t: Tournament) => [t.id, t]))
    const games = rawData.allGames.filter(g => tMap.has(g.tournament_id))
    const gameIds = new Set(games.map(g => g.id))
    const picks = rawData.allPicks.filter(p => gameIds.has(p.game_id))

    let contextProfiles = rawData.allProfiles
    if (activeContext !== 'global') {
      const memberUserIds = new Set(activeGroupMembers.map(m => m.user_id))
      contextProfiles = contextProfiles.filter(p => memberUserIds.has(p.id))
    }

    return computeLeaderboard(picks, games, rawData.allGames, contextProfiles, tMap)
  }, [rawData, standardTourneys, activeGroupMembers, activeContext])

  // 4. Compute Survivor Boards (Separated per tournament)
  const survivorBoards = useMemo(() => {
    if (!rawData || !survivorTourneys.length) return []
    
    let contextProfiles = rawData.allProfiles
    if (activeContext !== 'global') {
      const memberUserIds = new Set(activeGroupMembers.map(m => m.user_id))
      contextProfiles = contextProfiles.filter(p => memberUserIds.has(p.id))
    }

    return survivorTourneys.map((t: Tournament) => {
      const tMap = new Map([[t.id, t]])
      const games = rawData.allGames.filter(g => g.tournament_id === t.id)
      const gameIds = new Set(games.map(g => g.id))
      const picks = rawData.allPicks.filter(p => gameIds.has(p.game_id))
      
      return {
        tournamentName: t.name,
        board: computeLeaderboard(picks, games, rawData.allGames, contextProfiles, tMap)
      }
    })
  }, [rawData, survivorTourneys, activeGroupMembers, activeContext])

  // =====================================================================
  // ALL HOOKS MUST BE ABOVE THIS LINE
  // =====================================================================
  
  if (!profile) return null

  const open   = activeTournaments.filter((t: Tournament) => t.status === 'open' && !isPicksLocked(t, isAdmin))
  const draft  = isAdmin ? activeTournaments.filter((t: Tournament) => t.status === 'draft') : []
  const locked = activeTournaments.filter(
    (t: Tournament) => t.status === 'locked' || (t.status === 'open' && isPicksLocked(t, isAdmin)),
  )

  const handleSelect = (t: Tournament) => selectTournamentId(t.id)

  const renderSection = (label: string, items: Tournament[]) => {
    if (!items.length) return null
    return (
      <div className="mb-8">
        <h2 className="font-display text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
          {label}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t: Tournament) => (
            <TournamentCard key={t.id} t={t} isAdmin={isAdmin} onSelect={handleSelect} />
          ))}
        </div>
      </div>
    )
  }

  const noTournaments = !open.length && !draft.length && !locked.length
  const activeGroupName = groups.find(g => g.id === activeContext)?.name || 'Global'

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto w-full">
      {/* Sleek Context Toggle Header */}
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
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
                <button
                  onClick={() => { setActiveContext('global'); setDropdownOpen(false) }}
                  className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm font-bold transition-colors ${activeContext === 'global' ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
                >
                  <Globe size={16} /> Global Tournaments
                </button>
                <div className={`h-px w-full ${theme.borderBase} bg-slate-200 dark:bg-slate-800`} />
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { setActiveContext(g.id); setDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm font-bold transition-colors ${activeContext === g.id ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
                  >
                    <Users size={16} /> {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {noTournaments ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
            <img src="/logo.png" alt="No Tournaments" className="w-16 h-16 object-contain opacity-40 mb-3 drop-shadow-md rounded-xl" />
            <p className="text-slate-500 text-sm font-bold">No active tournaments in this view.</p>
          </div>
        ) : (
          <>
            {renderSection('Open', open)}
            {renderSection('Draft', draft)}
            {renderSection('Locked / Completed', locked)}

            {/* Standings Section */}
            {(standardTourneys.length > 0 || survivorTourneys.length > 0) && (
              <div className="mt-12">
                <h2 className={`font-display text-2xl font-black uppercase tracking-widest mb-6 ${theme.textBase}`}>
                  {activeGroupName} Standings
                </h2>
                <div className={`grid grid-cols-1 ${standardTourneys.length > 0 && survivorTourneys.length > 0 ? 'lg:grid-cols-2' : 'max-w-4xl'} gap-8 items-start`}>
                  
                  {standardTourneys.length > 0 && (
                    <StandardStandingsTable
                      title="Bracket Standings"
                      board={standardBoard}
                      isMe={(id) => id === profile.id}
                      isAdmin={isAdmin}
                    />
                  )}

                  {survivorBoards.length > 0 && (
                    <div className="flex flex-col gap-8">
                      {survivorBoards.map((sb, idx) => (
                        <SurvivorStandingsTable
                          key={idx}
                          title={`${sb.tournamentName} Standings`}
                          board={sb.board}
                          isMe={(id) => id === profile.id}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  )}
                  
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}