// src/widgets/mobile-fab/ui/MobileFab.tsx
import { useState } from 'react'
import { Plus, UserPlus, Users } from 'lucide-react'

interface Props {
  isAdmin: boolean
  openJoinGroup: () => void
  openCreateGroup: () => void
  openAddTournament: () => void
}

export function MobileFab({ isAdmin, openJoinGroup, openCreateGroup, openAddTournament }: Props) {
  const [fabOpen, setFabOpen] = useState(false)

  return (
    <div className="sm:hidden fixed bottom-6 right-6 flex flex-col items-end z-50">
      <div className={`flex flex-col gap-3 mb-4 transition-all duration-300 origin-bottom ${fabOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        <button onClick={() => { setFabOpen(false); openJoinGroup() }} className="flex items-center gap-3 bg-indigo-500 text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-sm">
          Join Group <UserPlus size={16} />
        </button>
        {isAdmin && (
          <>
            <button onClick={() => { setFabOpen(false); openCreateGroup() }} className="flex items-center justify-end gap-3 bg-amber-500 text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-sm">
              Create Group <Users size={16} />
            </button>
            <button onClick={() => { setFabOpen(false); openAddTournament() }} className="flex items-center justify-end gap-3 bg-emerald-500 text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-sm">
              New Bracket <Plus size={16} />
            </button>
          </>
        )}
      </div>
      <button 
        onClick={() => setFabOpen(!fabOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${fabOpen ? 'bg-slate-800 text-white rotate-45' : 'bg-amber-500 text-white'}`}
      >
        <Plus size={28} />
      </button>
    </div>
  )
}