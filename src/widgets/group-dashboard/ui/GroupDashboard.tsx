// src/widgets/group-dashboard/ui/GroupDashboard.tsx

import { Trash2, LogOut }       from 'lucide-react'
import { useGroupDetailsQuery, useDeleteGroupMutation, useLeaveGroupMutation } from '../../../entities/group'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useTheme }             from '../../../shared/lib/theme'
import { useUIStore }           from '../../../shared/store/uiStore'
import { useAuth }              from '../../../features/auth'
import type { Tournament }      from '../../../shared/types'

interface GroupDashboardProps {
  groupId: string
}

export function GroupDashboard({ groupId }: GroupDashboardProps) {
  const theme = useTheme()
  const { profile } = useAuth()
  
  const { data: group, isLoading, error } = useGroupDetailsQuery(groupId)
  const { data: allTournaments = [] }     = useTournamentListQuery()
  
  const deleteGroupM = useDeleteGroupMutation()
  const leaveGroupM  = useLeaveGroupMutation()
  
  const openAddTournament = useUIStore(s => s.openAddTournament)
  const setConfirmModal   = useUIStore(s => s.setConfirmModal)
  const setActiveView     = useUIStore(s => s.setActiveView)
  const setActiveGroup    = useUIStore(s => s.setActiveGroup)
  const selectTournament  = useUIStore(s => s.selectTournament)

  const isOwner          = profile?.id === group?.owner_id
  const groupTournaments = allTournaments.filter((t: Tournament) => t.group_id === groupId)

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

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center w-full h-full p-8 ${theme.textMuted}`}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin border-amber-500`}></div>
          <p>Loading group dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="flex items-center justify-center w-full h-full p-8">
        <div className={`p-6 rounded-lg border text-center ${theme.panelBg} ${theme.borderBase}`}>
          <h2 className="text-xl font-bold text-red-500 mb-2">Group Not Found</h2>
          <p className={theme.textMuted}>We couldn't load the details for this group.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto p-4 md:p-8 gap-8">
      {/* ── Group Header ── */}
      <header className={`relative overflow-hidden rounded-2xl border p-8 shadow-sm ${theme.panelBg} ${theme.borderBase}`}>
        <div className={`absolute top-0 left-0 w-2 h-full ${theme.bgMd}`}></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight ${theme.textBase}`}>
              {group.name}
            </h1>
            <div className={`flex items-center gap-2 mt-2 ${theme.textMuted}`}>
              <span className="text-sm font-medium">Invite Code:</span>
              <span className={`px-2 py-1 rounded text-xs font-mono font-bold tracking-wider ${theme.bgMd} ${theme.textBase}`}>
                {group.invite_code}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOwner ? (
              <button 
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all"
              >
                <Trash2 size={16} />
                Delete
              </button>
            ) : (
              <button 
                onClick={handleLeave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all"
              >
                <LogOut size={16} />
                Leave
              </button>
            )}
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${theme.borderBase} ${theme.textBase}`}>
              Group Hub
            </span>
          </div>
        </div>
      </header>

      {/* ── Tournaments Section ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className={`text-2xl font-bold ${theme.textBase}`}>Tournaments</h2>
          {profile?.is_admin && (
            <button 
              onClick={() => openAddTournament()}
              className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-transform hover:scale-105 ${theme.btn}`}
            >
              + New Tournament
            </button>
          )}
        </div>
        
        {groupTournaments.length === 0 ? (
          <div className={`w-full p-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 ${theme.borderBase} ${theme.panelBg}`}>
            <div className={`text-4xl opacity-50`}>🏆</div>
            <h3 className={`text-lg font-semibold ${theme.textBase}`}>No Tournaments Yet</h3>
            <p className={`max-w-md text-sm ${theme.textMuted}`}>
              This group doesn't have any active tournaments. 
              {profile?.is_admin ? " Click '+ New Tournament' to create one." : " Wait for an admin to create one."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupTournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  selectTournament(t.id)
                  setActiveView('bracket')
                }}
                className={`text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.99] w-full border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700`}
              >
                 <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wide leading-tight">
                      {t.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 uppercase tracking-widest font-bold">
                    {t.status}
                  </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}