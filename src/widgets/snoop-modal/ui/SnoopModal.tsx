// src/widgets/snoop-modal/ui/SnoopModal.tsx

import { useState, useMemo, useEffect } from 'react'
import { X, Trophy, Lock, ShieldAlert, Check, Ban } from 'lucide-react'
import { TournamentBracket as BracketView } from '../../tournament-bracket'
import { useAuth } from '../../../features/auth'
import { isPicksLocked, getActiveSurvivorRound } from '../../../shared/lib/time'
import { useTheme } from '../../../shared/lib/theme'
import { isTeamMatch } from '../../../shared/lib/bracketMath'
import { useLeaderboardRaw } from '../../../entities/leaderboard/model/queries'
import { useTournamentListQuery, useGames } from '../../../entities/tournament/model/queries'
import { useMakeSurvivorPickMutation } from '../../../features/survivor'
import type { Game, Pick, Profile, Tournament } from '../../../shared/types'

interface Props {
  targetId: string
  initialTid?: string | null
  onClose:  () => void
}

export default function SnoopModal({ targetId, initialTid, onClose }: Props) {
  const theme = useTheme()
  const { profile } = useAuth()
  const { data: raw } = useLeaderboardRaw()
  const { data: tournaments = [] } = useTournamentListQuery()

  const pickMutation = useMakeSurvivorPickMutation()

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
  const isSurvivor = selectedTournament?.game_type === 'survivor'

  const activeRound = selectedTournament ? getActiveSurvivorRound(selectedTournament) : 0
  const maxRound = selectedGames.length ? Math.max(...selectedGames.map(g => g.round_num)) : 6
  const allRounds = Array.from({ length: maxRound }, (_, i) => i + 1)
  const tournamentGameIds = useMemo(() => selectedGames.map(g => g.id), [selectedGames])

  const isTournamentLocked = selectedTournament
    ? isPicksLocked(selectedTournament, false)
    : false

  const showBracketContent = isAdmin
    ? (isTournamentLocked || adminOverride || isSurvivor)
    : (isTournamentLocked || isSurvivor)

  // ── 1. HARDWARE ESCAPE KEY ──
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // ── 2. THE BROWSER BACK BUTTON (FAKE HISTORY STEP) ──
  useEffect(() => {
    window.history.pushState({ snoopModalOpen: true }, '')

    const handlePopState = () => {
      onClose()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (window.history.state?.snoopModalOpen) {
        window.history.back()
      }
    }
  }, [onClose])

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-amber-500 animate-spin" />
      </div>
    )
  }

  return (
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
      {isAdmin && selectedTournament && (
        <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 text-rose-400">
            <ShieldAlert size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              Live Picks — God Mode Active
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-rose-500 transition-colors">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
              Force Reveal / Edit
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
        ) : !showBracketContent ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-6 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 rounded-full bg-slate-900/50 border border-slate-800 flex items-center justify-center mb-4">
              <Lock size={40} className="text-slate-600" />
            </div>
            <h3 className="text-2xl font-display font-black text-white uppercase tracking-wider">Top Secret</h3>
            <p className="text-sm font-medium text-slate-400 max-w-md leading-relaxed">
              {targetProfile.display_name}'s bracket is locked in the vault to prevent snooping. It will automatically unlock the second the first game tips off.
            </p>
          </div>
        ) : isSurvivor ? (
          /* ── SURVIVOR GRID LIST LAYOUT ── */
          <div className="p-4 md:p-8 max-w-4xl mx-auto w-full pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {allRounds.map(r => {
                const roundName = selectedTournament.round_names?.[r - 1]?.trim() || `Round ${r}`
                const roundGames = selectedGames.filter(g => g.round_num === r)
                
                if (roundGames.length === 0) return null

                // Look for a pick made by the user in this round
                const pick = selectedPicks.find(p => p.round_num === r || roundGames.some(g => g.id === p.game_id))
                const pickedGame = pick ? roundGames.find(g => g.id === pick.game_id) : null

                let predictedName = null
                let isWinner = false
                let isLoser = false

                if (pickedGame && pick) {
                  predictedName = pick.predicted_winner === 'team1' ? pickedGame.team1_name :
                                  pick.predicted_winner === 'team2' ? pickedGame.team2_name :
                                  pick.predicted_winner

                  if (pickedGame.actual_winner) {
                    isWinner = isTeamMatch(predictedName, pickedGame.actual_winner)
                    isLoser = !isWinner
                  }
                }

                const isSecret = !adminOverride && activeRound > 0 && r >= activeRound

                return (
                  <div key={r} className={`flex flex-col p-5 rounded-2xl border shadow-sm ${theme.panelBg} ${theme.borderBase}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted} mb-3`}>
                      {roundName} Pick
                    </span>
                    
                    {adminOverride ? (
                      /* ── ADMIN OVERRIDE DROPDOWN ── */
                      <select
                        value={pick ? `${pick.game_id}|${pick.predicted_winner}` : ""}
                        onChange={(e) => {
                          const val = e.target.value
                          const roundGameIds = roundGames.map(g => g.id)
                          
                          if (!val) {
                            // Clear pick
                            const prevGameId = pick?.game_id || roundGames[0].id
                            pickMutation.mutate({ 
                              tournamentId: selectedTournament.id, 
                              gameId: prevGameId, 
                              predictedWinner: null, 
                              roundNum: r, 
                              tournamentGameIds, 
                              roundGameIds,
                              overrideUserId: targetId 
                            })
                          } else {
                            // Save pick
                            const [gId, slot] = val.split('|')
                            pickMutation.mutate({ 
                              tournamentId: selectedTournament.id, 
                              gameId: gId, 
                              predictedWinner: slot, 
                              roundNum: r, 
                              tournamentGameIds, 
                              roundGameIds,
                              overrideUserId: targetId 
                            })
                          }
                        }}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-xl p-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500 appearance-none"
                      >
                        <option value="">-- No Pick --</option>
                        {roundGames.flatMap(g => [
                          { gameId: g.id, slot: 'team1', name: g.team1_name },
                          { gameId: g.id, slot: 'team2', name: g.team2_name }
                        ])
                        .filter(t => t.name && t.name !== 'TBD' && !t.name.includes('Winner of'))
                        .map(t => (
                          <option key={`${t.gameId}|${t.slot}`} value={`${t.gameId}|${t.slot}`}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      /* ── STANDARD READ-ONLY VIEW ── */
                      <div className="flex items-center justify-between">
                        <span className={`text-2xl font-black truncate pr-4 ${
                          isSecret ? 'italic opacity-30 text-slate-500' : 
                          isWinner ? 'text-emerald-500' : 
                          isLoser ? 'text-rose-500 line-through decoration-rose-500 decoration-2' : 
                          theme.textBase
                        }`}>
                          {isSecret ? 'Hidden' : (predictedName || 'No pick')}
                        </span>
                        
                        {!isSecret && pick && (
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${
                            isWinner ? 'bg-emerald-500/10' :
                            isLoser ? 'bg-rose-500/10' :
                            'bg-amber-500/10'
                          }`}>
                            {isWinner && <Check size={20} className="text-emerald-500" />}
                            {isLoser && <Ban size={20} className="text-rose-500" />}
                            {!isWinner && !isLoser && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── STANDARD BRACKET VIEW ── */
          <BracketView
            overrideTournament={selectedTournament}
            overrideGames={selectedGames}
            overridePicks={selectedPicks}
            overrideUserId={targetId}
            readOnly={!adminOverride}
            adminOverride={adminOverride}
            ownerName={targetProfile.display_name}
          />
        )}
      </div>
    </div>
  )
}