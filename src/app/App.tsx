//src/app/App.tsx
import { useEffect } from 'react'
import { ErrorBoundary } from '../shared/ui'
import AppShell          from './AppShell'
import { useAuth, AuthForm } from '../features/auth'
import { useProfileQuery }   from '../entities/profile/model/queries'
import { ThemeCtx, THEMES }  from '../shared/lib/theme'
import { useStabilizedLoading } from '../shared/lib/useStabilizedLoading'

function AppLoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Fake Navbar */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between bg-white dark:bg-[#0a0e17] flex-shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
          <div className="hidden md:flex gap-4">
            <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800/50 rounded-md animate-pulse" />
            <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800/50 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
      </div>

      {/* Fake Home Page Content */}
      <div className="flex-1 w-full p-4 md:p-8 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full space-y-8">
          <div className="w-full h-[320px] rounded-[2rem] bg-slate-200 dark:bg-slate-800/40 animate-pulse border border-slate-300 dark:border-slate-800" />
          
          <div className="flex gap-3 md:gap-4 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 w-32 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800/40 animate-pulse flex-shrink-0 border border-slate-300 dark:border-slate-800" />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="w-48 h-8 bg-slate-200 dark:bg-slate-800/40 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[180px] bg-slate-200 dark:bg-slate-800/40 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
                ))}
              </div>
            </div>
            
            <div className="space-y-8 hidden lg:block">
              <div className="w-40 h-8 bg-slate-200 dark:bg-slate-800/40 rounded-lg animate-pulse" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800/40 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RootOrchestrator() {
  const { user, appLoading } = useAuth()
  const { data: profile } = useProfileQuery(user?.id)

  const showSkeleton = useStabilizedLoading(appLoading, 400)

  useEffect(() => {
    const hash = window.location.hash
    const joinMatch = hash.match(/#\/?join\/([^/?]+)/)
    if (joinMatch && joinMatch[1]) {
      localStorage.setItem('tourneyhub-invite', joinMatch[1].toUpperCase())
    }
  }, [])

  useEffect(() => {
    if (profile?.ui_mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [profile?.ui_mode])

  if (showSkeleton) {
    return <AppLoadingSkeleton />
  }

  if (!user || !profile) {
    return <AuthForm />
  }

  const currentTheme = THEMES[profile.theme as keyof typeof THEMES] || THEMES.ember

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