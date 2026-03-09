// src/views/BracketView/TiebreakerPanel.tsx
import { useState, useEffect }  from 'react'
import { Hash, Check, Loader }  from 'lucide-react'
import { useTheme }             from '../../utils/theme'
import type { Game, Pick }      from '../../types'

interface Props {
  champGame: Game
  champPick: Pick
  isLocked:  boolean
  onSave:    (gameId: string, predictedWinner: string, score: number) => Promise<string | null>
}

export default function TiebreakerPanel({ champGame, champPick, isLocked, onSave }: Props) {
  const theme = useTheme()

  const [input,  setInput]  = useState(champPick.tiebreaker_score?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    setInput(champPick.tiebreaker_score?.toString() ?? '')
  }, [champPick.tiebreaker_score])

  const handleSave = async () => {
    const val = parseInt(input, 10)
    if (!Number.isFinite(val) || val < 0) return
    setSaving(true)
    const err = await onSave(champGame.id, champPick.predicted_winner, val)
    setSaving(false)
    if (err) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isValid = /^\d+$/.test(input.trim()) && parseInt(input, 10) >= 0

  return (
    <div className={`flex-shrink-0 border-t border-slate-800 px-6 py-3 ${theme.bg}/50`}>
      <div className="flex items-center gap-3 max-w-sm">
        <Hash size={13} className={theme.accent} />
        <div className="flex flex-col">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.accent}`}>
            Tiebreaker — Championship Total Score
          </span>
          <span className="text-[10px] text-slate-500">
            Predict the combined final score for {champPick.predicted_winner}'s game
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            min={0}
            value={input}
            onChange={e => { setInput(e.target.value); setSaved(false) }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            disabled={isLocked}
            placeholder="e.g. 142"
            className={`w-20 text-center text-sm font-bold rounded-lg px-2 py-1.5 border transition-colors
              bg-slate-900 text-white placeholder-slate-700
              ${isValid ? 'border-slate-700 focus:border-slate-500' : 'border-red-500/50'}
              disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none`}
          />
          {!isLocked && (
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${saved
                  ? 'bg-emerald-600 border-emerald-500 text-white border'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500 disabled:opacity-40'
                }`}
            >
              {saving ? <Loader size={11} className="animate-spin" /> : <Check size={11} />}
              {saved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}