// src/features/tournament/AdminBuilderView/index.tsx

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQueryClient }   from '@tanstack/react-query'

import { useTournamentContext }          from '../model/TournamentContext'
import { useBracketContext }             from '../../bracket'
import {
  useGames,
  useUpdateTournamentMutation,
  usePublishTournamentMutation,
  useLockTournamentMutation,
  tournamentKeys,
}                                        from '../../../entities/tournament/model/queries'
import { computeGameNumbers }            from '../../../shared/lib/bracketMath'
import { BD_REGIONS }                    from '../../../shared/lib/helpers'

import AdminHeader            from './AdminHeader'
import TournamentConfigPanel  from './TournamentConfigPanel'
import AdminBracketGrid       from '../../bracket/ui/AdminBracketGrid'
import type { Game, Tournament } from '../../../shared/types'

interface Props {
  onDeleteGame:       (game: Game) => void
  onDeleteTournament: ()           => void
}

export default function AdminBuilderView({ onDeleteGame, onDeleteTournament }: Props) {
  const queryClient = useQueryClient()

  // ── Tournament data ───────────────────────────────────────
  const { selectedTournament: tournament } = useTournamentContext()

  // Lazy on-demand game loading — replaces gamesCache[tournament.id]
  const { data: games = [] } = useGames(tournament?.id ?? null)

  // ── Mutation hooks from entity layer ─────────────────────
  const updateTournamentM  = useUpdateTournamentMutation()
  const publishTournamentM = usePublishTournamentMutation()
  const lockTournamentM    = useLockTournamentMutation()

  // Adapters that match the (string | void) → void prop signature
  // expected by AdminHeader and TournamentConfigPanel.
  const renameTournament = useCallback(async (newName: string): Promise<void> => {
    if (!tournament) return
    await updateTournamentM.mutateAsync({ id: tournament.id, updates: { name: newName } })
  }, [tournament, updateTournamentM])

  const updateTournament = useCallback(async (updates: Partial<Tournament>): Promise<void> => {
    if (!tournament) return
    await updateTournamentM.mutateAsync({ id: tournament.id, updates })
  }, [tournament, updateTournamentM])

  const publishTournament = useCallback(async (): Promise<void> => {
    if (!tournament) return
    await publishTournamentM.mutateAsync(tournament.id)
  }, [tournament, publishTournamentM])

  const lockTournament = useCallback(async (): Promise<void> => {
    if (!tournament) return
    await lockTournamentM.mutateAsync(tournament.id)
  }, [tournament, lockTournamentM])

  // ── Bracket mutations (unchanged) ────────────────────────
  const {
    updateGame,
    setWinner,
    addGameToRound,
    addNextRound,
    linkGames,
    unlinkGame,
  } = useBracketContext()

  // ── UI state ─────────────────────────────────────────────
  const [linkingFromId,  setLinkingFromId]  = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [draggedGameId,  setDraggedGameId]  = useState<string | null>(null)
  const [dragOverGameId, setDragOverGameId] = useState<string | null>(null)

  const gameNumbers = useMemo(() => computeGameNumbers(games), [games])
  const maxRound    = useMemo(
    () => (games.length ? Math.max(...games.map((g) => g.round_num)) : 1),
    [games],
  )
  const isBigDance = useMemo(() => games.some((g) => g.region), [games])

  const publishValid = useMemo(() => {
    const nonChamp = games.filter((g) => g.round_num < maxRound)
    return nonChamp.length === 0 || nonChamp.every((g) => g.next_game_id)
  }, [games, maxRound])

  const displayGames = useMemo(
    () => (!isBigDance || !selectedRegion ? games : games.filter((g) => g.region === selectedRegion)),
    [games, isBigDance, selectedRegion],
  )

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach((g) => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([r, gs]) => [r, gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))] as [number, Game[]])
  }, [displayGames])

  // ── ESC cancel link ───────────────────────────────────────
  useEffect(() => {
    if (!linkingFromId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLinkingFromId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [linkingFromId])

  // ── Link handlers ─────────────────────────────────────────
  const handleStartLink    = useCallback((id: string) => setLinkingFromId(id), [])
  const handleCompleteLink = useCallback(async (
    toId: string, slot: 'team1_name' | 'team2_name',
  ) => {
    if (!linkingFromId) return
    await linkGames(linkingFromId, toId, slot)
    setLinkingFromId(null)
  }, [linkingFromId, linkGames])

  // ── Drag handlers ─────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => setDraggedGameId(id),   [])
  const handleDragOver  = useCallback((id: string) => setDragOverGameId(id),  [])
  const handleDragEnd   = useCallback(() => { setDraggedGameId(null); setDragOverGameId(null) }, [])

  const handleDrop = useCallback(async (targetId: string) => {
    if (!draggedGameId) return
    const roundNum = games.find((g) => g.id === draggedGameId)?.round_num
    const sorted   = games
      .filter((g) => g.round_num === roundNum)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const fromIdx  = sorted.findIndex((g) => g.id === draggedGameId)
    const toIdx    = sorted.findIndex((g) => g.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return }

    const reordered      = [...sorted]
    const [removed]      = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, removed)
    await Promise.all(reordered.map((g, i) => updateGame(g.id, { sort_order: i })))
    handleDragEnd()
  }, [draggedGameId, games, updateGame, handleDragEnd])

  // ── Reload ────────────────────────────────────────────────
  const handleReload = useCallback(() => {
    if (!tournament) return
    void queryClient.invalidateQueries({ queryKey: tournamentKeys.games(tournament.id) })
    void queryClient.invalidateQueries({ queryKey: tournamentKeys.all })
  }, [queryClient, tournament])

  if (!tournament) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AdminHeader
        tournament={tournament}
        games={games}
        publishValid={publishValid}
        onRename={renameTournament}
        onUpdate={(upd) => updateTournament(upd as Partial<Tournament>)}
        onPublish={publishTournament}
        onLock={lockTournament}
        onAddNextRound={addNextRound}
        onReload={handleReload}
        onDeleteTournament={onDeleteTournament}
      />

      <TournamentConfigPanel
        tournament={tournament}
        games={games}
        onUpdate={(upd) => updateTournament(upd as Partial<Tournament>)}
      />

      {/* Big Dance region tabs */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-amber-500/10 flex-shrink-0 overflow-x-auto bg-slate-900/30">
          <button
            onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
              ${!selectedRegion
                ? 'border-amber-500 text-amber-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
          >
            All
          </button>
          {BD_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r
                  ? 'border-amber-500 text-amber-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <AdminBracketGrid
        tournament={tournament}
        games={games}
        rounds={rounds}
        gameNumbers={gameNumbers}
        maxRound={maxRound}
        linkingFromId={linkingFromId}
        dragOverGameId={dragOverGameId}
        onStartLink={handleStartLink}
        onCompleteLink={handleCompleteLink}
        onCancelLink={() => setLinkingFromId(null)}
        onUpdateGame={updateGame}
        onSetWinner={setWinner}
        onDeleteGame={onDeleteGame}
        onAddGameToRound={addGameToRound}
        onUnlinkGame={unlinkGame}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
      />
    </div>
  )
}