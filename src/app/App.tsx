// src/app/App.tsx
import { ErrorBoundary } from '../shared/ui'
import AppShell          from './AppShell'

// Note: QueryClientProvider already wraps this in main.tsx
export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}