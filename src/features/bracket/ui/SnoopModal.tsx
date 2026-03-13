// src/features/bracket/ui/SnoopModal.tsx

import { useState, useMemo }         from 'react'
import { X, Trophy }                  from 'lucide-react'
import BracketView                   from './BracketView'
import { useLeaderboardRaw }         from '../../../entities/leaderboard/model/queries'
import { useTournamentListQuery }    from '../../../entities/tournament/model/queries'
import { useGames }                  from '../../../entities/tournament/model/queries'
import type { Game }                 from '../../../shared/types'

interface Props {
  targetId: string
  onClose:  () => void
}

export default function SnoopModal({ targetId, onClose }: Props) {
  const { data: raw }              = useLeaderboardRaw()
  const { data: tournaments = [] } = useTournamentListQuery()

  const targetProfile = useMemo(
    () => raw?.allProfiles.find((p) => p.id === targetId) ?? null,
    [raw, targetId],
  )

  const targetPicks = useMemo(
    () => raw?.allPicks.filter((p) => p.user_id === targetId) ?? [],
    [raw, targetId],
  )

  const visibleTournaments = useMemo(
    () => tournaments.filter((t) => t.status !== 'draft'),
    [tournaments],
  )

  const [selectedTid, setSelectedTid] = useState<string | null>(
    () =>
      visibleTournaments.find((t) => t.status !== 'draft')?.id ??
      visibleTournaments[0]?.id ??
      null,
  )

  const selectedTournament = useMemo(
    () => visibleTournaments.find((t) => t.id === selectedTid) ?? null,
    [visibleTournaments, selectedTid],
  )

  // Replaces gamesCache[selectedTid] — lazy on-demand load from entity layer.
  // TanStack Query deduplicates: if BracketView already fetched these games
  // for the same tid, this is a cache hit with no network request.
  const { data: selectedGames = [] } = useGames(selectedTid)

  const selectedPicks = useMemo(
    () => targetPicks.filter((p) => selectedGames.some((g: Game) => g.id === p.game_id)),
    [targetPicks, selectedGames],
  )

  const isLoading = !raw || !targetProfile

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <Trophy size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Viewing: {targetProfile?.display_name ?? 'User'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-all text-xs font-bold"
          >
            <X size={14} /> Close
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading bracket data…
          </div>
        ) : (
          <>
            {/* Tournament tabs */}
            <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto scrollbar-thin bg-slate-950/30">
              {visibleTournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTid(t.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                    ${selectedTid === t.id
                      ? 'text-white border-white bg-white/5'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                    }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Bracket content */}
            <div className="flex-1 overflow-auto scrollbar-thin">
              {selectedTournament ? (
                <BracketView
                  overrideTournament={selectedTournament}
                  overrideGames={selectedGames}
                  overridePicks={selectedPicks}
                  readOnly
                  ownerName={targetProfile.display_name}
                />
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                  No tournament selected.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}