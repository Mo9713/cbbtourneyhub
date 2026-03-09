// src.App.tsx Composition Root
import { ErrorBoundary }       from './shared/components'
import { AuthProvider }        from './features/auth'
import { TournamentProvider }  from './features/tournament'
import { BracketProvider }     from './features/bracket'
import AppShell                from './components/AppShell'

// Note: QueryClientProvider already wraps this in main.tsx
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TournamentProvider>
          <BracketProvider>
            <AppShell />
          </BracketProvider>
        </TournamentProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
