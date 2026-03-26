import { BookOpen, Target, TrendingUp, Clock, X } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'

export function RulesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const theme = useTheme()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${theme.panelBg} ${theme.borderBase}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className={theme.accent} />
            <h2 className={`text-xl font-display font-black uppercase tracking-widest ${theme.textBase}`}>How to Play</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 md:p-8 flex flex-col gap-8 overflow-y-auto max-h-[70vh]">
          <div className="flex items-start gap-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${theme.bgMd}`}>
              <Target size={20} className={theme.accent} />
            </div>
            <div>
              <span className={`text-base font-black uppercase tracking-wider ${theme.textBase}`}>Survivor Rules</span>
              <p className={`text-sm leading-relaxed mt-2 ${theme.textMuted}`}>
                Pick one team to win each round. If they lose, you're eliminated. <strong>You can only pick a team once per tournament.</strong> Survive to the end!
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${theme.bgMd}`}>
              <TrendingUp size={20} className={theme.accent} />
            </div>
            <div>
              <span className={`text-base font-black uppercase tracking-wider ${theme.textBase}`}>Seed Scores</span>
              <p className={`text-sm leading-relaxed mt-2 ${theme.textMuted}`}>
                In case all players advance through the final round or all remaining players get eliminated in the same round, the <strong>Seed Score</strong> breaks the tie. Correctly picking a team adds their seed value to your score. Highest Seed Score wins.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${theme.bgMd}`}>
              <Clock size={20} className={theme.accent} />
            </div>
            <div>
              <span className={`text-base font-black uppercase tracking-wider ${theme.textBase}`}>Deadlines</span>
              <p className={`text-sm leading-relaxed mt-2 ${theme.textMuted}`}>
                Picks lock exactly when the first game of the round tips off. Once a round locks, you can make picks for the following round immediately as teams advance.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button onClick={onClose} className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${theme.btn}`}>
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}