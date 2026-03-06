// src/utils/helpers.tsx
import React from 'react'
import { Globe, Edit3, Lock } from 'lucide-react'
import type { Game, TournamentStatus } from '../types'

export function fibonacci(n: number): number {
  if (n <= 0) return 0
  if (n === 1 || n === 2) return 1
  let a = 1, b = 1
  for (let i = 3; i <= n; i++) { const c = a + b; a = b; b = c }
  return b
}

export const getScore = (r: number) => fibonacci(r + 1)

export function getRoundLabel(roundNum: number, maxRound: number): string {
  const gap = maxRound - roundNum
  if (gap === 0) return 'Championship'
  if (gap === 1) return 'Semifinals'
  if (gap === 2) return 'Quarterfinals'
  if (roundNum === 1) return 'First Round'
  if (roundNum === 2) return 'Second Round'
  return `Round ${roundNum}`
}

export const isTBDName = (n: string) =>
  !n || n === 'TBD' || n === 'BYE' || n.startsWith('Winner of Game')

export const statusDot = (s: TournamentStatus) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'

export const statusLabel = (s: TournamentStatus) =>
  s === 'open' ? 'Open' : s === 'draft' ? 'Draft' : 'Locked'

export function statusIcon(s: TournamentStatus): React.ReactNode {
  if (s === 'open')  return <Globe size={11} className="text-emerald-400" />
  if (s === 'draft') return <Edit3 size={11} className="text-amber-400" />
  return               <Lock  size={11} className="text-slate-500" />
}

export function computeGameNumbers(games: Game[]): Record<string, number> {
  const sorted = [...games].sort((a, b) =>
    a.round_num !== b.round_num ? a.round_num - b.round_num : a.id.localeCompare(b.id)
  )
  const map: Record<string, number> = {}
  sorted.forEach((g, i) => { map[g.id] = i + 1 })
  return map
}

export const BD_REGIONS = ['East', 'West', 'South', 'Midwest', 'Final Four']