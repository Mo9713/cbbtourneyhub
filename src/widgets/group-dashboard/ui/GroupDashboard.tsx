// src/widgets/group-dashboard/ui/GroupDashboard.tsx

import { useMemo }              from 'react'
import { Trash2, LogOut, Skull, Eye } from 'lucide-react'
import { useGroupDetailsQuery, useGroupMembersQuery, useDeleteGroupMutation, useLeaveGroupMutation } from '../../../entities/group'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useLeaderboardRaw }    from '../../../entities/leaderboard/model/queries'
import { computeLeaderboard }   from '../../../features/leaderboard/model/selectors'
import { useTheme }             from '../../../shared/lib/theme'
import { useUIStore }           from '../../../shared/store/uiStore'
import { useAuth }              from '../../../features/auth'
import { isPicksLocked, getActiveSurvivorRound } from '../../../shared/lib/time'
import { Avatar }               from '../../../shared/ui'
import Countdown                from '../../../shared/ui/Countdown'
import type { Tournament }      from '../../../shared/types'

interface GroupDashboardProps {
  groupId: string
}

export function GroupDashboard({ groupId }: GroupDashboardProps) {
  const theme = useTheme()
  const { profile } = useAuth()
  
  const { data: group, isLoading, error } = useGroupDetailsQuery(groupId)
  const { data: members = [] }            = useGroupMembersQuery(groupId)
  const { data: allTournaments = [] }     = useTournamentListQuery()
  const { data: rawData }                 = useLeaderboardRaw()
  
  const deleteGroupM = useDeleteGroupMutation()
  const leaveGroupM  = useLeaveGroupMutation()
  
  const openAddTournament = useUIStore(s => s.openAddTournament)
  const setConfirmModal   = useUIStore(s => s.setConfirmModal)
  const setActiveView     = useUIStore(s => s.setActiveView)
  const setActiveGroup    = useUIStore(s => s.setActiveGroup)
  const selectTournament  = useUIStore(s => s.selectTournament)
  const openSnoop         = useUIStore(s => s.openSnoop)

  const isOwner          = profile?.id === group?.owner_id
  const isAdmin          = profile?.is_admin ?? false
  const groupTournaments = allTournaments.filter((t: Tournament) => 
    t.group_id === groupId && (isAdmin || t.status !== 'draft')
  )

  const standardTourneys = groupTournaments.filter(t => t.game_type !== 'survivor')
  const survivorTourneys = groupTournaments.filter(t => t.game_type === 'survivor')

  const handleDelete = () => {
    if (!group) return
    setConfirmModal({
      title: 'Delete Group',
      message: `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      dangerous: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        deleteGroupM.mutate(group.id, {
          onSuccess: () => {
            setActiveGroup(null)
            setActiveView('home')
            setConfirmModal(null)
          }
        })
      },
      onCancel: () => setConfirmModal(null)
    })
  }

  const handleLeave = () => {
    if (!group) return
    setConfirmModal({
      title: 'Leave Group',
      message: `Are you sure you want to leave "${group.name}"?`,
      dangerous: true,
      confirmLabel: 'Leave',
      onConfirm: () => {
        leaveGroupM.mutate(group.id, {
          onSuccess: () => {
            setActiveGroup(null)
            setActiveView('home')
            setConfirmModal(null)
          }
        })
      },
      onCancel: () => setConfirmModal(null)
    })
  }

  const standardBoard = useMemo(() => {
    if (!rawData || !standardTourneys.length) return []
    const tMap = new Map(standardTourneys.map(t => [t.id, t]))
    const games = rawData.allGames.filter(g => tMap.has(g.tournament_id))
    const gameIds = new Set(games.map(g => g.id))
    const picks = rawData.allPicks.filter(p => gameIds.has(p.game_id))

    const memberUserIds = new Set(members.map(m => m.user_id))
    const groupProfiles = rawData.allProfiles.filter(p => memberUserIds.has(p.id))

    return computeLeaderboard(picks, games, rawData.allGames, groupProfiles, tMap)
  }, [rawData, standardTourneys, members])

  const survivorBoard = useMemo(() => {
    if (!rawData || !survivorTourneys.length) return []
    const tMap = new Map(survivorTourneys.map(t => [t.id, t]))
    const games = rawData.allGames.filter(g => tMap.has(g.tournament_id))
    const gameIds = new Set(games.map(g => g.id))
    const picks = rawData.allPicks.filter(p => gameIds.has(p.game_id))

    const memberUserIds = new Set(members.map(m => m.user_id))
    const groupProfiles = rawData.allProfiles.filter(p => memberUserIds.has(p.id))

    return computeLeaderboard(picks, games, rawData.allGames, groupProfiles, tMap)
  }, [rawData, survivorTourneys, members])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center w-full h-full p-8 ${theme.textMuted}`}>
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin border-amber-500"></div>
      </div>
    )
  }

  if (error || !group) return null

  const renderTournamentCard = (t: Tournament, isSurvivor: boolean) => {
    const locked = isPicksLocked(t, profile?.is_admin ?? false)
    const isCompleted = t.status === 'completed'

    let statusLeft = null
    let statusRight = null

    if (isCompleted) {
      statusLeft = <span className="text-slate-500">Status</span>
      statusRight = <span className="text-violet-500 dark:text-violet-400 font-black">Finished</span>
    } else if (t.status === 'draft') {
      statusLeft = <span className="text-slate-500">Status</span>
      statusRight = <span className="text-amber-500 font-black">Draft</span>
    } else if (isSurvivor) {
      const activeRound = getActiveSurvivorRound(t)
      if (activeRound === 0) {
        statusLeft = <span className="text-slate-500">Status</span>
        statusRight = <span className="text-slate-500 font-black">Locked</span>
      } else {
        if (activeRound === 1) {
          statusLeft = <span className="text-slate-500">Status</span>
          statusRight = <span className="text-emerald-600 dark:text-emerald-500 font-black shadow-[0_0_8px_rgba(16,185,129,0.8)]">Round 1 Open</span>
        } else {
          statusLeft = <span className="text-slate-500">Round {activeRound - 1} Locked</span>
          statusRight = <span className="text-emerald-600 dark:text-emerald-500 font-black shadow-[0_0_8px_rgba(16,185,129,0.8)]">Round {activeRound} Open</span>
        }
      }
    } else {
      statusLeft = <span className="text-slate-500">Status</span>
      statusRight = locked 
        ? <span className="text-slate-500 font-black">Locked</span> 
        : <span className="text-emerald-600 dark:text-emerald-500 font-black shadow-[0_0_8px_rgba(16,185,129,0.8)]">Open</span>
    }

    const cardClasses = isCompleted
      ? `border-violet-500/40 bg-violet-500/5 hover:border-violet-400/60`
      : `${theme.panelBg} ${theme.borderBase} hover:border-amber-500/50`

    return (
      <button
        key={t.id}
        onClick={() => { selectTournament(t.id); setActiveView('bracket') }}
        className={`text-left p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.99] w-full flex flex-col h-[180px] ${cardClasses}`}
      >
        <div className="flex items-start justify-between gap-3 w-full mb-2">
          <h3 className={`font-display text-xl font-bold uppercase tracking-wide leading-tight line-clamp-2 ${theme.textBase}`}>
            {t.name}
          </h3>
          <span className={`flex-shrink-0 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md ${theme.bgMd} ${theme.textMuted}`}>
            {isSurvivor ? 'Survivor' : 'Bracket'}
          </span>
        </div>
        
        <div className="mt-2 flex items-center justify-start w-full empty:hidden">
          <Countdown tournament={t} isAdmin={profile?.is_admin ?? false} timezone={profile?.timezone ?? null} />
        </div>

        <div className="mt-auto w-full pt-4 flex items-center justify-center border-t border-slate-200 dark:border-slate-800/50 text-[10px] sm:text-[11px] uppercase tracking-widest font-bold">
           <div className="flex-1 text-left pr-2 border-r border-slate-200 dark:border-slate-800/50">{statusLeft}</div>
           <div className="flex-1 text-right pl-2">{statusRight}</div>
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8 gap-8">
      {/* ── Group Header ── */}
      <header className={`relative overflow-hidden rounded-2xl border p-8 md:p-10 shadow-sm ${theme.panelBg} ${theme.borderBase} flex flex-col items-center text-center gap-5`}>
        <div className={`absolute top-0 left-0 w-full h-2 ${theme.bgMd}`}></div>
        <div>
          <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${theme.textBase}`}>
            {group.name}
          </h1>
          <div className={`flex items-center justify-center gap-2 mt-4 ${theme.textMuted}`}>
            <span className="text-sm font-medium">Invite Code:</span>
            <span className={`px-3 py-1 rounded-md text-xs font-mono font-bold tracking-widest ${theme.bgMd} ${theme.textBase}`}>
              {group.invite_code}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          {isOwner ? (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all">
              <Trash2 size={16} /> Delete Group
            </button>
          ) : (
            <button onClick={handleLeave} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all">
              <LogOut size={16} /> Leave Group
            </button>
          )}
        </div>
      </header>

      {/* ── Tournaments & Standings ── */}
      <section className="flex flex-col gap-6">
        
        <div className="relative flex flex-col md:flex-row items-center justify-center w-full mb-2">
          <h2 className={`text-3xl font-black uppercase tracking-wider ${theme.textBase}`}>Tournaments</h2>
          {isAdmin && (
            <button onClick={() => openAddTournament()} className={`mt-4 md:mt-0 md:absolute md:right-0 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-transform hover:scale-105 ${theme.btn}`}>
              + New Tournament
            </button>
          )}
        </div>
        
        {groupTournaments.length === 0 ? (
          <div className={`w-full p-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 ${theme.borderBase} ${theme.panelBg}`}>
            <div className="text-4xl opacity-50">🏆</div>
            <h3 className={`text-lg font-semibold ${theme.textBase}`}>No Tournaments Yet</h3>
            <p className={`max-w-md text-sm ${theme.textMuted}`}>
              {isAdmin ? "Click '+ New Tournament' to create one." : "Wait for an admin to create one."}
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${(standardTourneys.length > 0 && survivorTourneys.length > 0) ? 'xl:grid-cols-2' : 'max-w-4xl mx-auto'} gap-8 items-start w-full`}>
            
            {/* ── LEFT COLUMN: STANDARD BRACKETS ── */}
            {standardTourneys.length > 0 && (
              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col gap-4">
                  {standardTourneys.map(t => renderTournamentCard(t, false))}
                </div>
                <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm`}>
                  <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20`}>
                    <h3 className={`font-display text-lg font-black uppercase tracking-widest ${theme.textBase}`}>
                      Bracket Standings
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
              </div>
            )}

            {/* ── RIGHT COLUMN: SURVIVOR POOLS ── */}
            {survivorTourneys.length > 0 && (
              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col gap-4">
                  {survivorTourneys.map(t => renderTournamentCard(t, true))}
                </div>
                <div className={`flex flex-col rounded-2xl border ${theme.panelBg} ${theme.borderBase} overflow-hidden shadow-sm`}>
                  <div className={`px-5 py-4 border-b ${theme.borderBase} bg-slate-100/50 dark:bg-black/20`}>
                    <h3 className={`font-display text-lg font-black uppercase tracking-widest ${theme.textBase}`}>
                      Survivor Standings
                    </h3>
                  </div>
                  <div className="flex-1 p-4">
                    {survivorBoard.length === 0 ? (
                      <p className={`text-sm text-center py-8 ${theme.textMuted}`}>No active players.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {survivorBoard.map((entry, i) => {
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
              </div>
            )}

          </div>
        )}
      </section>
    </div>
  )
}