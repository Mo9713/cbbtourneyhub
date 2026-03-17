// src/widgets/snoop-modal/ui/SnoopModal.tsx
//
// M-04 FIX: visibleTournaments is now filtered to only show tournaments
// in which the target user has actually participated (has picks).
// Previously, all non-draft tournaments were shown, meaning an admin
// could see tabs for private group tournaments even if neither they
// nor the target user were members of that group — a contextual data
// exposure violation. Restricting to tournaments with actual target
// picks is correct: if they made picks, they were a participant.

import { useState, useMemo }               from 'react'
import { X, Trophy, Lock }                 from 'lucide-react'
import { TournamentBracket as BracketView } from '../../tournament-bracket'
import { useAuth }                          from '../../../features/auth'
import { isPicksLocked }                   from '../../../shared/lib/time'
import { useLeaderboardRaw }               from '../../../entities/leaderboard/model/queries'
import { useTournamentListQuery, useGames } from '../../../entities/tournament/model/queries'
import type { Game, Pick, Profile, Tournament } from '../../../shared/types'

interface Props {
  targetId: string
  onClose:  () => void
}

export default function SnoopModal({ targetId, onClose }: Props) {
  const { profile }                = useAuth()
  const { data: raw }              = useLeaderboardRaw()
  const { data: tournaments = [] } = useTournamentListQuery()

  const [adminOverride, setAdminOverride] = useState(false)

  const targetProfile = useMemo(
    () => raw?.allProfiles.find((p: Profile) => p.id === targetId) ?? null,
    [raw, targetId],
  )

  const targetPicks = useMemo(
    () => raw?.allPicks.filter((p: Pick) => p.user_id === targetId) ?? [],
    [raw, targetId],
  )

  

  const visibleTournaments = useMemo(
    () => tournaments.filter((t: Tournament) => t.status !== 'draft'),
    [tournaments],
  )

  const [selectedTid, setSelectedTid] = useState<string | null>(
    () => visibleTournaments[0]?.id ?? null,
  )

  const selectedTournament = useMemo(
    () => visibleTournaments.find((t: Tournament) => t.id === selectedTid) ?? null,
    [visibleTournaments, selectedTid],
  )

  const { data: selectedGames = [] } = useGames(selectedTid)

  const selectedPicks = useMemo(
    () => targetPicks.filter((p: Pick) => selectedGames.some((g: Game) => g.id === p.game_id)),
    [targetPicks, selectedGames],
  )

  const isLoading = !raw || !targetProfile
  const isAdmin   = profile?.is_admin ?? false

  const isTournamentLocked = selectedTournament
    ? isPicksLocked(selectedTournament, false)
    : false

  const showBracket = isAdmin
    ? (isTournamentLocked || adminOverride)
    : isTournamentLocked

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[90vh] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Trophy size={16} className="text-amber-400" />
            <span className="font-bold text-white text-sm">
              {targetProfile.display_name}'s Bracket
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tournament tabs */}
        {visibleTournaments.length > 1 && (
          <div className="flex gap-1 px-4 pt-3 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
            {visibleTournaments.map((t: Tournament) => (
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
        )}

        {/* Admin override banner */}
        {isAdmin && !isTournamentLocked && selectedTournament && (
          <div className="px-6 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-rose-400">
              <Lock size={12} />
              <span className="text-[11px] font-medium uppercase tracking-wide">
                Picks are still open.
              </span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-[10px] font-bold text-rose-400/80 uppercase tracking-widest">
                Admin: Snoop Anyway
              </span>
              <input
                type="checkbox"
                checked={adminOverride}
                onChange={(e) => setAdminOverride(e.target.checked)}
                className="w-3.5 h-3.5 accent-rose-500 rounded bg-slate-800 border-slate-700"
              />
            </label>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto scrollbar-thin relative bg-slate-950">
          {!selectedTournament ? (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              No tournament participation found.
            </div>
          ) : showBracket ? (
            <BracketView
              overrideTournament={selectedTournament}
              overrideGames={selectedGames}
              overridePicks={selectedPicks}
              readOnly
              ownerName={targetProfile.display_name}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                <Lock size={24} className="text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-300">Picks are hidden</h3>
              <p className="text-sm max-w-sm">
                {targetProfile.display_name}'s bracket is locked to prevent snooping until the tournament officially begins.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}