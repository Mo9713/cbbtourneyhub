// src/features/tournament/AdminBuilderView/index.tsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTournamentContext } from '../TournamentContext'
import { useBracketContext }    from '../../bracket'
import { computeGameNumbers }   from '../../../shared/utils/bracketMath'
import { BD_REGIONS }           from '../../../shared/utils/helpers'
import { useQueryClient }       from '@tanstack/react-query'
import { tournamentKeys }       from '../queries'
import AdminHeader              from './AdminHeader'
import TournamentConfigPanel    from './TournamentConfigPanel'
import AdminBracketGrid         from './AdminBracketGrid'
import type { Game, Tournament } from '../../../shared/types'

interface Props {
  onDeleteGame:       (game: Game) => void
  onDeleteTournament: ()           => void
}

export default function AdminBuilderView({ onDeleteGame, onDeleteTournament }: Props) {
  // 1. Grab everything tournament-related from ONE hook
  const {
    selectedTournament: tournament,
    gamesCache,
    renameTournament,
    updateTournament,
    publishTournament,
    lockTournament,
  } = useTournamentContext()

  const games: Game[] = tournament ? (gamesCache[tournament.id] ?? []) : []

  // 2. Grab everything bracket.mutation-related from ONE hook
  const {
    updateGame,
    setWinner,
    addGameToRound,
    addNextRound,
    linkGames,
    unlinkGame,
  } = useBracketContext()

  const queryClient = useQueryClient()

  // ── UI state ─────────────────────────────────────────────────
  const [linkingFromId,  setLinkingFromId]  = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [draggedGameId,  setDraggedGameId]  = useState<string | null>(null)
  const [dragOverGameId, setDragOverGameId] = useState<string | null>(null)

  const gameNumbers = useMemo(() => computeGameNumbers(games), [games])
  const maxRound    = useMemo(() =>
    games.length ? Math.max(...games.map(g => g.round_num)) : 1, [games])

  const isBigDance = useMemo(() => games.some(g => g.region), [games])

  const publishValid = useMemo(() => {
    const nonChamp = games.filter(g => g.round_num < maxRound)
    return nonChamp.length === 0 || nonChamp.every(g => g.next_game_id)
  }, [games, maxRound])

  const displayGames = useMemo(() =>
    !isBigDance || !selectedRegion ? games : games.filter(g => g.region === selectedRegion),
    [games, isBigDance, selectedRegion]
  )

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach(g => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([r, gs]) => [r, gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))] as [number, Game[]])
  }, [displayGames])

  // Esc cancels an active link operation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLinkingFromId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Link handlers ─────────────────────────────────────────────
  const handleStartLink = useCallback((gameId: string) => {
    setLinkingFromId(prev => prev === gameId ? null : gameId)
  }, [])

  const handleCompleteLink = useCallback(async (
    toGameId: string,
    slot: 'team1_name' | 'team2_name',
  ) => {
    if (!linkingFromId || linkingFromId === toGameId) return
    const fromGame = games.find(g => g.id === linkingFromId)
    const toGame   = games.find(g => g.id === toGameId)
    if (!fromGame || !toGame || fromGame.round_num >= toGame.round_num) return
    await linkGames(linkingFromId, toGameId, slot)
    setLinkingFromId(null)
  }, [linkingFromId, games, linkGames])

  // ── Drag handlers ─────────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => setDraggedGameId(id), [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (id !== draggedGameId) setDragOverGameId(id)
  }, [draggedGameId])

  const handleDragEnd = useCallback(() => {
    setDraggedGameId(null); setDragOverGameId(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedGameId || draggedGameId === targetId) { handleDragEnd(); return }
    const dragged = games.find(g => g.id === draggedGameId)
    const target  = games.find(g => g.id === targetId)
    if (!dragged || !target || dragged.round_num !== target.round_num) { handleDragEnd(); return }

    const sorted = games
      .filter(g => g.round_num === dragged.round_num)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const fromIdx = sorted.findIndex(g => g.id === draggedGameId)
    const toIdx   = sorted.findIndex(g => g.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return }

    const reordered = [...sorted]
    const [removed] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, removed)
    await Promise.all(reordered.map((g, i) => updateGame(g.id, { sort_order: i })))
    handleDragEnd()
  }, [draggedGameId, games, updateGame, handleDragEnd])

  const handleReload = useCallback(() => {
    if (!tournament) return
    queryClient.invalidateQueries({ queryKey: tournamentKeys.games(tournament.id) })
    queryClient.invalidateQueries({ queryKey: tournamentKeys.all })
  }, [queryClient, tournament])

  if (!tournament) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/*
        FIX: Removed inline arrow wrappers around already-stable
        useCallback refs passed as props to AdminHeader and
        TournamentConfigPanel. Inline arrows create new function
        references on every render, defeating the useCallback
        stabilization on the receiving side and preventing React
        from bailing out of child re-renders.

        Before:  onRename={name => renameTournament(name)}
        After:   onRename={renameTournament}

        The onUpdate props retain their inline form because they
        include a legitimate `as Partial<Tournament>` type cast that
        cannot be collapsed without inspecting and potentially
        altering the AdminHeader / TournamentConfigPanel prop types —
        a separate, safe refactor.
      */}
      <AdminHeader
        tournament={tournament}
        games={games}
        publishValid={publishValid}
        onRename={renameTournament}
        onUpdate={upd  => updateTournament(upd as Partial<Tournament>)}
        onPublish={publishTournament}
        onLock={lockTournament}
        onAddNextRound={addNextRound}
        onReload={handleReload}
        onDeleteTournament={onDeleteTournament}
      />

      <TournamentConfigPanel
        tournament={tournament}
        games={games}
        onUpdate={upd => updateTournament(upd as Partial<Tournament>)}
      />

      {/* Big Dance region tabs */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-amber-500/10 flex-shrink-0 overflow-x-auto bg-slate-900/30">
          <button onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
              ${!selectedRegion ? 'border-amber-500 text-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            All
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r ? 'border-amber-500 text-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
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