import { useState, useMemo, useEffect } from 'react'
import { X, Trophy, Lock, ShieldAlert } from 'lucide-react'
import { TournamentBracket as BracketView } from '../../tournament-bracket'
import { useAuth } from '../../../features/auth'
import { isPicksLocked } from '../../../shared/lib/time'
import { useLeaderboardRaw } from '../../../entities/leaderboard/model/queries'
import { useTournamentListQuery, useGames } from '../../../entities/tournament/model/queries'
import type { Game, Pick, Profile, Tournament } from '../../../shared/types'

interface Props {
  targetId: string
  initialTid?: string | null // ── NEW PROP ──
  onClose:  () => void
}

export default function SnoopModal({ targetId, initialTid, onClose }: Props) {
  const { profile } = useAuth()
  const { data: raw } = useLeaderboardRaw()
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

  // ── SMART TAB SELECTION ──
  // If initialTid is passed and valid, use it. Otherwise fallback to the first available.
  const [selectedTid, setSelectedTid] = useState<string | null>(null)

  useEffect(() => {
    if (visibleTournaments.length > 0 && !selectedTid) {
      const preferred = visibleTournaments.find(t => t.id === initialTid)
      setSelectedTid(preferred ? preferred.id : visibleTournaments[0].id)
    }
  }, [visibleTournaments, initialTid, selectedTid])

  const selectedTournament = useMemo(
    () => visibleTournaments.find((t: Tournament) => t.id === selectedTid) ?? null,
    [visibleTournaments, selectedTid],
  )

  const { data: selectedGames = [] } = useGames(selectedTid)

  const selectedPicks = useMemo(
    () => targetPicks.filter((p: Pick) => selectedGames.some((g: Game) => g.id === p.game_id)),
    [targetPicks, selectedGames],
  )

  const isLoading = !raw || !targetProfile || !selectedTid
  const isAdmin   = profile?.is_admin ?? false

  const isTournamentLocked = selectedTournament
    ? isPicksLocked(selectedTournament, false)
    : false

  const showBracket = isAdmin
    ? (isTournamentLocked || adminOverride)
    : isTournamentLocked

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    // ── TRUE FULLSCREEN TAKEOVER ──
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-in fade-in zoom-in-95 duration-200">
      
      {/* ── Premium Header ── */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-900 bg-black flex-shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Trophy size={20} className="text-amber-500" />
          </div>
          <div>
            <span className="font-display font-black text-white text-2xl uppercase tracking-wide flex items-center gap-2">
              {targetProfile.display_name}'s Bracket
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Snooping Mode
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-3 rounded-full bg-slate-900 border border-slate-800 hover:bg-rose-500 hover:border-rose-500 hover:text-white text-slate-400 transition-all shadow-sm"
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Tournament Tabs (Pill Style) ── */}
      {visibleTournaments.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-4 bg-slate-950 border-b border-slate-900 flex-shrink-0 overflow-x-auto scrollbar-none">
          {visibleTournaments.map((t: Tournament) => (
            <button
              key={t.id}
              onClick={() => setSelectedTid(t.id)}
              className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-full transition-all flex-shrink-0 ${
                selectedTid === t.id
                  ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Admin Override Banner ── */}
      {isAdmin && !isTournamentLocked && selectedTournament && (
        <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 text-rose-400">
            <ShieldAlert size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              Live Picks — God Mode Active
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-rose-500 transition-colors">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
              Force Reveal
            </span>
            <input
              type="checkbox"
              checked={adminOverride}
              onChange={(e) => setAdminOverride(e.target.checked)}
              className="w-4 h-4 accent-rose-500 rounded bg-slate-800 border-slate-700"
            />
          </label>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 overflow-auto scrollbar-thin relative bg-[#0a0e17]">
        {!selectedTournament ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <Trophy size={48} className="opacity-20" />
            <span className="text-sm font-bold uppercase tracking-widest">No active bracket</span>
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
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-6 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 rounded-full bg-slate-900/50 border border-slate-800 flex items-center justify-center mb-4">
              <Lock size={40} className="text-slate-600" />
            </div>
            <h3 className="text-2xl font-display font-black text-white uppercase tracking-wider">Top Secret</h3>
            <p className="text-sm font-medium text-slate-400 max-w-md leading-relaxed">
              {targetProfile.display_name}'s bracket is locked in the vault to prevent snooping. It will automatically unlock the second the first game tips off.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}