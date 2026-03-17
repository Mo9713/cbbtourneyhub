import { useState, useEffect } from 'react'
import { Pin } from 'lucide-react'
import type { Group } from '../../../shared/types'

// ── Shared Hook for Pin State ──
export function usePinnedGroups(groups: Group[]) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tourneyhub-pins')
      if (stored) setPinnedIds(JSON.parse(stored))
    } catch (e) {
      console.error('Failed to parse pins from local storage', e)
    }
  }, [])

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      localStorage.setItem('tourneyhub-pins', JSON.stringify(next))
      return next
    })
  }

  const pinnedGroups   = groups.filter(g => pinnedIds.includes(g.id))
  const unpinnedGroups = groups.filter(g => !pinnedIds.includes(g.id))

  return { pinnedIds, togglePin, pinnedGroups, unpinnedGroups }
}

// ── The Feature Button UI ──
interface Props {
  groupId: string
  isPinned: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
}

export function PinGroupButton({ groupId, isPinned, onToggle }: Props) {
  return (
    <button 
      onClick={(e) => onToggle(groupId, e)} 
      className={`absolute top-4 right-4 p-2 rounded-xl transition-all z-20 ${
        isPinned 
          ? 'text-amber-500 bg-amber-500/10' 
          : 'text-slate-400 opacity-0 group-hover/grpitem:opacity-100 hover:bg-white/50 dark:hover:bg-black/20 hover:text-amber-500'
      }`}
      title={isPinned ? "Unpin Group" : "Pin Group"}
    >
      <Pin size={16} className={isPinned ? "fill-amber-500" : ""} />
    </button>
  )
}