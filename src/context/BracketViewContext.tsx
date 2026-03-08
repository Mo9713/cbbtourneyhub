// src/context/BracketViewContext.tsx
import { createContext, useContext, type ReactNode } from 'react'
import type { Game } from '../types'

export interface BracketViewContextValue {
  isLocked:  boolean
  readOnly:  boolean
  ownerName: string | undefined
  onPick:    (game: Game, team: string) => void
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