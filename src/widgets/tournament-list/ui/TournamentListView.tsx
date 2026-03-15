// src/widgets/tournament-list/ui/TournamentListView.tsx

import { useState, useMemo }                from 'react'
import { ChevronDown, Globe, Users, Skull, Eye } from 'lucide-react'
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
import { Avatar }                           from '../../../shared/ui'
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
  const isEffectivelyLocked  = t.status === 'locked' || t.status === 'completed' || (t.status === 'open' && locked)

  const displayStatus =
    t.status === 'completed'           ? 'completed' :
    t.status === 'draft'               ? 'draft'     :
    isEffectivelyLocked                ? 'locked'    :
    'open'

  const cardBorderCls =
    displayStatus === 'open'      ? `border-2 ${theme.border} ${theme.bg} hover:${theme.bgMd}` :
    displayStatus === 'completed' ? 'border-2 border-violet-500/40 bg-violet-500/5 hover:border-violet-400/60' :
    'border-2 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700'

  const badgeCls =
    displayStatus === 'open'      ? `${theme.bg} ${theme.accent}`                                      :
    displayStatus === 'draft'     ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
    displayStatus === 'completed' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300' :
    'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500'

  const borderTopCls =
    displayStatus === 'completed' ? 'border-violet-500/20' :
    'border-slate-200 dark:border-slate-800/50'

  return (
    <button
      onClick={() => onSelect(t)}
      className={`text-left p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.99] w-full flex flex-col h-[180px] ${cardBorderCls}`}
    >
      <div className="flex items-start justify-between gap-3 w-full mb-2">
        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wide leading-tight line-clamp-2">
          {t.name}
        </h3>
        <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest ${badgeCls}`}>
          {statusIcon(t.status)} {statusLabel(t.status)}
        </span>
      </div>

      {/* FOOTER: Anchored to the bottom to guarantee perfect grid alignment */}
      <div className={`mt-auto w-full pt-4 border-t flex flex-col justify-center min-h-[44px] ${borderTopCls}`}>
        {displayStatus === 'open' && !isAdmin && games.length > 0 && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Your picks</span>
              <span className={`text-[10px] font-bold ${pct === 100
                ? 'text-emerald-600 dark:text-emerald-400'
                : theme.accent}`}>
                {myPickCount} / {games.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : theme.btn.split(' ')[0]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {displayStatus === 'draft' && isAdmin && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">
            {games.length} game{games.length !== 1 ? 's' : ''} · Draft
          </p>
        )}

        {displayStatus === 'completed' && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400 text-center">
            Results final
          </p>
        )}

        {(displayStatus === 'locked' || (displayStatus === 'open' && isAdmin)) && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">
            {displayStatus === 'locked' ? 'Picks Locked' : `${games.length} games`}
          </p>
        )}
      </div>
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

  const selectTournamentId = useUIStore((s) => s.selectTournament)
  const openSnoop          = useUIStore((s) => s.openSnoop)

  const [activeContext, setActiveContext] = useState<string>('global')
  const [dropdownOpen, setDropdownOpen]   = useState(false)

  const { data: activeGroupMembers = [] } = useGroupMembersQuery(
    activeContext !== 'global' ? activeContext : '',
  )

  const isAdmin = profile?.is_admin ?? false

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

    let contextProfiles = rawData.allProfiles
    if (activeContext !== 'global') {
      const memberUserIds = new Set(activeGroupMembers.map(m => m.user_id))
      contextProfiles = contextProfiles.filter(p => memberUserIds.has(p.id))
    }

    return computeLeaderboard(picks, games, rawData.allGames, contextProfiles, tMap)
  }, [rawData, standardTourneys, activeGroupMembers, activeContext])

  const survivorBoards = useMemo(() => {
    if (!rawData || !survivorTourneys.length) return []

    let contextProfiles = rawData.allProfiles
    if (activeContext !== 'global') {
      const memberUserIds = new Set(activeGroupMembers.map(m => m.user_id))
      contextProfiles = contextProfiles.filter(p => memberUserIds.has(p.id))
    }

    return survivorTourneys.map((t: Tournament) => {
      const tMap    = new Map([[t.id, t]])
      const games   = rawData.allGames.filter(g => g.tournament_id === t.id)
      const gameIds = new Set(games.map(g => g.id))
      const picks   = rawData.allPicks.filter(p => gameIds.has(p.game_id))
      return {
        tournamentName: t.name,
        board: computeLeaderboard(picks, games, rawData.allGames, contextProfiles, tMap),
      }
    })
  }, [rawData, survivorTourneys, activeGroupMembers, activeContext])

  if (!profile) return null

  const open = activeTournaments.filter(
    (t: Tournament) => t.status === 'open' && !isPicksLocked(t, isAdmin),
  )
  const draft = isAdmin ? activeTournaments.filter((t: Tournament) => t.status === 'draft') : []
  const locked = activeTournaments.filter(
    (t: Tournament) =>
      t.status === 'locked' ||
      (t.status === 'open' && isPicksLocked(t, isAdmin)),
  )
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
            <TournamentCard key={t.id} t={t} isAdmin={isAdmin} onSelect={handleSelect} />
          ))}
        </div>
      </div>
    )
  }

  const noTournaments = !open.length && !draft.length && !locked.length && !completed.length
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
              {activeContext === 'global'
                ? <Globe size={18} className={theme.textMuted} />
                : <Users size={18} className={theme.textMuted} />
              }
              <span className={`font-bold text-sm ${theme.textBase}`}>{activeGroupName}</span>
              <ChevronDown size={16} className={`${theme.textMuted} transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
                <button
                  onClick={() => { setActiveContext('global'); setDropdownOpen(false) }}
                  className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm font-bold transition-colors
                    ${activeContext === 'global' ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
                >
                  <Globe size={16} /> Global Tournaments
                </button>
                <div className={`h-px w-full ${theme.borderBase} bg-slate-200 dark:bg-slate-800`} />
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { setActiveContext(g.id); setDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm font-bold transition-colors
                      ${activeContext === g.id ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
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

            {/* ── Standings Section ── */}
            {(standardTourneys.length > 0 || survivorTourneys.length > 0) && (
              <div className="mt-12 w-full flex flex-col items-center">
                <h2 className={`font-display text-2xl font-black uppercase tracking-widest mb-8 text-center ${theme.textBase}`}>
                  {activeGroupName} Standings
                </h2>
                <div className={`grid grid-cols-1 ${(standardTourneys.length > 0 && survivorTourneys.length > 0) ? 'xl:grid-cols-2' : 'max-w-4xl mx-auto'} gap-8 items-start w-full max-w-7xl`}>
                  
                  {/* ── STANDARD BRACKETS ── */}
                  {standardTourneys.length > 0 && (
                    <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm`}>
                      <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20`}>
                        <h3 className={`font-display text-lg font-black uppercase tracking-widest ${theme.textBase}`}>
                          Overall Bracket Standings
                        </h3>
                      </div>
                      <div className="flex-1 p-4">
                        {standardBoard.length === 0 ? (
                          <p className={`text-sm text-center py-8 ${theme.textMuted}`}>No active players.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {standardBoard.map((entry, i) => {
                              const isMe = entry.profile.id === profile?.id;
                              return (
                                <div key={entry.profile.id} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.borderBase} ${isMe ? `${theme.bgMd} border-amber-500/30` : 'bg-white dark:bg-[#11141d]'}`}>
                                  <span className="w-6 text-center font-bold text-slate-500 text-xs">#{i + 1}</span>
                                  <Avatar profile={entry.profile} size="sm" />
                                  <span className={`flex-1 font-semibold text-sm truncate ${theme.textBase}`}>
                                    {entry.profile.display_name} {isMe && <span className="text-[10px] font-normal text-slate-500 ml-1">(you)</span>}
                                  </span>
                                  <div className="text-right w-16 flex-shrink-0">
                                    <p className={`font-bold ${theme.accent}`}>{entry.points} pts</p>
                                    <p className={`text-[10px] ${theme.textMuted}`}>Max {entry.maxPossible}</p>
                                  </div>
                                  {isAdmin && (
                                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                                      {!isMe && (
                                        <button onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id); }} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                                          <Eye size={16} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── SURVIVOR POOLS ── */}
                  {survivorBoards.map(({ tournamentName, board }) => (
                    <div key={tournamentName} className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm`}>
                      <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20`}>
                        <h3 className={`font-display text-lg font-black uppercase tracking-widest ${theme.textBase}`}>
                          {tournamentName} — Survivor
                        </h3>
                      </div>
                      <div className="flex-1 p-4">
                        {board.length === 0 ? (
                          <p className={`text-sm text-center py-8 ${theme.textMuted}`}>No active players.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {board.map((entry, i) => {
                              const isMe = entry.profile.id === profile?.id;
                              return (
                                <div key={entry.profile.id} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.borderBase} ${entry.isEliminated ? 'opacity-50 grayscale' : ''} ${isMe && !entry.isEliminated ? `${theme.bgMd} border-amber-500/30` : 'bg-white dark:bg-[#11141d]'}`}>
                                  <span className="w-6 text-center font-bold text-slate-500 text-xs">
                                    {entry.isEliminated ? <Skull size={14} className="mx-auto text-rose-500" /> : `#${i + 1}`}
                                  </span>
                                  <Avatar profile={entry.profile} size="sm" />
                                  <div className="flex-1 flex flex-col min-w-0">
                                    <span className={`font-semibold text-sm truncate ${entry.isEliminated ? 'line-through' : theme.textBase}`}>
                                      {entry.profile.display_name} {isMe && <span className="text-[10px] font-normal text-slate-500 ml-1 no-underline">(you)</span>}
                                    </span>
                                    {entry.isEliminated && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Eliminated</span>}
                                  </div>
                                  <div className="text-right w-16 flex-shrink-0">
                                    <p className={`font-bold ${theme.textBase}`}>{entry.seedScore}</p>
                                    <p className={`text-[10px] ${theme.textMuted}`}>Seed Score</p>
                                  </div>
                                  {isAdmin && (
                                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                                      {!isMe && (
                                        <button onClick={(e) => { e.stopPropagation(); openSnoop(entry.profile.id); }} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                                          <Eye size={16} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
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