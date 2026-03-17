import { useMemo, useState } from 'react'
import { Trophy, BarChart3, ChevronDown, Users } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'
import { useAuth } from '../../../features/auth'
import { useUIStore } from '../../../shared/store/uiStore'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import { useUserGroupsQuery, useGroupMembersQuery } from '../../../entities/group'
import { useLeaderboardRaw } from '../../../entities/leaderboard/model/queries'
import { selectGroupLeaderboards } from '../../../features/leaderboard/model/selectors'
import { StandardStandingsTable, SurvivorStandingsTable } from '../../../features/leaderboard'

export default function StandingsPage() {
  const theme = useTheme()
  const { profile } = useAuth()
  const ui = useUIStore()
  
  // Local state for tabs
  const [activeTab, setActiveTab] = useState<'bracket' | 'survivor'>('bracket')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: tournaments = [], isLoading: isLoadingTourneys } = useTournamentListQuery()
  const { data: groups = [] } = useUserGroupsQuery()
  const { data: rawData, isLoading: isLoadingBoard } = useLeaderboardRaw()
  
  // Use the active group (fallback to first group if somehow null)
  const effectiveGroupId = ui.activeGroupId || (groups.length > 0 ? groups[0].id : null)
  const { data: members = [] } = useGroupMembersQuery(effectiveGroupId || '')

  const isAdmin = profile?.is_admin ?? false
  const isMe = (userId: string) => userId === profile?.id

  const activeGroupName = groups.find(g => g.id === effectiveGroupId)?.name || 'Unknown Group'

  // Filter tournaments strictly for this group
  const groupTournaments = useMemo(() => 
    tournaments.filter(t => t.group_id === effectiveGroupId && (isAdmin || t.status !== 'draft')),
  [tournaments, effectiveGroupId, isAdmin])

  // Process the leaderboards specifically for this group's members
  const boards = useMemo(() => {
    if (!rawData || !effectiveGroupId) return { standard: [], survivor: [] }
    return selectGroupLeaderboards(rawData, groupTournaments, members)
  }, [rawData, groupTournaments, members, effectiveGroupId])

  // Ensure tab makes sense based on available data
  const hasStandard = boards.standard.length > 0
  const hasSurvivor = boards.survivor.length > 0

  if (isLoadingTourneys || isLoadingBoard) {
    return (
      <div className={`flex items-center justify-center w-full h-full p-8 ${theme.textMuted}`}>
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin border-amber-500" />
      </div>
    )
  }

  if (!effectiveGroupId) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-8 ${theme.appBg}`}>
        <div className={`flex flex-col items-center text-center max-w-md p-10 rounded-3xl border shadow-xl ${theme.panelBg} ${theme.borderBase}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${theme.bgMd}`}>
            <Users size={40} className={theme.accent} />
          </div>
          <h1 className={`text-2xl font-display font-black uppercase tracking-wider mb-3 ${theme.textBase}`}>No Groups Found</h1>
          <p className={`text-sm font-medium ${theme.textMuted}`}>
            You need to join or create a group to view standings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 ${theme.appBg}`}>
      <div className="max-w-5xl mx-auto w-full space-y-6 pb-12">
        
        {/* ── Header & Group Selector ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme.bgMd}`}>
                <BarChart3 size={20} className={theme.accent} />
              </div>
              <h1 className={`text-3xl md:text-4xl font-display font-extrabold uppercase tracking-tight ${theme.textBase}`}>
                Group Standings
              </h1>
            </div>
          </div>

          {/* Group Dropdown */}
          {groups.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${theme.panelBg} ${theme.borderBase} hover:border-amber-500/50 shadow-sm`}
              >
                <Users size={16} className={theme.textMuted} />
                <span className={`font-bold text-sm ${theme.textBase}`}>{activeGroupName}</span>
                <ChevronDown size={16} className={`${theme.textMuted} transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-xl z-50 overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
                  {groups.map((g: any) => (
                    <button
                      key={g.id}
                      onClick={() => { ui.setActiveGroup(g.id); setDropdownOpen(false) }}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all ${effectiveGroupId === g.id ? `${theme.bgMd} ${theme.accent}` : `${theme.textBase} hover:bg-slate-100 dark:hover:bg-slate-800`}`}
                    >
                      <Users size={16} /> {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {groupTournaments.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-3xl ${theme.borderBase} ${theme.panelBg}`}>
            <Trophy size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className={`text-lg font-bold mb-1 ${theme.textBase}`}>No Active Tournaments</h3>
            <p className={`text-sm max-w-sm ${theme.textMuted}`}>This group doesn't have any active brackets yet.</p>
          </div>
        ) : (
          <div className={`flex flex-col rounded-3xl border shadow-sm overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
            
            {/* ── Tailwind Underline Tabs ── */}
            <div className="border-b border-slate-200 dark:border-slate-800 px-6">
              <nav className="-mb-px flex gap-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('bracket')}
                  disabled={!hasStandard}
                  className={`whitespace-nowrap py-4 border-b-2 font-bold text-sm transition-colors ${
                    activeTab === 'bracket'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-500'
                      : !hasStandard 
                        ? 'border-transparent text-slate-300 dark:text-slate-700 cursor-not-allowed'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Bracket
                </button>
                <button
                  onClick={() => setActiveTab('survivor')}
                  disabled={!hasSurvivor}
                  className={`whitespace-nowrap py-4 border-b-2 font-bold text-sm transition-colors ${
                    activeTab === 'survivor'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-500'
                      : !hasSurvivor
                        ? 'border-transparent text-slate-300 dark:text-slate-700 cursor-not-allowed'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Survivor
                </button>
              </nav>
            </div>

            {/* ── Tab Content ── */}
            <div className="p-6 md:p-8">
              {activeTab === 'bracket' && hasStandard && (
                <div className="w-full">
                  <StandardStandingsTable
                    title="Bracket Leaderboard"
                    board={boards.standard}
                    isMe={isMe}
                    isAdmin={isAdmin}
                    showTiebreaker={groupTournaments.some(t => t.game_type !== 'survivor' && t.requires_tiebreaker === true)}
                    variant="full"
                  />
                </div>
              )}

              {activeTab === 'survivor' && hasSurvivor && (
                <div className="w-full">
                  <SurvivorStandingsTable
                    title="Survivor Leaderboard"
                    board={boards.survivor}
                    isMe={isMe}
                    isAdmin={isAdmin}
                    variant="full"
                  />
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}