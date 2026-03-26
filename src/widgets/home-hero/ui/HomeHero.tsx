import { ArrowRight, Activity, Lock, Trophy, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react'
import type { Tournament } from '../../../shared/types'

interface Props {
  allTournaments: Tournament[]
  openTournaments: Tournament[]
  activeTournaments: Tournament[]
  completedTournaments: Tournament[]
  incompleteTournaments: Tournament[]
  allPicksComplete: boolean
  onOpenRules: () => void
  onScrollToCard: (id: string) => void
}

export function HomeHero({
  allTournaments, openTournaments, activeTournaments, completedTournaments,
  incompleteTournaments, allPicksComplete, onOpenRules, onScrollToCard
}: Props) {
  
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
              {allTournaments.length === 0 ? 'Status: Standby' : allPicksComplete ? 'Status: All Set' : 'Status: Action Required'}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-display font-black text-slate-800 dark:text-white tracking-tight leading-tight">
            {allTournaments.length === 0 ? (
              <>Welcome to the Madness</>
            ) : allPicksComplete ? (
              <>All your picks are locked in.</>
            ) : (
              <>Picks not completed!</>
            )}
          </h1>

          <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium text-lg">
            {allTournaments.length === 0
              ? "Join a group or wait for a tournament to be assigned."
              : allPicksComplete 
              ? "No action required." 
              : `You have ${incompleteTournaments.length} tournament${incompleteTournaments.length > 1 ? 's' : ''} waiting for your picks.`}
          </p>

          {!allPicksComplete && allTournaments.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {incompleteTournaments.map(t => (
                <button
                  key={t.id}
                  onClick={() => onScrollToCard(t.id)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-black hover:bg-amber-600 transition-all hover:scale-105 shadow-lg shadow-amber-500/25"
                >
                  {t.name} <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
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