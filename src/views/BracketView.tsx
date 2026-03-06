// src/views/BracketView.tsx
import { useState, useMemo } from 'react'
import { Lock, Eye, Crown } from 'lucide-react'
import { useTheme } from '../utils/theme'
import { isPicksLocked, formatCSTDisplay } from '../utils/time'
import { getScore, getRoundLabel, isTBDName, statusLabel, statusIcon, computeGameNumbers, BD_REGIONS } from '../utils/helpers'
import GameCard from '../components/GameCard'
import type { Tournament, Game, Pick, Profile } from '../types'

interface Props {
  tournament: Tournament
  games: Game[]
  picks: Pick[]
  profile: Profile
  onPick: (game: Game, team: string) => void
  readOnly?: boolean
  ownerName?: string
}

export default function BracketView({
  tournament, games, picks, profile, onPick, readOnly, ownerName,
}: Props) {
  const theme = useTheme()
  const picksLocked    = isPicksLocked(tournament, profile.is_admin)
  const isLocked       = picksLocked || tournament.status === 'draft'
  const lockedByTipOff = picksLocked && tournament.status === 'open'
  const isBigDance     = games.some(g => g.region)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const displayGames = useMemo(() => {
    if (!isBigDance || !selectedRegion) return games
    return games.filter(g => g.region === selectedRegion)
  }, [games, isBigDance, selectedRegion])

  const effectiveNames = useMemo(() => {
    const names: Record<string, { team1: string; team2: string }> = {}
    games.forEach(g => { names[g.id] = { team1: g.team1_name, team2: g.team2_name } })
    const pickMap  = new Map(picks.map(p => [p.game_id, p.predicted_winner]))
    const gameNums = computeGameNumbers(games)
    const sorted   = [...games].sort((a, b) => a.round_num - b.round_num)
    for (const game of sorted) {
      if (!game.next_game_id) continue
      const winner = game.actual_winner ??
        (game.team1_name.startsWith('Winner of Game') || game.team2_name.startsWith('Winner of Game')
          ? undefined
          : pickMap.get(game.id))
      if (!winner) continue
      const nextGame = games.find(g => g.id === game.next_game_id)
      if (!nextGame) continue
      const feeders = games
        .filter(g => g.next_game_id === game.next_game_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      const isFirst = feeders[0]?.id === game.id
      if (isFirst) names[nextGame.id] = { ...names[nextGame.id], team1: winner }
      else          names[nextGame.id] = { ...names[nextGame.id], team2: winner }
    }
    return names
  }, [games, picks])

  const userPickMap = useMemo(() =>
    new Map(picks.map(p => [p.game_id, p])),
    [picks]
  )

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
      .map(([round, gs]) => [round, gs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))] as [number, Game[]])
  }, [displayGames])

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
                <span className={`text-xs font-semibold ${theme.accent}`}>{pickedCount}/{totalGames} picks</span>
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
                style={{ width: `${totalGames ? (pickedCount / totalGames) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Big Dance region tabs */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto bg-slate-900/50">
          <button onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
              ${!selectedRegion ? theme.tabActive : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            All Regions
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedRegion === r ? theme.tabActive : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Lock banners */}
      {lockedByTipOff && !readOnly && (
        <div className="mx-6 mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 flex-shrink-0">
          <Lock size={13} className="text-amber-400" />
          <p className="text-sm text-amber-300 font-semibold">Picks are now locked.</p>
          {tournament.locks_at && (
            <span className="text-xs text-amber-400/60 ml-auto">
              Locked at {formatCSTDisplay(tournament.locks_at)}
            </span>
          )}
        </div>
      )}
      {isLocked && !lockedByTipOff && !readOnly && (
        <div className="mx-6 mt-4 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-3 flex-shrink-0">
          <Lock size={13} className="text-slate-400" />
          <p className="text-sm text-slate-400">
            {tournament.status === 'draft'
              ? 'Draft mode — not yet open for picks.'
              : 'This tournament is locked.'}
          </p>
        </div>
      )}

      {/* Bracket scroll area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-6 min-w-max items-start">
          {rounds.map(([round, roundGames]) => (
            <div key={round} className="flex flex-col gap-3">
              <div className="text-center pb-3 border-b border-slate-800">
                <h3 className={`font-display text-sm font-bold uppercase tracking-[0.15em] ${theme.accent}`}>
                  {getRoundLabel(round, maxRound)}
                </h3>
                <span className="text-[10px] text-slate-600">{getScore(round)} points</span>
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
        {(() => {
          const champGame = games.find(g => g.round_num === maxRound)
          const champPick = champGame
            ? picks.find(p => p.game_id === champGame.id)?.predicted_winner ?? null
            : null
          if (!champPick || readOnly) return null
          return (
            <div className="flex justify-center mt-10 mb-2">
              <div className="flex flex-col items-center gap-1 relative">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Your Champion</span>
                <div className="relative flex items-center justify-center px-10 py-5">
                  <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 260 76">
                    <defs>
                      <filter id="chalkfx" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" seed="8" result="noise"/>
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
                      </filter>
                    </defs>
                    <ellipse cx="130" cy="38" rx="118" ry="32" fill="none"
                      stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray="7 5" filter="url(#chalkfx)" />
                    <ellipse cx="130" cy="38" rx="121" ry="35" fill="none"
                      stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray="4 12" filter="url(#chalkfx)" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <Crown size={20} className={theme.accent} />
                    <span className={`font-display text-3xl font-extrabold uppercase tracking-wider ${theme.accentB}`}>
                      {champPick}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}