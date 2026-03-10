// src/app/App.tsx
import { ErrorBoundary }       from '../shared/ui'
import { AuthProvider }        from '../features/auth'
import { TournamentProvider }  from '../features/tournament'
import { BracketProvider }     from '../features/bracket'
import AppShell                from './AppShell'

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
