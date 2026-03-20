// src/widgets/tournament-bracket/ui/BracketView/BracketViewContext.tsx

import { createContext, useContext } from 'react'
import type { Game, Pick, ThemeConfig } from '../../../../shared/types'

interface BracketViewContextValue {
  isLocked:         boolean
  readOnly:         boolean
  adminOverride?:   boolean
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