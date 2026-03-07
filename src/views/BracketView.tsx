// src/views/BracketView.tsx
import { useState, useMemo } from 'react'
import { Lock, Eye, Crown } from 'lucide-react'
import { useTheme }          from '../utils/theme'
import { isPicksLocked, formatCSTDisplay } from '../utils/time'
import {
  resolveScore, getRoundLabel, isTBDName,
  statusLabel, statusIcon, computeGameNumbers, BD_REGIONS,
} from '../utils/helpers'
import GameCard from '../components/GameCard'
import type { Tournament, Game, Pick, Profile } from '../types'

interface Props {
  tournament:  Tournament
  games:       Game[]
  picks:       Pick[]
  profile:     Profile
  onPick:      (game: Game, team: string) => void
  readOnly?:   boolean
  ownerName?:  string
}

export default function BracketView({
  tournament, games, picks, profile, onPick, readOnly, ownerName,
}: Props) {
  const theme          = useTheme()
  const picksLocked    = isPicksLocked(tournament, profile.is_admin)
  const isLocked       = picksLocked || tournament.status === 'draft'
  const lockedByTipOff = picksLocked && tournament.status === 'open'
  const isBigDance     = games.some(g => g.region)

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const displayGames = useMemo(() => {
    if (!isBigDance || !selectedRegion) return games
    return games.filter(g => g.region === selectedRegion)
  }, [games, isBigDance, selectedRegion])

  // ── Game numbers (needed for slot text-matching) ─────────────
  const gameNumbers = useMemo(() => computeGameNumbers(games), [games])

  // ── effectiveNames ───────────────────────────────────────────
  // Derives each game's displayed team names by propagating the
  // user's picks (and actual winners) forward through the bracket.
  //
  // SLOT RESOLUTION ORDER (mirrors gameService & recomputeLines):
  //   1. PRIMARY   — text-match: does nextGame.team1_name / team2_name
  //                  equal "Winner of Game #N"? Use that slot.
  //   2. SECONDARY — if the actual_winner has already advanced, the
  //                  placeholder was replaced by the team name — match that.
  //   3. FALLBACK  — sort feeders by sort_order + id and use index 0/1.
  //                  Only reached when no text evidence exists at all.
  const effectiveNames = useMemo(() => {
    // Start with the raw DB values
    const names: Record<string, { team1: string; team2: string }> = {}
    games.forEach(g => { names[g.id] = { team1: g.team1_name, team2: g.team2_name } })

    const pickMap = new Map(picks.map(p => [p.game_id, p.predicted_winner]))

    // Process rounds in ascending order so earlier picks propagate first
    const sorted = [...games].sort((a, b) =>
      a.round_num !== b.round_num ? a.round_num - b.round_num : (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )

    for (const game of sorted) {
      if (!game.next_game_id) continue

      // Determine the winner to propagate for this game:
      //   • actual_winner always wins out (admin-set result)
      //   • user's pick is used only when both slots are real teams
      //     (i.e. not still showing "Winner of Game #N" placeholders —
      //     those mean the *feeder* game hasn't been resolved yet)
      const currentTeam1 = names[game.id]?.team1 ?? game.team1_name
      const currentTeam2 = names[game.id]?.team2 ?? game.team2_name
      const slotsAreReal = !isTBDName(currentTeam1) && !isTBDName(currentTeam2)

      const winner =
        game.actual_winner ??
        (slotsAreReal ? pickMap.get(game.id) : undefined)

      if (!winner) continue

      const nextGame = games.find(g => g.id === game.next_game_id)
      if (!nextGame) continue

      const winnerText = `Winner of Game #${gameNumbers[game.id]}`

      // ── 1. PRIMARY: text-match on the placeholder ─────────────
      if (game.team1_name === winnerText || nextGame.team1_name === winnerText) {
        // This game feeds into team1 slot of the next game
        names[nextGame.id] = { ...names[nextGame.id], team1: winner }
        continue
      }
      if (game.team2_name === winnerText || nextGame.team2_name === winnerText) {
        // This game feeds into team2 slot of the next game
        names[nextGame.id] = { ...names[nextGame.id], team2: winner }
        continue
      }

      // ── 2. SECONDARY: actual winner name may have replaced placeholder ──
      // (e.g. admin already set winners in earlier rounds)
      if (game.actual_winner) {
        if (nextGame.team1_name === game.actual_winner) {
          names[nextGame.id] = { ...names[nextGame.id], team1: winner }
          continue
        }
        if (nextGame.team2_name === game.actual_winner) {
          names[nextGame.id] = { ...names[nextGame.id], team2: winner }
          continue
        }
      }

      // ── 3. FALLBACK: index-based (fresh templates before slot labels) ──
      const feeders = games
        .filter(g => g.next_game_id === game.next_game_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      const isFirst = feeders[0]?.id === game.id
      if (isFirst) names[nextGame.id] = { ...names[nextGame.id], team1: winner }
      else          names[nextGame.id] = { ...names[nextGame.id], team2: winner }
    }

    return names
  }, [games, picks, gameNumbers])

  // ── userPickMap ──────────────────────────────────────────────
  const userPickMap = useMemo(() =>
    new Map(picks.map(p => [p.game_id, p])),
    [picks]
  )

  // ── Derived display values ───────────────────────────────────
  const maxRound    = useMemo(() => games.length ? Math.max(...games.map(g => g.round_num)) : 1, [games])
  const pickedCount = picks.length
  const totalGames  = games.length

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach(g => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, gs]) => [
        round,
        gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      ] as [number, Game[]])
  }, [displayGames])

  // ── Champion derivation ──────────────────────────────────────
  // Find the single championship game (highest round_num, no next_game_id).
  // Then resolve the champion from:
  //   1. actual_winner (admin confirmed result)
  //   2. user's pick on that game
  //   3. effectiveNames propagated value in team1 or team2 slot
  //      (covers the case where a pick was made in an earlier round
  //       and has visually advanced all the way to the championship)
  const champion = useMemo(() => {
    const champGame = games.find(
      g => g.round_num === maxRound && !g.next_game_id
    ) ?? games.find(g => g.round_num === maxRound) // fallback if next_game_id was set

    if (!champGame) return null

    // Actual winner beats everything
    if (champGame.actual_winner) return champGame.actual_winner

    // User's direct pick on the championship game
    const directPick = pickMap_champion(picks, champGame.id)
    if (directPick) return directPick

    // A propagated effective name that is a real team (not a placeholder)
    const eff = effectiveNames[champGame.id]
    if (eff) {
      const userPick = userPickMap.get(champGame.id)?.predicted_winner
      if (userPick) return userPick
      // Check if one of the effective slots is a resolved team from picks
      if (eff.team1 && !isTBDName(eff.team1)) {
        // Is team1 the one the user picked in an earlier game?
        const pickedTeam1 = picks.some(p => p.predicted_winner === eff.team1)
        if (pickedTeam1) return eff.team1
      }
      if (eff.team2 && !isTBDName(eff.team2)) {
        const pickedTeam2 = picks.some(p => p.predicted_winner === eff.team2)
        if (pickedTeam2) return eff.team2
      }
    }
    return null
  }, [games, picks, effectiveNames, userPickMap, maxRound])

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className={`px-6 py-4 border-b flex-shrink-0 flex items-center justify-between gap-4
        ${readOnly ? 'bg-violet-500/5 border-violet-500/20' : theme.headerBg}`}>
        <div>
          {readOnly && (
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Read-Only</span>
            </div>
          )}
          <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">
            {readOnly ? `${ownerName}'s Bracket` : tournament.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            {statusIcon(tournament.status)}
            <span className="text-xs text-slate-400">{statusLabel(tournament.status)}</span>
            {!readOnly && (
              <>
                <span className="text-slate-700">·</span>
                <span className={`text-xs font-semibold ${theme.accent}`}>
                  {pickedCount}/{totalGames} picks
                </span>
              </>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <span className="text-xs text-slate-400">Progress</span>
              <span className={`text-sm font-bold ${theme.accent}`}>{pickedCount}/{totalGames}</span>
            </div>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${theme.bar} rounded-full transition-all`}
                style={{ width: `${totalGames ? Math.round((pickedCount / totalGames) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Big Dance region tabs */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
              ${!selectedRegion ? `${theme.accent} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            All
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r ? `${theme.accent} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Lock banner */}
      {isLocked && !readOnly && (
        <div className={`flex items-center gap-2 px-6 py-2 text-xs font-semibold flex-shrink-0
          ${tournament.status === 'draft'
            ? 'bg-amber-500/10 border-b border-amber-500/20 text-amber-400'
            : 'bg-slate-800/60 border-b border-slate-700 text-slate-400'
          }`}>
          <Lock size={11} />
          {tournament.status === 'draft'
            ? 'Draft mode — not yet open for picks.'
            : lockedByTipOff
              ? `Picks locked${tournament.locks_at ? ` · ${formatCSTDisplay(tournament.locks_at)}` : ''}`
              : 'This tournament is locked.'}
        </div>
      )}

      {/* Bracket scroll area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-6 min-w-max items-start">
          {rounds.map(([round, roundGames]) => (
            <div key={round} className="flex flex-col gap-3">
              <div className="text-center pb-3 border-b border-slate-800">
                <h3 className={`font-display text-sm font-bold uppercase tracking-[0.15em] ${theme.accent}`}>
                  {/* Respect custom round names if configured */}
                  {tournament.round_names?.[round - 1]?.trim()
                    ? tournament.round_names[round - 1]
                    : getRoundLabel(round, maxRound)
                  }
                </h3>
                <span className="text-[10px] text-slate-600">
                  {resolveScore(round, tournament.scoring_config)} points
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {roundGames.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    userPick={userPickMap.get(game.id)}
                    effectiveTeam1={effectiveNames[game.id]?.team1 ?? game.team1_name}
                    effectiveTeam2={effectiveNames[game.id]?.team2 ?? game.team2_name}
                    isLocked={isLocked || readOnly || false}
                    onPick={onPick}
                    readOnly={readOnly}
                    ownerName={ownerName}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Champion callout */}
        {champion && (
          <div className={`mt-8 flex flex-col items-center gap-2 p-5 rounded-2xl border
            ${theme.bg} ${theme.border} max-w-xs mx-auto`}>
            <Crown size={20} className={theme.accent} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {readOnly ? `${ownerName}'s Champion` : 'Your Champion'}
            </p>
            <p className={`font-display text-2xl font-extrabold uppercase tracking-wide ${theme.accent}`}>
              {champion}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Module-level helper (avoids recreating inside useMemo) ────
function pickMap_champion(picks: Pick[], gameId: string): string | undefined {
  return picks.find(p => p.game_id === gameId)?.predicted_winner
}