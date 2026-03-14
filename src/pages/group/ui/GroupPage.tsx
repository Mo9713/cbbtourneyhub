// src/pages/group/ui/GroupPage.tsx

import { GroupDashboard } from '../../../widgets/group-dashboard'
import { useUIStore }     from '../../../shared/store/uiStore'
import { useTheme }       from '../../../shared/lib/theme'

export function GroupPage() {
  const theme = useTheme()
  const groupId = useUIStore(s => s.activeGroupId)

  if (!groupId) {
    return (
      <div className={`flex flex-col items-center justify-center w-full h-full min-h-screen ${theme.appBg}`}>
        <div className={`p-8 rounded-xl border text-center shadow-lg max-w-md w-full ${theme.panelBg} ${theme.borderBase}`}>
          <h1 className={`text-2xl font-bold mb-2 ${theme.textBase}`}>Group Not Found</h1>
          <p className={`${theme.textMuted} mb-6`}>
            The group URL is invalid or missing an ID.
          </p>
          <button 
            onClick={() => window.location.hash = '#/home'}
            className={`px-6 py-2 rounded-lg font-bold w-full transition-colors ${theme.btn}`}
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full min-h-screen overflow-y-auto ${theme.appBg}`}>
      <GroupDashboard groupId={groupId} />
    </div>
  )
}