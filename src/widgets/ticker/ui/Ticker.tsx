import { useMemo, useEffect } from 'react'
import { computeLeaderboard } from '../../../features/leaderboard/model/selectors'
import { isTeamMatch } from '../../../shared/lib/bracketMath'
import { getRoundLabel } from '../../../shared/lib/helpers' 
import { useUIStore } from '../../../shared/store/uiStore'
import type { Tournament, Game } from '../../../shared/types'

interface Props {
  rawData: any
  allTournaments: Tournament[]
}

export function Ticker({ rawData, allTournaments }: Props) {
  const segmentIndex = useUIStore(s => s.tickerSegmentIndex)
  const setSegmentIndex = useUIStore(s => s.setTickerSegmentIndex)
  
  const tickerSegments = useMemo(() => {
    if (!rawData || !allTournaments) return []
    const segments: any[] = []

    const stdTourneys = allTournaments.filter((t: Tournament) => t.game_type !== 'survivor')
    if (stdTourneys.length > 0) {
      const t = stdTourneys[0]
      const tGames = rawData.allGames.filter((g: Game) => g.tournament_id === t.id)
      
      const knownGames = tGames.filter((g: Game) => {
        const t1 = g.team1_name || ''
        const t2 = g.team2_name || ''
        return t1 && t1 !== 'TBD' && !t1.includes('Winner of') && 
               t2 && t2 !== 'TBD' && !t2.includes('Winner of')
      })

      const gamesByRound = new Map<number, any[]>()
      knownGames.forEach((g: Game) => {
        if (!gamesByRound.has(g.round_num)) gamesByRound.set(g.round_num, [])
        gamesByRound.get(g.round_num)!.push({
          id: g.id,
          t1: g.team1_name,
          t2: g.team2_name,
          s1: g.team1_score,
          s2: g.team2_score,
          seed1: g.team1_seed, 
          seed2: g.team2_seed,
          t1Won: isTeamMatch(g.team1_name || '', g.actual_winner),
          t2Won: isTeamMatch(g.team2_name || '', g.actual_winner),
          isCompleted: !!g.actual_winner
        })
      })

      // FIX: Add ALL rounds that have known teams
      const sortedRounds = Array.from(gamesByRound.keys()).sort((a, b) => a - b)
      const maxR = Math.max(...tGames.map((g: Game) => g.round_num))

      sortedRounds.forEach(rNum => {
        segments.push({
          id: `round-${rNum}`,
          type: 'round',
          label: getRoundLabel(rNum, maxR, t.round_names),
          items: gamesByRound.get(rNum)
        })
      })

      // Standard Standings
      const tMap = new Map(stdTourneys.map((t: Tournament) => [t.id, t]))
      const board = computeLeaderboard(rawData.allPicks, rawData.allGames.filter((g: Game) => tMap.has(g.tournament_id)), rawData.allGames, rawData.allProfiles, tMap).slice(0, 20)
      if (board.length > 0) {
        segments.push({ id: 'bracket-standings', type: 'bracket', label: 'Bracket Standings', items: board })
      }
    }

    // Survivor Standings
    const survTourneys = allTournaments.filter((t: Tournament) => t.game_type === 'survivor')
    if (survTourneys.length > 0) {
      const tMap = new Map(survTourneys.map((t: Tournament) => [t.id, t]))
      const board = computeLeaderboard(rawData.allPicks, rawData.allGames.filter((g: Game) => tMap.has(g.tournament_id)), rawData.allGames, rawData.allProfiles, tMap).slice(0, 20)
      if (board.length > 0) {
        segments.push({ id: 'survivor-standings', type: 'survivor', label: 'Survivor Standings', items: board })
      }
    }

    return segments.length === 0 ? [{ id: 'empty', type: 'empty', label: '', items: [] }] : segments
  }, [rawData, allTournaments])

  const currentSegment = tickerSegments[segmentIndex % tickerSegments.length]

  // Timing: 3s start pause + 3s end pause + 4s per item scroll
  const itemCount = currentSegment?.items?.length || 0
  const scrollDuration = Math.max(8, itemCount * 4.0) 
  const totalSegmentDuration = scrollDuration + 6.0 // 3s before + 3s after

  const startWaitPct = (3.0 / totalSegmentDuration) * 100
  const endWaitPct = ((3.0 + scrollDuration) / totalSegmentDuration) * 100

  useEffect(() => {
    if (tickerSegments.length <= 1) return
    const interval = setInterval(() => {
      setSegmentIndex((segmentIndex + 1) % tickerSegments.length)
    }, totalSegmentDuration * 1000)
    return () => clearInterval(interval)
  }, [tickerSegments.length, segmentIndex, totalSegmentDuration, setSegmentIndex])

  if (!currentSegment || currentSegment.type === 'empty') return null

  return (
    <>
      <style>{`
        @keyframes ticker-fade {
          0% { opacity: 0; }
          1.5% { opacity: 1; }
          98.5% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes ticker-scroll {
          0%, ${startWaitPct}% { transform: translateX(0); }
          ${endWaitPct}%, 100% { transform: translateX(min(0px, calc(-100% + 100vw - 200px))); }
        }
        @keyframes label-slide {
          0% { transform: translateY(-100%); opacity: 0; }
          1.5%, 98.5% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
      `}</style>

      <div className="w-full h-12 bg-[#0a0e17] border-b border-[#1a2332] flex items-center overflow-hidden relative shrink-0 shadow-md">
        
        <div className="absolute left-0 z-20 h-full px-5 md:px-8 flex items-center bg-[#0a0e17] border-r border-[#1a2332] shadow-[15px_0_20px_-5px_rgba(10,14,23,1)]">
          <span 
            key={`label-${currentSegment.id}`} 
            className="text-[10px] md:text-xs font-black uppercase tracking-widest text-amber-500 whitespace-nowrap"
            style={{ animation: `label-slide ${totalSegmentDuration}s cubic-bezier(0.16, 1, 0.3, 1) forwards` }}
          >
            {currentSegment.label}
          </span>
        </div>

        <div 
          key={`wrapper-${segmentIndex}`} 
          className="flex-1 h-full overflow-hidden"
          style={{ animation: `ticker-fade ${totalSegmentDuration}s ease-in-out forwards` }}
        >
          <div 
            className="h-full flex items-center gap-24 md:gap-32 whitespace-nowrap w-max pl-[180px] md:pl-[240px] pr-12"
            style={{ animation: `ticker-scroll ${totalSegmentDuration}s linear forwards` }}
          >
            {currentSegment.type === 'round' && currentSegment.items.map((g: any) => (
              <div key={g.id} className="flex items-center gap-3 shrink-0">
                <span className={`text-xs md:text-sm font-bold flex items-baseline gap-0.5 ${g.t1Won ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {g.seed1 && <sup className="text-[9px] text-slate-500 font-bold mr-0.5">{g.seed1}</sup>}
                  {g.t1}
                </span>
                {g.isCompleted && <span className={`text-xs md:text-sm font-black ml-0.5 ${g.t1Won ? 'text-white' : 'text-slate-500'}`}>{g.s1}</span>}
                <span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest mx-1.5">{g.isCompleted ? '-' : 'vs'}</span>
                <span className={`text-xs md:text-sm font-bold flex items-baseline gap-0.5 ${g.t2Won ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {g.seed2 && <sup className="text-[9px] text-slate-500 font-bold mr-0.5">{g.seed2}</sup>}
                  {g.t2}
                </span>
                {g.isCompleted && <span className={`text-xs md:text-sm font-black ml-0.5 ${g.t2Won ? 'text-white' : 'text-slate-500'}`}>{g.s2}</span>}
              </div>
            ))}

            {currentSegment.type === 'bracket' && currentSegment.items.map((u: any, i: number) => (
              <div key={u.profile.id} className="flex items-center gap-3 shrink-0">
                <span className="text-slate-500 font-bold text-[10px]">#{i+1}</span>
                <span className="text-white font-bold text-xs md:text-sm tracking-wide">{u.profile.display_name}</span>
                <span className="text-amber-500 font-black text-[13px] md:text-[15px] ml-0.5">{u.points} pts</span>
              </div>
            ))}

            {currentSegment.type === 'survivor' && currentSegment.items.map((u: any, i: number) => (
              <div key={u.profile.id} className="flex items-center gap-3 shrink-0">
                <span className="text-slate-500 font-bold text-[10px]">#{i+1}</span>
                <span className={`font-bold text-xs md:text-sm tracking-wide ${u.isEliminated ? 'text-slate-500 line-through' : 'text-white'}`}>{u.profile.display_name}</span>
                <span className="text-amber-500 font-black text-[13px] md:text-[15px] ml-0.5">{u.seedScore} pts</span>
                {u.isEliminated && <span className="text-rose-500 font-black text-[9px] uppercase tracking-widest ml-1 bg-rose-500/10 px-1.5 py-0.5 rounded">Elim</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}