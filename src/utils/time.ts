// src/utils/time.ts
import type { Tournament } from '../types'

export function getCSTDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
}

export function isPicksLocked(tournament: Tournament, isAdmin = false): boolean {
  if (isAdmin) return false
  if (tournament.status === 'draft' || tournament.status === 'locked') return true
  if (tournament.locks_at) {
    const now = getCSTDate()
    const locksAt = new Date(
      new Date(tournament.locks_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })
    )
    if (now >= locksAt) return true
  }
  return false
}

export function formatCSTDisplay(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' CT'
}

export function isoToInputCST(iso: string | null): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function cstInputToISO(local: string): string | null {
  if (!local) return null
  const isDST = new Date(local).toLocaleString('en-US', {
    timeZone: 'America/Chicago', timeZoneName: 'short',
  }).includes('CDT')
  return new Date(`${local}:00${isDST ? '-05:00' : '-06:00'}`).toISOString()
}