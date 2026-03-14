// src/pages/settings/ui/SettingsPage.tsx

import { useAuth, SettingsView } from '../../../features/auth'
import { useUIStore } from '../../../shared/store/uiStore'

export function SettingsPage() {
  const { profile, user, setProfile } = useAuth()
  const pushToast = useUIStore(s => s.pushToast)

  if (!profile) return null

  return (
    <SettingsView
      profile={profile}
      userEmail={user?.email ?? ''}
      onProfileUpdate={setProfile}
      push={pushToast}
    />
  )
}