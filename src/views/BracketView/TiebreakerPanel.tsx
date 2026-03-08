// src/views/BracketView/TiebreakerPanel.tsx
import { useState, useEffect } from 'react'
import { Hash, Check, Loader } from 'lucide-react'
import { useTheme }            from '../../utils/theme'
import * as pickService        from '../../services/pickService'
import type { Game, Pick }     from '../../types'

interface Props {
  champGame: Game
  champPick: Pick      // guaranteed to exist before this renders
  isLocked:  boolean
}

export default function TiebreakerPanel({ champGame, champPick, isLocked }: Props) {
  const theme = useTheme()

  const [input,   setInput]   = useState(champPick.tiebreaker_score?.toString() ?? '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // Sync if the pick updates externally (realtime)
  useEffect(() => {
    setInput(champPick.tiebreaker_score?.toString() ?? '')
  }, [champPick.tiebreaker_score])

  const handleSave = async () => {
    const val = parseInt(input, 10)
    if (!Number.isFinite(val) || val < 0) return
    setSaving(true)
    await pickService.saveTiebreakerScore(champGame.id, champPick.predicted_winner, val)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
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
            onKeyDown={handleKey}
            disabled={isLocked}
            placeholder="e.g. 142"
            className={`w-20 text-center text-sm font-bold rounded-lg px-2 py-1.5 border transition-colors
              bg-slate-900 text-white placeholder-slate-700
              ${isValid ? `border-slate-700 focus:border-slate-500` : 'border-red-500/50'}
              disabled:opacity-40 disabled:cursor-not-allowed
              focus:outline-none`}
          />
          {!isLocked && (
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${saved
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                  : `${theme.btn} text-white`
                }
                disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {saving ? <Loader size={12} className="animate-spin" />
                      : saved ? <Check size={12} /> : null}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
