// src/features/bracket/BracketView/index.tsx
import { useState, useMemo, useCallback } from 'react'
import { useTheme }                        from '../../../shared/utils/theme'
import { isPicksLocked }                   from '../../../shared/utils/time'
import { BD_REGIONS }                      from '../../../shared/utils/helpers'
import { deriveEffectiveNames, deriveChampion } from '../../../shared/utils/bracketMath'
import { useAuthContext }                  from '../../auth'
import { useTournamentContext }            from '../../tournament'
import { useBracketContext }               from '..'
import { BracketViewProvider }             from '../BracketViewContext'
import { useMyPicks, useMakePick }         from '../queries'
import { buildPickMap, sortedRounds, getChampGame } from '../selectors'
import BracketHeader                       from './BracketHeader'
import BracketGrid                         from './BracketGrid'
import ChampionCallout                     from './ChampionCallout'
import TiebreakerPanel                     from './TiebreakerPanel'
import type { Game, Pick, Tournament }     from '../../../shared/types'


interface BracketViewProps {
  readOnly?:           boolean
  ownerName?:          string
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
  const { saveTiebreaker }                 = useBracketContext()

  const tournament = overrideTournament ?? selectedTournament
  const games      = overrideGames ?? (tournament ? (gamesCache[tournament.id] ?? []) : [])

  // Picks — from TanStack cache or override (snoop read-only mode)
  const { data: queryPicks = [] } = useMyPicks(tournament?.id ?? null, games)
  const picks                     = overridePicks ?? queryPicks

  const { mutateAsync: makePick } = useMakePick()

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // ── Derived booleans ──────────────────────────────────────

  const isLocked = tournament && profile
    ? isPicksLocked(tournament, profile.is_admin) || tournament.status === 'draft'
    : false

  const isBigDance = useMemo(() => games.some(g => g.region), [games])

  // ── Selectors computed once at the boundary ───────────────
  
  const pickMap        = useMemo(() => buildPickMap(picks),                                          [picks])
  const rounds         = useMemo(() => sortedRounds(games, isBigDance ? selectedRegion : null),      [games, isBigDance, selectedRegion])
  const effectiveNames = useMemo(() => deriveEffectiveNames(games, picks),                           [games, picks])
  const champion       = useMemo(() => deriveChampion(games, picks, effectiveNames),                 [games, picks, effectiveNames])
  const champGame      = useMemo(() => getChampGame(games),                                          [games])

  // FIX C-1 (cont.): Was an inline ternary expression after the guard —
  // also a hook-ordering hazard. Promoted to useMemo for consistency
  // and to give it a stable reference.
  const champPick = useMemo(
    () => champGame ? (picks.find(p => p.game_id === champGame.id) ?? null) : null,
    [champGame, picks],
  )

  // ── Event handlers ────────────────────────────────────────

  const handlePick = useCallback(async (game: Game, team: string) => {
    if (!tournament || readOnly || isLocked) return
    const existingPick = pickMap.get(game.id)
    await makePick({ game, team, tournamentId: tournament.id, games, existingPick })
  }, [tournament, readOnly, isLocked, pickMap, makePick, games])

  const handleTiebreaker = useCallback(async (
    gameId: string, predictedWinner: string, score: number,
  ): Promise<string | null> => {
    return saveTiebreaker(gameId, predictedWinner, score)
  }, [saveTiebreaker])

  // FIX W-1 (cont.): The value object passed to BracketViewProvider was
  // reconstructed as a new object literal on every render, making the
  // Context value reference perpetually unstable. Memoized here so
  // downstream consumers only re-render when the actual values change.
  const bracketViewValue = useMemo(() => ({
    isLocked: isLocked || readOnly,
    readOnly,
    ownerName,
    onPick:   handlePick,
  }), [isLocked, readOnly, ownerName, handlePick])

  // ── Early return guard ────────────────────────────────────
  //
  // Intentionally placed AFTER all hooks. This is a render bail-out only.
  // Moving it above any hook would violate the Rules of Hooks.
  if (!tournament || !profile) return null

  return (
    <BracketViewProvider {...bracketViewValue}>
      <div className="flex flex-col h-full overflow-hidden">
        <BracketHeader
          tournament={tournament}
          pickedCount={picks.length}
          totalGames={games.length}
          readOnly={readOnly}
          ownerName={ownerName}
        />

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
              <button
                key={r}
                onClick={() => setSelectedRegion(r)}
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
          pickMap={pickMap}
          effectiveNames={effectiveNames}
          tournament={tournament}
        />

        {!readOnly && tournament.requires_tiebreaker && champGame && champPick && (
          <TiebreakerPanel
            champGame={champGame}
            champPick={champPick}
            isLocked={isLocked}
            onSave={handleTiebreaker}
          />
        )}

        <ChampionCallout
          champion={champion}
          readOnly={readOnly}
          ownerName={ownerName}
        />
      </div>
    </BracketViewProvider>
  )
}