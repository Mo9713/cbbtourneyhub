// src/components/SnoopModal.tsx
import { useState, useMemo } from 'react'
import BracketView from '../views/BracketView'
import type { Profile, Tournament, Game, Pick } from '../types'

interface Props {
  targetProfile: Profile
  tournaments:   Tournament[]
  allGames:      Game[]
  allPicks:      Pick[]
  onClose:       () => void
}

export default function SnoopModal({ targetProfile, tournaments, allGames, allPicks, onClose }: Props) {
  const [selectedTid, setSelectedTid] = useState<string | null>(
    tournaments.find(t => t.status !== 'draft')?.id ?? tournaments[0]?.id ?? null
  )

  const targetPicks = useMemo(() =>
    allPicks.filter(p => p.user_id === targetProfile.id),
    [allPicks, targetProfile.id]
  )

  const gamesByTournament = useMemo(() => {
    const map: Record<string, Game[]> = {}
    allGames.forEach(g => {
      if (!map[g.tournament_id]) map[g.tournament_id] = []
      map[g.tournament_id].push(g)
    })
    return map
  }, [allGames])

  const selectedTournament = tournaments.find(t => t.id === selectedTid)
  const selectedGames      = selectedTid ? (gamesByTournament[selectedTid] ?? []) : []
  const selectedPicks      = targetPicks.filter(p => selectedGames.some(g => g.id === p.game_id))

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col shadow-2xl shadow-violet-900/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-violet-500/20 flex items-center justify-between bg-violet-500/5 flex-shrink-0">
          <span className="font-display text-lg font-bold text-white uppercase tracking-wide">
            Snooping: {targetProfile.display_name}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tournament tabs */}
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto bg-slate-900/50">
          {tournaments.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTid(t.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedTid === t.id
                  ? 'text-violet-400 border-violet-500 bg-violet-500/10'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Bracket */}
        <div className="flex-1 overflow-auto">
          {selectedTournament ? (
            <BracketView
              tournament={selectedTournament}
              games={selectedGames}
              picks={selectedPicks}
              profile={targetProfile}
              onPick={() => {}}
              readOnly
              ownerName={targetProfile.display_name}
            />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              No tournament selected.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}