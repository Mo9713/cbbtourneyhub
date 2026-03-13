// src/widgets/group-dashboard/ui/GroupDashboard.tsx

import { useGroupDetailsQuery } from '../../../entities/group'
import { useTheme }             from '../../../shared/lib/theme'

interface GroupDashboardProps {
  groupId: string
}

export function GroupDashboard({ groupId }: GroupDashboardProps) {
  const theme = useTheme()
  const { data: group, isLoading, error } = useGroupDetailsQuery(groupId)

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
      {/* Group Header */}
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
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${theme.borderBase} ${theme.textBase}`}>
              Group Hub
            </span>
          </div>
        </div>
      </header>

      {/* Tournaments Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className={`text-2xl font-bold ${theme.textBase}`}>Tournaments</h2>
          <button className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-transform hover:scale-105 ${theme.btn}`}>
            + New Tournament
          </button>
        </div>
        
        {/* Placeholder for Tournament List Widget */}
        <div className={`w-full p-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 ${theme.borderBase} ${theme.panelBg}`}>
          <div className={`text-4xl opacity-50`}>🏆</div>
          <h3 className={`text-lg font-semibold ${theme.textBase}`}>No Tournaments Yet</h3>
          <p className={`max-w-md text-sm ${theme.textMuted}`}>
            This group doesn't have any active tournaments. Create a Bracket or Survivor pool to get started.
          </p>
        </div>
      </section>
    </div>
  )
}