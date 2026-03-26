import React, { useState, useMemo, useCallback } from 'react'
import { useQueryClient }                 from '@tanstack/react-query'

import {
  useGames,
  useUpdateTournamentMutation,
  usePublishTournamentMutation,
  useLockTournamentMutation,
  useCompleteTournamentMutation,
  useDeleteTournamentMutation,
  useTournamentListQuery,
  usePatchGamesCache,
  tournamentKeys,
}                                       from '../../../../entities/tournament/model/queries'
import { computeGameNumbers }           from '../../../../shared/lib/bracketMath'
import { BD_REGIONS }                   from '../../../../shared/lib/helpers'
import { useUIStore }                   from '../../../../shared/store/uiStore'
import * as gameService                 from '../../../../entities/tournament/api/gameService'

import AdminHeader            from './AdminHeader'
import TournamentConfigPanel  from './TournamentConfigPanel'
import { AdminBracketGrid }   from '../../../admin-bracket-grid'
import type { Game, Tournament } from '../../../../shared/types'

export default function AdminBuilderView() {
  const qc = useQueryClient()
  const { setConfirmModal, pushToast } = useUIStore()

  const { data: tournaments = [] } = useTournamentListQuery()
  const selectedTournamentId       = useUIStore((s) => s.selectedTournamentId)

  const tournament = useMemo(
    () => tournaments.find((t: Tournament) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  )

  const { data: games = [] } = useGames(tournament?.id ?? null)
  const patchGamesCache      = usePatchGamesCache()

  const updateTournamentM   = useUpdateTournamentMutation()
  const publishTournamentM  = usePublishTournamentMutation()
  const lockTournamentM     = useLockTournamentMutation()
  const completeTournamentM = useCompleteTournamentMutation()
  const deleteTournamentM   = useDeleteTournamentMutation()

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

  const handleCompleteTournament = useCallback(() => {
    if (!tournament) return
    setConfirmModal({
      title:        'Mark as Finished',
      message:      `Mark "${tournament.name}" as finished? This will display a permanent "Finished" badge for all participants. The tournament can still be viewed but picks are permanently locked.`,
      confirmLabel: 'Mark as Finished',
      dangerous:    false,
      onCancel:  () => setConfirmModal(null),
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await completeTournamentM.mutateAsync(tournament.id)
          pushToast(`"${tournament.name}" marked as finished.`, 'success')
        } catch (err) {
          pushToast(err instanceof Error ? err.message : 'Failed to complete tournament.', 'error')
        }
      },
    })
  }, [tournament, completeTournamentM, setConfirmModal, pushToast])

  const handleDeleteTournament = useCallback(() => {
    if (!tournament) return
    const gameIds = games.map((g: Game) => g.id)
    setConfirmModal({
      title:        'Delete Tournament',
      message:      `Permanently delete "${tournament.name}" and all its games?`,
      dangerous:    true,
      confirmLabel: 'Delete',
      onCancel:  () => setConfirmModal(null),
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await deleteTournamentM.mutateAsync({ id: tournament.id, gameIds })
        } catch (err) {
          pushToast(err instanceof Error ? err.message : 'Delete failed.', 'error')
        }
      },
    })
  }, [tournament, games, deleteTournamentM, setConfirmModal, pushToast])

  const updateGame = useCallback(async (id: string, updates: Partial<Game>): Promise<string | null> => {
    const tid = tournament?.id
    if (!tid) return 'No tournament selected'
    const result = await gameService.updateGame(id, updates)
    if (!result.ok) return result.error
    patchGamesCache(tid, (prev) => prev.map((g: Game) => g.id === id ? { ...g, ...updates } : g))
    return null
  }, [tournament?.id, patchGamesCache])

  const setWinner = useCallback(async (game: Game, winner: string): Promise<string | null> => {
    const tid = tournament?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(games)
    const result   = await gameService.setWinner(game, winner, games, gameNums)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [tournament?.id, games, qc])

  const addGameToRound = useCallback(async (round: number): Promise<string | null> => {
    const tid = tournament?.id
    if (!tid) return 'No tournament selected'
    const roundGames = games.filter((g: Game) => g.round_num === round)
    const maxSort = roundGames.length > 0 ? Math.max(...roundGames.map((g: Game) => g.sort_order ?? 0)) : -1
    const result = await gameService.addGameToRound(tid, round, maxSort + 1)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [tournament?.id, games, qc])

  const addNextRound = useCallback(async (): Promise<string | null> => {
    const tid = tournament?.id
    if (!tid) return 'No tournament selected'
    const maxRound = games.length
      ? Math.max(...games.map((g: Game) => g.round_num))
      : 0
    const result = await gameService.addGameToRound(tid, maxRound + 1, 0)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [tournament?.id, games, qc])

  const handleDeleteGame = useCallback(async (game: Game): Promise<string | null> => {
    const tid = tournament?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(games)
    const result = await gameService.deleteGame(game, games, gameNums)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [tournament?.id, games, qc])

  const handleUnlinkGame = useCallback(async (gameId: string): Promise<string | null> => {
    const tid = tournament?.id
    if (!tid) return 'No tournament selected'
    const gameToUnlink = games.find((g: Game) => g.id === gameId)
    if (!gameToUnlink) return 'Game not found'

    const gameNums = computeGameNumbers(games)
    const result = await gameService.unlinkGame(gameToUnlink, games, gameNums)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [tournament?.id, games, qc])

  const [linkingFromId, setLinkingFromId] = useState<string | null>(null)

  const handleStartLink = useCallback((gameId: string) => {
    setLinkingFromId(gameId)
  }, [])

  const handleCompleteLink = useCallback(async (targetId: string) => {
    if (!linkingFromId || linkingFromId === targetId) { setLinkingFromId(null); return }
    const tid = tournament?.id
    if (!tid) return

    const fromGame = games.find((g: Game) => g.id === linkingFromId)
    if (!fromGame) return

    const gameNums = computeGameNumbers(games)
    const fromGameNumber = gameNums[fromGame.id] ?? 0

    const feeders = games
      .filter((g: Game) => g.next_game_id === targetId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    // FIX A-04: Prevents silent overwrite corruption if an admin accidentally points 3 games into one
    if (feeders.length >= 2) {
      pushToast('This game already has two feeders. Unlink one first.', 'error')
      setLinkingFromId(null)
      return
    }

    const slot = feeders.length > 0 ? 'team2_name' : 'team1_name'

    const result = await gameService.linkGames(fromGame, targetId, slot, fromGameNumber, games, gameNums)

    if (!result.ok) {
      pushToast(result.error, 'error')
    } else {
      void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    }
    setLinkingFromId(null)
  }, [linkingFromId, games, tournament?.id, pushToast, qc])

  const [draggedGameId, setDraggedGameId] = useState<string | null>(null)
  const [dragOverGameId, setDragOverGameId] = useState<string | null>(null)

  const handleDragStart = useCallback((gameId: string) => setDraggedGameId(gameId), [])
  
  const handleDragOver = useCallback((e: React.DragEvent, gameId: string) => {
    e.preventDefault()
    setDragOverGameId(gameId)
  }, [])
  
  const handleDragEnd = useCallback(() => { 
    setDraggedGameId(null)
    setDragOverGameId(null) 
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      if (!draggedGameId || draggedGameId === targetId) { handleDragEnd(); return }
      const dragRound = games.find((g: Game) => g.id === draggedGameId)?.round_num
      const dropRound = games.find((g: Game) => g.id === targetId)?.round_num
      if (dragRound !== dropRound) { handleDragEnd(); return }

      const sorted   = games
        .filter((g: Game) => g.round_num === dragRound)
        .sort((a: Game, b: Game) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const fromIdx  = sorted.findIndex((g: Game) => g.id === draggedGameId)
      const toIdx    = sorted.findIndex((g: Game) => g.id === targetId)
      if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return }

      const reordered = [...sorted]
      const [removed] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, removed)
      await Promise.all(reordered.map((g: Game, i: number) => updateGame(g.id, { sort_order: i })))
      handleDragEnd()
    },
    [draggedGameId, games, updateGame, handleDragEnd],
  )

  const maxRound     = games.length ? Math.max(...games.map((g: Game) => g.round_num)) : 0
  const gameNumbers  = useMemo(() => computeGameNumbers(games), [games])
  const isBigDance   = useMemo(() => games.some((g: Game) => g.region), [games])
  const publishValid = useMemo(() => {
    const nonFinals = games.filter((g: Game) => !!g.next_game_id)
    return nonFinals.length === 0 || nonFinals.every((g: Game) => !!g.next_game_id)
  }, [games])

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    for (const g of games) {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [games])

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const handleReload = useCallback(() => {
    if (!tournament) return
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tournament.id) })
    void qc.invalidateQueries({ queryKey: tournamentKeys.all })
  }, [qc, tournament])

  if (!tournament) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AdminHeader
        tournament={tournament}
        publishValid={publishValid}
        onRename={renameTournament}
        onUpdate={(upd) => updateTournament(upd as Partial<Tournament>)}
        onPublish={publishTournament}
        onLock={lockTournament}
        onComplete={handleCompleteTournament}
        onAddNextRound={addNextRound}
        onReload={handleReload}
        onDeleteTournament={handleDeleteTournament}
      />

      <TournamentConfigPanel
        tournament={tournament}
        games={games}
        onUpdate={(upd) => updateTournament(upd as Partial<Tournament>)}
      />

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
        onDeleteGame={handleDeleteGame}
        onAddGameToRound={addGameToRound}
        onUnlinkGame={handleUnlinkGame}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
      />
    </div>
  )
}