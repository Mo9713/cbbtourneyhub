// src/features/bracket/SnoopModal.tsx
import { useState, useMemo }       from 'react'
import { X, ShieldAlert }          from 'lucide-react'
import BracketView                 from './BracketView'
import { useLeaderboardRaw }       from '../../leaderboard'
import { useTournamentList,
         useTournamentContext }    from '../../tournament'

interface Props {
  targetId: string
  onClose:  () => void
}

export default function SnoopModal({ targetId, onClose }: Props) {
  const { data: raw }        = useLeaderboardRaw()
  const { tournaments }      = useTournamentList()
  const { gamesCache }       = useTournamentContext()

  const targetProfile = useMemo(
    () => raw?.allProfiles.find(p => p.id === targetId) ?? null,
    [raw, targetId],
  )

  const targetPicks = useMemo(
    () => raw?.allPicks.filter(p => p.user_id === targetId) ?? [],
    [raw, targetId],
  )

  const visibleTournaments = useMemo(
    () => tournaments.filter(t => t.status !== 'draft'),
    [tournaments],
  )

  const [selectedTid, setSelectedTid] = useState<string | null>(
    () => visibleTournaments.find(t => t.status !== 'draft')?.id
       ?? visibleTournaments[0]?.id
       ?? null,
  )

  const selectedTournament = useMemo(
    () => visibleTournaments.find(t => t.id === selectedTid) ?? null,
    [visibleTournaments, selectedTid],
  )

  const selectedGames = useMemo(
    () => selectedTid ? (gamesCache[selectedTid] ?? []) : [],
    [selectedTid, gamesCache],
  )

  const selectedPicks = useMemo(
    () => targetPicks.filter(p => selectedGames.some(g => g.id === p.game_id)),
    [targetPicks, selectedGames],
  )

  const isLoading = !raw || !targetProfile

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-violet-900/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sleek Admin Header */}
        <div className="px-5 py-3 border-b border-violet-500/20 flex items-center justify-between bg-violet-900/20 flex-shrink-0">
          <div className="flex items-center gap-2 text-violet-400">
            <ShieldAlert size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Admin Snoop Mode</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all text-xs font-bold"
          >
            <X size={14} /> Close
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading bracket data…
          </div>
        ) : (
          <>
            {/* Tournament tabs */}
            <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto bg-slate-900/50">
              {visibleTournaments.map(t => (
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

            {/* Bracket content */}
            <div className="flex-1 overflow-auto">
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