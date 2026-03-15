// src/widgets/tournament-bracket/ui/BracketView/BracketViewContext.tsx
//
// isTournamentOver added (this PR) — a data-derived boolean signalling
// that the entire survivor pool is dead via the end_early mass-elimination
// rule. Computed in BracketView/index.tsx from picks + games data, never
// from tournament.status, to avoid the admin-status-write false-lock bug.

import { createContext, useContext } from 'react'
import type { Game, Pick, ThemeConfig } from '../../../../shared/types'

interface BracketViewContextValue {
  isLocked:         boolean
  readOnly:         boolean
  ownerName?:       string
  onPick:           (game: Game, teamName: string) => void
  onSurvivorPick?:  (gameId: string, teamName: string | null, roundNum: number) => void
  allTournamentPicks?: Pick[]
  isTournamentOver: boolean
  showGameNumbers:  boolean
  theme:            ThemeConfig
}

const BracketViewContext = createContext<BracketViewContextValue | null>(null)

export function BracketViewProvider({
  children,
  ...value
}: React.PropsWithChildren<BracketViewContextValue>) {
  return (
    <BracketViewContext.Provider value={value}>
      {children}
    </BracketViewContext.Provider>
  )
}

export function useBracketView() {
  const ctx = useContext(BracketViewContext)
  if (!ctx) throw new Error('useBracketView must be inside BracketViewProvider')
  return ctx
}