// src/widgets/group-dashboard/ui/GroupDashboard.tsx
import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { useGroupDetailsQuery, useGroupMembersQuery } from '../../../entities/group'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useLeaderboardRaw } from '../../../entities/leaderboard/model/queries'
import { selectGroupLeaderboards } from '../../../features/leaderboard/model/selectors'
import { useTheme } from '../../../shared/lib/theme'
import { useAuth } from '../../../features/auth'
import { useUIStore } from '../../../shared/store/uiStore'
import { StandardStandingsTable, SurvivorStandingsTable } from '../../../features/leaderboard'
import { CopyInviteLink, DeleteGroupButton, LeaveGroupButton } from '../../../features/group-management'
import { StandardTournamentCard, SurvivorTournamentCard } from '../../../entities/tournament'
import type { Tournament } from '../../../shared/types'

export function GroupDashboard({ groupId }: { groupId: string }) {
  const theme = useTheme()
  const { profile } = useAuth()
  const ui = useUIStore()
  
  const { data: group, isLoading } = useGroupDetailsQuery(groupId)
  const { data: members = [] } = useGroupMembersQuery(groupId)
  const { data: tournaments = [] } = useTournamentListQuery()
  const { data: rawData } = useLeaderboardRaw()

  const isAdmin = profile?.is_admin ?? false
  const groupTournaments = tournaments.filter((t: Tournament) => t.group_id === groupId && (isAdmin || t.status !== 'draft'))
  
  const boards = useMemo(() => 
    selectGroupLeaderboards(rawData, groupTournaments, members), 
    [rawData, groupTournaments, members]
  )

  const isMe = (userId: string) => userId === profile?.id

  const handleSelectTournament = (t: Tournament) => {
    ui.selectTournament(t.id)
    ui.setActiveView('bracket')
  }

  if (isLoading || !group) {
    return (
      <div className={`flex items-center justify-center w-full h-full p-8 ${theme.textMuted}`}>
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin border-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8 gap-8">
      
      {/* ── Header ── */}
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

      {/* ── Tournaments & Standings ── */}
      <section className="flex flex-col gap-6">
        <div className="relative flex flex-col md:flex-row items-center justify-center w-full mb-2">
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
          <div className={`grid grid-cols-1 ${(boards.standard.length > 0 && boards.survivor.length > 0) ? 'xl:grid-cols-2' : 'max-w-4xl mx-auto'} gap-8 items-start w-full`}>

            {boards.standard.length > 0 && (
              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col gap-4">
                  {groupTournaments.filter(t => t.game_type !== 'survivor').map(t => (
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
                <StandardStandingsTable
                  title="Bracket Standings"
                  board={boards.standard}
                  isMe={isMe}
                  isAdmin={isAdmin}
                  showTiebreaker={groupTournaments.some(t => t.game_type !== 'survivor' && t.requires_tiebreaker === true)}
                  variant="compact"
                />
              </div>
            )}

            {boards.survivor.length > 0 && (
              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col gap-4">
                  {groupTournaments.filter(t => t.game_type === 'survivor').map(t => (
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
                <SurvivorStandingsTable
                  title="Survivor Standings"
                  board={boards.survivor}
                  isMe={isMe}
                  isAdmin={isAdmin}
                  variant="compact"
                />
              </div>
            )}

          </div>
        )}
      </section>
    </div>
  )
}