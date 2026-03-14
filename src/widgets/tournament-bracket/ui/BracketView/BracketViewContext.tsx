// src/widgets/tournament-bracket/ui/BracketView/BracketViewContext.tsx
//
// FIX: allTournamentPicks is added to the context. This provides
// MatchupColumn access to all participants' picks for survivor tournaments
// so getIsEliminated can correctly evaluate the revive_all rule.
// The field is optional: it is only populated for revive_all survivor
// brackets. Standard brackets and readOnly snoop views receive undefined.

import { createContext, useContext, type ReactNode } from 'react'
import type { Game, Pick } from '../../../../shared/types'

export interface BracketViewContextValue {
  isLocked:            boolean
  readOnly:            boolean
  ownerName:           string | undefined
  onPick:              (game: Game, team: string) => void
  onSurvivorPick:      ((gameId: string, teamName: string | null, roundNum: number) => void) | undefined
  // All tournament participants' picks — used by MatchupColumn to evaluate
  // the revive_all elimination rule. Undefined for standard brackets and
  // readOnly contexts where revive_all is not applicable.
  allTournamentPicks:  Pick[] | undefined
}

const BracketViewContext = createContext<BracketViewContextValue | null>(null)

export function BracketViewProvider({
  children,
  ...value
}: { children: ReactNode } & BracketViewContextValue) {
  return (
    <BracketViewContext.Provider value={value}>
      {children}
    </BracketViewContext.Provider>
  )
}

export function useBracketView(): BracketViewContextValue {
  const ctx = useContext(BracketViewContext)
  if (!ctx) throw new Error('useBracketView() must be inside <BracketViewProvider>')
  return ctx
}