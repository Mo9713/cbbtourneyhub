import type { Tournament, Group } from '../../../shared/types'

export interface NextDeadline {
  time: number
  name: string
}

export function selectNextDeadline(tournaments: Tournament[]): NextDeadline | null {
  let earliestTime = Infinity
  let earliestName = ''
  const now = Date.now()

  tournaments.forEach(t => {
    if (t.status !== 'open') return
    if (t.game_type === 'survivor' && t.round_locks) {
      Object.values(t.round_locks).forEach(lock => {
        const time = new Date(lock).getTime()
        if (time > now && time < earliestTime) {
          earliestTime = time
          earliestName = `${t.name} (Survivor)`
        }
      })
    } else if (t.locks_at) {
      const time = new Date(t.locks_at).getTime()
      if (time > now && time < earliestTime) {
        earliestTime = time
        earliestName = `${t.name} (Bracket)`
      }
    }
  })
  return earliestTime === Infinity ? null : { time: earliestTime, name: earliestName }
}

export function getEffectiveStatus(t: Tournament, now: number): Tournament['status'] {
  if (t.status !== 'open') return t.status 
  if (t.game_type === 'survivor' && t.round_locks) {
    const hasFutureRound = Object.values(t.round_locks).some(lock => new Date(lock).getTime() > now)
    if (!hasFutureRound && Object.keys(t.round_locks).length > 0) return 'locked'
  } else if (t.locks_at) {
    if (new Date(t.locks_at).getTime() <= now) return 'locked'
  }
  return 'open'
}

export function selectSidebarData(allTournaments: Tournament[], allGroups: Group[], pinnedIds: string[]) {
  return {
    pinnedGroups: allGroups.filter(g => pinnedIds.includes(g.id)),
    unpinnedGroups: allGroups.filter(g => !pinnedIds.includes(g.id)),
    globalTournaments: allTournaments.filter(t => !t.group_id)
  }
}