// src/views/BracketView/index.tsx

import { useState, useMemo }        from 'react'
import { useTheme }                  from '../../utils/theme'
import { isPicksLocked }             from '../../utils/time'
import { BD_REGIONS }                from '../../utils/helpers'
import {
  deriveEffectiveNames,
  deriveChampion,
}                                    from '../../utils/bracketMath'
import { useAuthContext }            from '../../context/AuthContext'
import { useTournamentContext }      from '../../context/TournamentContext'
import { useBracketContext }         from '../../context/BracketContext'
import BracketHeader                 from './BracketHeader'
import BracketGrid                   from './BracketGrid'
import ChampionCallout               from './ChampionCallout'
import TiebreakerPanel               from './TiebreakerPanel'
import type { Game, Pick, Tournament } from '../../types'

interface BracketViewProps {
  /** When true: read-only snoop mode. Provided externally by SnoopModal. */
  readOnly?:           boolean
  ownerName?:          string
  /** Override data for snoop mode — SnoopModal injects the target user's picks. */
  overridePicks?:      Pick[]
  overrideTournament?: Tournament
  overrideGames?:      Game[]
}

export default function BracketView({
  readOnly          = false,
  ownerName,
  overridePicks,
  overrideTournament,
  overrideGames,
}: BracketViewProps) {
  const theme = useTheme()

  const { profile }                        = useAuthContext()
  const { selectedTournament, gamesCache } = useTournamentContext()
  const { picks: contextPicks, makePick }  = useBracketContext()

  // Snoop mode uses injected data; normal mode uses context data.
  const tournament = overrideTournament ?? selectedTournament
  const games      = overrideGames ?? (tournament ? (gamesCache[tournament.id] ?? []) : [])
  const picks      = overridePicks ?? contextPicks

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  if (!tournament || !profile) return null

  const isLocked   = isPicksLocked(tournament, profile.is_admin) || tournament.status === 'draft'
  const isBigDance = games.some(g => g.region)

  // ── Bracket derivations — from the canonical bracketMath functions ──
  //
  // deriveEffectiveNames propagates picks and actual_winners forward
  // through the bracket tree. deriveChampion reads the final game from
  // that output. Both functions are pure and memoized on games + picks.
  //
  // NOTE: effectiveNames is the same object whether the user is in
  // normal or snoop mode — the `picks` variable above is already
  // pointing to the correct source for each mode.
  const effectiveNames = useMemo(
    () => deriveEffectiveNames(games, picks),
    [games, picks]
  )

  const champion = useMemo(
    () => deriveChampion(games, picks, effectiveNames),
    [games, picks, effectiveNames]
  )

  // ── View-layer layout: championship game reference ────────────
  // Needed to conditionally render TiebreakerPanel and to locate
  // the current user's championship pick. This is a view concern
  // (which DOM element to show), not a bracket-logic concern.
  const maxRound  = games.length > 0 ? Math.max(...games.map(g => g.round_num)) : 1
  const champGame = games.find(g => g.round_num === maxRound && !g.next_game_id)
                 ?? games.find(g => g.round_num === maxRound)
  const champPick = champGame
    ? picks.find(p => p.game_id === champGame.id) ?? null
    : null

  const pickedCount = picks.length
  const totalGames  = games.length

  // ── View-layer layout: region filter + round grouping ─────────
  // These are rendering concerns — how to divide games into columns
  // and filter by Big Dance region tab. They are NOT bracket-math
  // and intentionally live here rather than in bracketMath.ts.
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
      .map(([round, gs]) => (
        [round, gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))] as [number, Game[]]
      ))
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
              ${!selectedRegion
                ? `${theme.accent} border-current`
                : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
          >
            All
          </button>
          {BD_REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r
                  ? `${theme.accent} border-current`
                  : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
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