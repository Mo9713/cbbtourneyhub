// src/widgets/tournament-bracket/ui/BracketView/TiebreakerPanel.tsx
import { useState, useEffect } from 'react'
import { Check }               from 'lucide-react'
import { useTheme }            from '../../../../shared/lib/theme'
import type { Game, Pick }     from '../../../../shared/types'

interface Props {
  champGame:    Game
  champPick:    Pick
  championName: string | null
  isLocked:     boolean
  onSave:       (gameId: string, predictedWinner: string, score: number) => Promise<string | null>
}

export default function TiebreakerPanel({ champGame, champPick, championName, isLocked, onSave }: Props) {
  const theme = useTheme()
  const [score, setScore] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (champPick?.tiebreaker_score != null) {
      setScore(String(champPick.tiebreaker_score))
    } else {
      setScore('')
    }
  }, [champPick?.tiebreaker_score])

  const handleSave = async () => {
    if (!score || isNaN(Number(score))) {
      setError('Please enter a valid number')
      return
    }
    setError(null)
    setIsSaving(true)
    
    // Pass the raw slot ('team1' or 'team2') so the db saves it properly
    const err = await onSave(champGame.id, champPick.predicted_winner, Number(score))
    
    setIsSaving(false)
    if (err) {
      setError(err)
    } else {
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    }
  }

  return (
    <div className={`mt-6 p-6 rounded-2xl border flex flex-col items-center text-center shadow-sm relative overflow-hidden ${theme.panelBg} ${theme.borderBase}`}>
      <div className={`absolute top-0 left-0 w-full h-1 ${theme.bgMd}`} />
      
      <h3 className={`font-display text-xl font-black uppercase tracking-widest mb-2 ${theme.textBase}`}>
        Championship Tiebreaker
      </h3>
      <p className={`text-sm mb-6 max-w-md ${theme.textMuted}`}>
        Predict the <strong className={theme.textBase}>total combined score</strong> of the championship game. This will be used to break ties on the leaderboard.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg">
        <div className={`flex-1 flex items-center justify-between px-5 py-3 rounded-xl border ${theme.borderBase} bg-slate-50 dark:bg-black/20`}>
          <span className={`text-xs font-bold uppercase tracking-widest ${theme.textMuted}`}>Your Pick</span>
          <span className={`font-bold ${theme.accent}`}>{championName || '—'}</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="number"
            min="0"
            max="300"
            placeholder="e.g. 145"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            disabled={isLocked || isSaving}
            className={`w-28 px-4 py-3 rounded-xl border text-center font-bold text-lg focus:outline-none focus:ring-2 ${theme.ring} ${theme.inputBg} ${theme.borderBase} ${theme.textBase} disabled:opacity-50`}
          />
          <button
            onClick={handleSave}
            disabled={isLocked || isSaving || !score}
            className={`h-12 px-6 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${
              savedSuccess ? 'bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-400' : theme.btn
            }`}
          >
            {isSaving ? 'Saving...' : savedSuccess ? <><Check size={18} /> Saved</> : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-rose-500 mt-4">{error}</p>}
    </div>
  )
}