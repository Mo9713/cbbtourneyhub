// src/views/BracketView/index.tsx
import { useState, useMemo } from 'react'
import { useTheme }            from '../../utils/theme'
import { isPicksLocked }       from '../../utils/time'
import { computeGameNumbers }  from '../../utils/bracketMath'
import { isTBDName, BD_REGIONS, getRoundLabel, statusLabel, statusIcon } from '../../utils/helpers'
import { useAuthContext }       from '../../context/AuthContext'
import { useTournamentContext } from '../../context/TournamentContext'
import { useBracketContext }    from '../../context/BracketContext'
import GameCard                 from '../../components/GameCard'
import BracketHeader            from './BracketHeader'
import BracketGrid              from './BracketGrid'
import ChampionCallout          from './ChampionCallout'
import TiebreakerPanel          from './TiebreakerPanel'
import type { Game, Pick, Tournament } from '../../types'

interface BracketViewProps {
  /** When true: read-only snoop mode. Provided externally by SnoopModal. */
  readOnly?:  boolean
  ownerName?: string
  /** Override data for snoop mode — SnoopModal injects the target user's picks. */
  overridePicks?:      Pick[]
  overrideTournament?: Tournament
  overrideGames?:      Game[]
}

export default function BracketView({
  readOnly     = false,
  ownerName,
  overridePicks,
  overrideTournament,
  overrideGames,
}: BracketViewProps) {
  const theme   = useTheme()
  const { profile }                          = useAuthContext()
  const { selectedTournament, gamesCache }   = useTournamentContext()
  const { picks: contextPicks, makePick }    = useBracketContext()

  // Snoop mode uses injected data; normal mode uses context data
  const tournament = overrideTournament ?? selectedTournament
  const games      = overrideGames ?? (tournament ? (gamesCache[tournament.id] ?? []) : [])
  const picks      = overridePicks ?? contextPicks

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  if (!tournament || !profile) return null

  const isLocked   = isPicksLocked(tournament, profile.is_admin) || tournament.status === 'draft'
  const isBigDance = games.some(g => g.region)

  const gameNumbers = useMemo(() => computeGameNumbers(games), [games])

  // ── effectiveNames: propagate picks/winners into downstream slots ─
  const effectiveNames = useMemo(() => {
    const names: Record<string, { team1: string; team2: string }> = {}
    games.forEach(g => { names[g.id] = { team1: g.team1_name, team2: g.team2_name } })

    const pickMap = new Map(picks.map(p => [p.game_id, p.predicted_winner]))
    const sorted  = [...games].sort((a, b) =>
      a.round_num !== b.round_num ? a.round_num - b.round_num : (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )

    for (const game of sorted) {
      if (!game.next_game_id) continue

      const currentTeam1 = names[game.id]?.team1 ?? game.team1_name
      const currentTeam2 = names[game.id]?.team2 ?? game.team2_name
      const slotsAreReal = !isTBDName(currentTeam1) && !isTBDName(currentTeam2)

      let userPick = pickMap.get(game.id)
      
      // GHOST PICK FIX: Ignore the pick if it doesn't match the advancing teams!
      if (userPick && userPick !== currentTeam1 && userPick !== currentTeam2) {
        userPick = undefined
      }

      const winner = game.actual_winner ?? (slotsAreReal ? userPick : undefined)
      if (!winner) continue

      const nextGame = games.find(g => g.id === game.next_game_id)
      if (!nextGame) continue

      const winnerText = `Winner of Game #${gameNumbers[game.id]}`

      // PRIMARY: slot text match
      if (nextGame.team1_name === winnerText || (game.actual_winner && nextGame.team1_name === game.actual_winner)) {
        names[nextGame.id] = { ...names[nextGame.id], team1: winner }
      } else if (nextGame.team2_name === winnerText || (game.actual_winner && nextGame.team2_name === game.actual_winner)) {
        names[nextGame.id] = { ...names[nextGame.id], team2: winner }
      } else {
        // FALLBACK: sort_order index
        const feeders = games
          .filter(g => g.next_game_id === game.next_game_id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
        if (feeders[0]?.id === game.id) names[nextGame.id] = { ...names[nextGame.id], team1: winner }
        else                             names[nextGame.id] = { ...names[nextGame.id], team2: winner }
      }
    }
    return names
  }, [games, picks, gameNumbers])

  // ── Champion derivation ─────────────────────────────
  const maxRound = games.length ? Math.max(...games.map(g => g.round_num)) : 1
  const champion = useMemo((): string | null => {
    const champGame = games.find(g => g.round_num === maxRound && !g.next_game_id)
                   ?? games.find(g => g.round_num === maxRound)
    if (!champGame) return null
    if (champGame.actual_winner) return champGame.actual_winner
    
    // Get the actual names currently sitting in the final game card
    const currentTeam1 = effectiveNames[champGame.id]?.team1 ?? champGame.team1_name
    const currentTeam2 = effectiveNames[champGame.id]?.team2 ?? champGame.team2_name
    const pick = picks.find(p => p.game_id === champGame.id)?.predicted_winner
    
    // Strict gate: user must explicitly pick one of the valid advancing teams
    if (pick && (pick === currentTeam1 || pick === currentTeam2)) return pick
    return null
  }, [games, picks, maxRound, effectiveNames])

  const champGame = games.find(g => g.round_num === maxRound && !g.next_game_id)
                 ?? games.find(g => g.round_num === maxRound)

  const champPick  = champGame ? picks.find(p => p.game_id === champGame.id) ?? null : null
  const pickedCount = picks.length
  const totalGames  = games.length

  // Rounds for the current region (or all, for non-BigDance)
  const displayGames = useMemo(() => {
    if (!isBigDance || !selectedRegion) return games
    return games.filter(g => g.region === selectedRegion)
  }, [games, isBigDance, selectedRegion])

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach(g => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, gs]) => [round, gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))] as [number, Game[]])
  }, [displayGames])

  const handlePick = async (game: Game, team: string) => {
    if (readOnly || isLocked) return
    await makePick(game, team)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BracketHeader
        tournament={tournament}
        pickedCount={pickedCount}
        totalGames={totalGames}
        readOnly={readOnly}
        ownerName={ownerName}
      />

      {/* Big Dance region tabs */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
              ${!selectedRegion ? `${theme.accent} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            All
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r ? `${theme.accent} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <BracketGrid
        rounds={rounds}
        picks={picks}
        effectiveNames={effectiveNames}
        tournament={tournament}
        isLocked={isLocked || readOnly}
        readOnly={readOnly}
        ownerName={ownerName}
        onPick={handlePick}
      />

      {/* Tiebreaker — only for the pick-making user, not read-only */}
      {!readOnly && tournament.requires_tiebreaker && champGame && champPick && (
        <TiebreakerPanel
          champGame={champGame}
          champPick={champPick}
          isLocked={isLocked}
        />
      )}

      <ChampionCallout
        champion={champion}
        readOnly={readOnly}
        ownerName={ownerName}
      />
    </div>
  )
}
