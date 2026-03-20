import { useMemo } from 'react'
import { Users, ArrowRight } from 'lucide-react'
import { useGroupDetailsQuery, useGroupMembersQuery } from '../../../entities/group'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useTheme } from '../../../shared/lib/theme'
import { useAuth } from '../../../features/auth'
import { useUIStore } from '../../../shared/store/uiStore'
import { CopyInviteLink, DeleteGroupButton, LeaveGroupButton } from '../../../features/group-management'
import { StandardTournamentCard, SurvivorTournamentCard } from '../../../entities/tournament'
import { useStabilizedLoading } from '../../../shared/lib/useStabilizedLoading'
import type { Tournament } from '../../../shared/types'

export function GroupDashboard({ groupId }: { groupId: string }) {
  const theme = useTheme()
  const { profile } = useAuth()
  const ui = useUIStore()
  
  const { data: group,       isLoading: isLoadingGroup }   = useGroupDetailsQuery(groupId)
  const { data: members,     isLoading: isLoadingMembers } = useGroupMembersQuery(groupId)
  const { data: tournaments, isLoading: isLoadingTourneys } = useTournamentListQuery()

  const isAdmin = profile?.is_admin ?? false
  const groupTournaments = (tournaments || []).filter((t: Tournament) => t.group_id === groupId && (isAdmin || t.status !== 'draft'))
  
  const standardTournaments = useMemo(() => groupTournaments.filter(t => t.game_type !== 'survivor'), [groupTournaments])
  const survivorTournaments = useMemo(() => groupTournaments.filter(t => t.game_type === 'survivor'), [groupTournaments])

  const handleSelectTournament = (t: Tournament) => {
    ui.selectTournament(t.id)
    ui.setActiveView('bracket')
  }

  const isDataLoading = isLoadingGroup || isLoadingMembers || isLoadingTourneys || !group || !members || !tournaments || !profile;
  const showSkeleton = useStabilizedLoading(isDataLoading, 150);

  if (showSkeleton || !group || !members || !tournaments || !profile) {
    return (
      <div className="flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8 gap-8 animate-in fade-in duration-300">
        <header className={`relative overflow-hidden rounded-2xl border p-8 md:p-10 shadow-sm ${theme.panelBg} ${theme.borderBase} flex flex-col items-center text-center gap-6`}>
          <div className={`absolute top-0 left-0 w-full h-2 ${theme.bgMd}`} />
          <div className="w-64 h-12 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800/50 rounded-full animate-pulse mt-2" />
          <div className="w-48 h-10 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse mt-4 border border-slate-300 dark:border-slate-700" />
        </header>
        
        <section className="flex flex-col gap-6">
          <div className="flex justify-center w-full mb-2">
            <div className="w-64 h-10 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start w-full">
            <div className="flex flex-col gap-6 w-full">
              <div className="w-full h-40 bg-slate-200 dark:bg-slate-800/50 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
            </div>
            <div className="flex flex-col gap-6 w-full">
              <div className="w-full h-40 bg-slate-200 dark:bg-slate-800/50 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
            </div>
          </div>
          <div className="flex justify-center w-full mt-4">
            <div className="w-full max-w-lg h-16 bg-slate-200 dark:bg-slate-800/50 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8 gap-8">
      <header className={`relative overflow-hidden rounded-2xl border p-8 md:p-10 shadow-sm ${theme.panelBg} ${theme.borderBase} flex flex-col items-center text-center gap-6`}>
        <div className={`absolute top-0 left-0 w-full h-2 ${theme.bgMd}`} />

        <div className="w-full flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-3">
            <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${theme.textBase}`}>
              {group.name}
            </h1>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${theme.bgMd} ${theme.textMuted}`}>
              <Users size={12} />
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </div>
          </div>

          <div className="flex flex-col items-center w-full gap-3 mt-2">
            <CopyInviteLink inviteCode={group.invite_code} />
            <div className={`flex items-center gap-2 ${theme.textMuted}`}>
              <span className="text-sm font-medium">Or use join code:</span>
              <span className={`px-3 py-1 rounded-md text-xs font-mono font-bold tracking-widest ${theme.bgMd} ${theme.textBase}`}>
                {group.invite_code}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          {profile?.id === group.owner_id 
            ? <DeleteGroupButton groupId={group.id} groupName={group.name} /> 
            : <LeaveGroupButton groupId={group.id} groupName={group.name} />
          }
        </div>
      </header>

      <section className="flex flex-col gap-8">
        <div className="relative flex flex-col md:flex-row items-center justify-center w-full">
          <h2 className={`text-3xl font-black uppercase tracking-wider ${theme.textBase}`}>Tournaments</h2>
        </div>

        {groupTournaments.length === 0 ? (
          <div className={`w-full p-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 ${theme.borderBase} ${theme.panelBg}`}>
            <div className="text-4xl opacity-50">🏆</div>
            <h3 className={`text-lg font-semibold ${theme.textBase}`}>No Tournaments Yet</h3>
            <p className={`max-w-md text-sm ${theme.textMuted}`}>
              {isAdmin ? "Create a tournament and assign it to this group." : "Wait for an admin to assign one."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col w-full gap-8">
            <div className={`grid grid-cols-1 ${(standardTournaments.length > 0 && survivorTournaments.length > 0) ? 'xl:grid-cols-2' : 'max-w-4xl mx-auto'} gap-8 items-start w-full`}>
              
              {standardTournaments.length > 0 && (
                <div className="flex flex-col gap-4 w-full">
                  {standardTournaments.map(t => (
                    <StandardTournamentCard 
                      key={t.id} 
                      tournament={t} 
                      isAdmin={isAdmin} 
                      onSelect={handleSelectTournament} 
                      timezone={profile?.timezone ?? null}
                      variant="full" 
                    />
                  ))}
                </div>
              )}

              {survivorTournaments.length > 0 && (
                <div className="flex flex-col gap-4 w-full">
                  {survivorTournaments.map(t => (
                    <SurvivorTournamentCard 
                      key={t.id} 
                      tournament={t} 
                      isAdmin={isAdmin} 
                      onSelect={handleSelectTournament} 
                      timezone={profile?.timezone ?? null}
                      variant="full" 
                    />
                  ))}
                </div>
              )}
              
            </div>

            <div className="flex justify-center w-full mt-2">
              <button
                onClick={() => ui.setActiveView('standings')}
                className={`group flex items-center justify-center gap-4 w-full max-w-lg px-6 py-5 rounded-2xl border ${theme.borderBase} ${theme.panelBg} hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all hover:border-amber-500/50 shadow-sm hover:shadow-md`}
              >
                <span className={`font-black uppercase tracking-widest text-base md:text-lg ${theme.textBase}`}>Go to Standings</span>
                <ArrowRight size={24} className={`${theme.textMuted} group-hover:text-amber-500 group-hover:translate-x-2 transition-all`} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}