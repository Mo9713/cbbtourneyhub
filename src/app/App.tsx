// src/app/App.tsx
import { useEffect } from 'react'
import { ErrorBoundary } from '../shared/ui'
import AppShell          from './AppShell'
import { useAuth, AuthForm } from '../features/auth'
import { useProfileQuery }   from '../entities/profile/model/queries'
import { ThemeCtx, THEMES }  from '../shared/lib/theme'

function RootOrchestrator() {
  const { user, appLoading } = useAuth()
  
  // Explicitly subscribe to the profile cache to trigger instant re-renders
  // when a theme or UI mode mutation updates the query data.
  const { data: profile } = useProfileQuery(user?.id)

  // 1. Tailwind Dark Mode Controller
  useEffect(() => {
    if (profile?.ui_mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [profile?.ui_mode])

  // 2. Global Loading State
  if (appLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 3. The Login Gatekeeper
  if (!user || !profile) {
    return <AuthForm />
  }

  // 4. Resolve the Active Theme
  const currentTheme = THEMES[profile.theme as keyof typeof THEMES] || THEMES.ember

  // 5. Render the Authenticated App with the Theme Provider!
  return (
    <ThemeCtx.Provider value={currentTheme}>
      <AppShell />
    </ThemeCtx.Provider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <RootOrchestrator />
    </ErrorBoundary>
  )
}