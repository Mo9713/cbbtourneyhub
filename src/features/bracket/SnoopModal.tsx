// src/features/bracket/SnoopModal.tsx
import { useState, useMemo }       from 'react'
import { X }                       from 'lucide-react'
import BracketView                 from './BracketView'
import { useLeaderboardRaw }       from '../leaderboard'
import { useTournamentList,
         useTournamentContext }    from '../tournament'

// FIX:
//
// Previously SnoopModal received `targetProfile: Profile`, `tournaments`,
// `gamesCache`, and `allPicks` as props — all of which were sourced from
// AppShell, which called `useLeaderboardRaw()` unconditionally on every
// cold start to supply this data. That triggered 3 parallel Supabase
// queries (SELECT * FROM picks, games, profiles) for every user on every
// page load, even though SnoopModal is only ever opened by admins and
// most users never interact with it.
//
// Fix: SnoopModal is now fully self-contained. It pulls its own data via
// hooks that are only mounted when the modal actually renders. React Query
// deduplication ensures that if LeaderboardView is simultaneously open,
// only one in-flight request is made. AppShell is no longer a data relay
// for leaderboard data and no longer calls useLeaderboardRaw().
//
// The prop interface shrinks to just the target user's ID (sufficient to
// look up the Profile and Picks internally) and the close handler.

interface Props {
  /** ID of the user whose bracket we are viewing. */
  targetId: string
  onClose:  () => void
}

export default function SnoopModal({ targetId, onClose }: Props) {
  // These hooks are only executed when the modal is mounted (i.e. when an
  // admin actually opens a snoop view). They are never called on boot.
  const { data: raw }        = useLeaderboardRaw()
  const { tournaments }      = useTournamentList()
  const { gamesCache }       = useTournamentContext()

  // Resolve the target profile from the leaderboard cache.
  const targetProfile = useMemo(
    () => raw?.allProfiles.find(p => p.id === targetId) ?? null,
    [raw, targetId],
  )

  // All picks belonging to the target user.
  const targetPicks = useMemo(
    () => raw?.allPicks.filter(p => p.user_id === targetId) ?? [],
    [raw, targetId],
  )

  // Visible tournament tabs — exclude drafts so admins don't accidentally
  // expose unpublished brackets while snooping.
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

  // While leaderboard data loads, show a minimal spinner inside the modal
  // shell rather than blocking the render entirely. The BracketView
  // handles an empty picks array gracefully in read-only mode.
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
        {/* Header */}
        <div className="px-5 py-3 border-b border-violet-500/20 flex items-center justify-between bg-violet-500/5 flex-shrink-0">
          <span className="font-display text-lg font-bold text-white uppercase tracking-wide">
            {isLoading ? 'Loading…' : `Snooping: ${targetProfile.display_name}`}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X size={16} />
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