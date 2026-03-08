// src/views/BracketView/index.tsx
import { useState, useMemo }        from 'react'
import { useTheme }                  from '../../utils/theme'
import { isPicksLocked }             from '../../utils/time'
import { BD_REGIONS }                from '../../utils/helpers'
import { deriveEffectiveNames,
         deriveChampion }            from '../../utils/bracketMath'
import { useAuthContext }            from '../../context/AuthContext'
import { useTournamentContext }      from '../../context/TournamentContext'
import { useBracketContext }         from '../../context/BracketContext'
import { BracketViewProvider }       from '../../context/BracketViewContext'
import BracketHeader                 from './BracketHeader'
import BracketGrid                   from './BracketGrid'
import ChampionCallout               from './ChampionCallout'
import TiebreakerPanel               from './TiebreakerPanel'
import type { Game, Pick, Tournament } from '../../types'

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
  const { picks: contextPicks, makePick }  = useBracketContext()

  const tournament = overrideTournament ?? selectedTournament
  const games      = overrideGames ?? (tournament ? (gamesCache[tournament.id] ?? []) : [])
  const picks      = overridePicks ?? contextPicks

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  if (!tournament || !profile) return null

  const isLocked   = isPicksLocked(tournament, profile.is_admin) || tournament.status === 'draft'
  const isBigDance = games.some(g => g.region)

  const effectiveNames = useMemo(() => deriveEffectiveNames(games, picks), [games, picks])
  const champion       = useMemo(() => deriveChampion(games, picks, effectiveNames), [games, picks, effectiveNames])

  const maxRound  = games.length > 0 ? Math.max(...games.map(g => g.round_num)) : 1
  const champGame = games.find(g => g.round_num === maxRound && !g.next_game_id)
                 ?? games.find(g => g.round_num === maxRound)
  const champPick = champGame ? picks.find(p => p.game_id === champGame.id) ?? null : null

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
    <BracketViewProvider
      isLocked={isLocked || readOnly}
      readOnly={readOnly}
      ownerName={ownerName}
      onPick={handlePick}
    >
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
        />

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
    </BracketViewProvider>
  )
}