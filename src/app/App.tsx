import { useEffect } from 'react'
import { ErrorBoundary } from '../shared/ui'
import AppShell          from './AppShell'
import { useAuth, AuthForm } from '../features/auth'
import { useProfileQuery }   from '../entities/profile/model/queries'
import { ThemeCtx, THEMES }  from '../shared/lib/theme'
import { useStabilizedLoading } from '../shared/lib/useStabilizedLoading'

function AppLoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-500">
      {/* Fake Navbar */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between bg-white dark:bg-[#0a0e17] flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
          <div className="hidden md:flex gap-4">
            <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800/50 rounded-md animate-pulse" />
            <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800/50 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
      </div>

      {/* Fake Content */}
      <div className="flex-1 w-full p-4 md:p-8">
        <div className="max-w-7xl mx-auto w-full space-y-8">
          <div className="w-full h-[320px] rounded-[2rem] bg-slate-200 dark:bg-slate-800/40 animate-pulse border border-slate-300 dark:border-slate-800" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="w-full h-48 bg-slate-200 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
              <div className="w-full h-48 bg-slate-200 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
            </div>
            <div className="space-y-6 hidden lg:block">
              <div className="w-full h-64 bg-slate-200 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
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
  const showSkeleton = useStabilizedLoading(appLoading, 150)

  // ── 1. BULLETPROOF INVITE CAPTURE ──
  useEffect(() => {
    const url = new URL(window.location.href)
    
    // Check ?join=CODE or #/join/CODE
    const queryInvite = url.searchParams.get('join')
    const hashMatch   = url.hash.match(/#\/?join\/([^/?]+)/i)
    const code        = queryInvite || hashMatch?.[1]

    if (code) {
      console.log("📍 Invite captured:", code.toUpperCase())
      localStorage.setItem('tourneyhub-invite', code.toUpperCase())
      
      // CLEAN THE URL IMMEDIATELY
      // This removes the ?join and the #/join so the router doesn't get confused
      url.searchParams.delete('join')
      const cleanHash = url.hash.includes('join') ? '#/home' : url.hash
      window.history.replaceState({}, '', url.pathname + (url.search || '') + cleanHash)
    }
  }, [])

  useEffect(() => {
    if (profile?.ui_mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [profile?.ui_mode])

  if (showSkeleton) return <AppLoadingSkeleton />
  if (!user || !profile) return <AuthForm />

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