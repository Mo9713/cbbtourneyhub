import { ArrowRight, Activity, Lock, Trophy, CheckCircle, AlertCircle, HelpCircle, History } from 'lucide-react'
import type { Tournament } from '../../../shared/types'

interface Props {
  allTournaments: Tournament[]
  openTournaments: Tournament[]
  activeTournaments: Tournament[]
  completedTournaments: Tournament[]
  incompleteTournaments: Tournament[]
  allPicksComplete: boolean
  hasSurvivor: boolean
  survivorPrevPick?: string | null
  survivorPrevRoundLabel?: string
  waitingForTeams?: boolean
  onOpenRules: () => void
  onScrollToCard: (id: string) => void
  onViewSurvivorPicks: () => void
}

export function HomeHero({
  allTournaments, openTournaments, activeTournaments, completedTournaments,
  incompleteTournaments, allPicksComplete, hasSurvivor, 
  survivorPrevPick, survivorPrevRoundLabel, waitingForTeams,
  onOpenRules, onScrollToCard, onViewSurvivorPicks
}: Props) {
  
  let heroMessage = "Join a group or wait for a tournament to be assigned.";
  if (allTournaments.length > 0) {
    if (allPicksComplete) {
      if (waitingForTeams) {
         heroMessage = "You're all set for now! Waiting for teams to advance before the next round of picks opens.";
      } else if (survivorPrevRoundLabel) {
         heroMessage = `Your ${survivorPrevRoundLabel} pick is securely locked. Kick back and enjoy the games!`;
      } else {
         heroMessage = "Your picks are safely locked in. Kick back and enjoy the games!";
      }
    } else {
      if (survivorPrevRoundLabel) {
         heroMessage = `Your ${survivorPrevRoundLabel} pick is locked. You have ${incompleteTournaments.length} tournament${incompleteTournaments.length > 1 ? 's' : ''} ready for the next round.`;
      } else {
         heroMessage = `You have ${incompleteTournaments.length} tournament${incompleteTournaments.length > 1 ? 's' : ''} ready for the next round.`;
      }
    }
  }

  return (
    <div className={`relative w-full rounded-[2rem] overflow-hidden shadow-xl border transition-all duration-500 ${
      allPicksComplete 
        ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800' 
        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20 shadow-amber-500/5'
    }`}>
      <div className={`absolute top-0 right-0 w-96 h-96 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none transition-colors duration-1000 ${
        allPicksComplete ? 'bg-emerald-500/10' : 'bg-amber-500/20'
      }`} />
      <div className={`absolute bottom-0 left-0 w-96 h-96 blur-3xl rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none transition-colors duration-1000 ${
        allPicksComplete ? 'bg-blue-500/10' : 'bg-orange-500/10'
      }`} />
      
      <button 
        onClick={onOpenRules}
        className="absolute bottom-4 md:bottom-6 left-6 md:left-8 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900/10 hover:bg-slate-900/30 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white transition-all border border-slate-900/10 dark:border-white/10"
        title="How to Play"
      >
        <HelpCircle size={16} />
      </button>

      <div className="relative z-10 px-8 py-12 md:py-16 flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-16 md:pb-20">
        <div className="flex flex-col max-w-2xl">
          <div className="flex items-center gap-3 mb-4 w-full">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
              allPicksComplete ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 animate-pulse'
            }`}>
              {allPicksComplete ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            </div>
            <span className={`text-xs font-black uppercase tracking-[0.2em] ${allPicksComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
              {allTournaments.length === 0 ? 'Status: Standby' : allPicksComplete ? 'Status: All Set' : 'Status: Next Round Open'}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-display font-black text-slate-800 dark:text-white tracking-tight leading-tight">
            {allTournaments.length === 0 ? (
              <>Welcome to the Madness</>
            ) : allPicksComplete ? (
              <>All Set For Now.</>
            ) : (
              <>Upcoming Picks Open!</>
            )}
          </h1>

          <div className="mt-6 flex flex-col gap-5">
            {/* ── PEACE OF MIND BADGE: PROMINENT ROW ── */}
            {survivorPrevRoundLabel && (
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium bg-slate-100/80 dark:bg-slate-800/80 w-fit px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-md">
                <Lock size={18} className="text-amber-500" />
                <span className="text-sm font-bold uppercase tracking-widest text-slate-500">{survivorPrevRoundLabel} Pick:</span>
                <span className="text-base font-black text-slate-900 dark:text-white">{survivorPrevPick || 'None'}</span>
              </div>
            )}
            
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed">
              {heroMessage}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {!allPicksComplete && allTournaments.length > 0 && incompleteTournaments.map(t => (
              <button
                key={t.id}
                onClick={() => onScrollToCard(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-black hover:bg-amber-600 transition-all hover:scale-105 shadow-lg shadow-amber-500/25"
              >
                {t.name}: Make Pick <ArrowRight size={14} />
              </button>
            ))}
            
            {hasSurvivor && (
              <button
                onClick={onViewSurvivorPicks}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-black hover:scale-105 transition-all shadow-lg"
              >
                <History size={16} /> My Survivor Picks
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mb-2 scrollbar-none snap-x">
          {[
            { label: 'Open', val: openTournaments.length, color: 'text-emerald-500', icon: <Activity size={16} /> },
            { label: 'Locked', val: activeTournaments.length, color: 'text-red-500', icon: <Lock size={16} /> },
            { label: 'Finished', val: completedTournaments.length, color: 'text-violet-500', icon: <Trophy size={16} /> }
          ].map((stat) => (
            <div key={stat.label} className="snap-start bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-[1.5rem] p-6 shadow-sm min-w-[120px] flex flex-col items-center text-center">
              <div className={`flex items-center gap-2 ${stat.color} mb-2`}>
                {stat.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
              </div>
              <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">{stat.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}