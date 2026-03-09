// src.views.AdminBuilderView.TournamentConfigPanel.tsx
import { useState, useEffect } from 'react'
import { Settings2, Hash, ToggleLeft, ToggleRight } from 'lucide-react'
import { useTheme }            from '../../../shared/utils/theme'
import { getRoundLabel }       from '../../../shared/utils/helpers'
import type { Tournament, Game, ScoringConfig } from '../../../shared/types'

function fibonacci(r: number): number {
  if (r <= 0) return 0;
  if (r === 1) return 1;
  if (r === 2) return 2;
  let a = 1, b = 2;
  for (let i = 3; i <= r; i++) { const c = a + b; a = b; b = c; }
  return b;
}

interface Props {
  tournament: Tournament
  games:      Game[]
  onUpdate:   (updates: Partial<Tournament>) => void
}

export default function TournamentConfigPanel({ tournament, games, onUpdate }: Props) {
  const theme    = useTheme()
  const maxRound = games.length ? Math.max(...games.map(g => g.round_num)) : 6

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [roundNamesInput, setRoundNamesInput] = useState<string[]>(
    tournament.round_names?.length ? [...tournament.round_names] : []
  )
  const [scoringInput, setScoringInput] = useState<Record<string, string>>(() =>
    buildScoringInput(tournament.scoring_config, maxRound)
  )

  useEffect(() => {
    setRoundNamesInput(tournament.round_names?.length ? [...tournament.round_names] : [])
  }, [tournament.round_names])

  useEffect(() => {
    setScoringInput(buildScoringInput(tournament.scoring_config, maxRound))
  }, [tournament.scoring_config, maxRound])

  const handleSave = async () => {
    setSaving(true)
    const config: ScoringConfig = {}
    let isCustom = false
    Object.entries(scoringInput).forEach(([r, val]) => {
      const parsed     = parseInt(val, 10)
      const defaultVal = fibonacci(parseInt(r, 10) + 1)
      if (!isNaN(parsed)) {
        config[r] = parsed
        if (parsed !== defaultVal) isCustom = true
      }
    })
    
    await onUpdate({
      round_names:    roundNamesInput.map(n => n.trim()),
      scoring_config: isCustom ? config : null,
    })
    
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const resetToFibonacci = () => {
    const reset: Record<string, string> = {}
    for (let r = 1; r <= Math.max(maxRound, 6); r++) {
      reset[String(r)] = String(fibonacci(r + 1))
    }
    setScoringInput(reset)
  }

  const inputCls = 'bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-slate-500 transition-colors'

  return (
    <div className="px-5 border-b border-amber-500/10 bg-amber-500/5 flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[11px] font-bold text-amber-400/70 hover:text-amber-300 uppercase tracking-widest transition-colors w-full text-left py-2"
      >
        <Settings2 size={11} />
        Tournament Config
        <span className="text-slate-600 normal-case font-normal tracking-normal ml-1">
          scoring · round names · tiebreaker
        </span>
        <span className={`ml-auto text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className={`${theme.panelBg} border border-slate-800 rounded-xl p-3`}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Hash size={9} /> Points per Round
            </h4>
            <div className="space-y-1.5">
              {Array.from({ length: maxRound }, (_, i) => {
                const r = String(i + 1)
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-14 flex-shrink-0">Round {r}</span>
                    <input
                      type="number" min="0"
                      value={scoringInput[r] ?? ''}
                      onChange={e => setScoringInput(prev => ({ ...prev, [r]: e.target.value }))}
                      className={`w-14 text-center ${inputCls}`}
                    />
                    <span className="text-[10px] text-slate-600">(fib: {fibonacci(i + 2)})</span>
                  </div>
                )
              })}
            </div>
            {tournament.scoring_config && (
              <button onClick={resetToFibonacci}
                className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 transition-colors">
                ↺ Reset to Fibonacci
              </button>
            )}
          </div>

          <div className={`${theme.panelBg} border border-slate-800 rounded-xl p-3`}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Custom Round Names
            </h4>
            <p className="text-[10px] text-slate-600 mb-2">Leave blank to use the default label.</p>
            <div className="space-y-1.5">
              {Array.from({ length: maxRound }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-14 flex-shrink-0">Round {i + 1}</span>
                  <input
                    value={roundNamesInput[i] ?? ''}
                    onChange={e => {
                      const next = [...roundNamesInput]
                      next[i] = e.target.value
                      setRoundNamesInput(next)
                    }}
                    placeholder={getRoundLabel(i + 1, maxRound)}
                    className={`flex-1 ${inputCls} placeholder-slate-700`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={`${theme.panelBg} border border-slate-800 rounded-xl p-3`}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Tie-Breaker
            </h4>
            <p className="text-[10px] text-slate-600 mb-3">
              Require users to predict the championship game's final score.
            </p>
            <button
              onClick={() => onUpdate({ requires_tiebreaker: !tournament.requires_tiebreaker })}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-bold
                ${tournament.requires_tiebreaker
                  ? `${theme.bg} ${theme.border} ${theme.accent}`
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
            >
              {tournament.requires_tiebreaker ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {tournament.requires_tiebreaker ? 'Enabled' : 'Disabled'}
            </button>
            {tournament.requires_tiebreaker && (
              <p className="mt-2 text-[10px] text-amber-400/70">
                Users will see a score input on the championship game card.
              </p>
            )}
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className={`px-5 py-2 rounded-xl text-white text-sm font-bold transition-all
                ${saved ? 'bg-emerald-600' : `${theme.btn}`} disabled:opacity-50`}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Tournament Config'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

function buildScoringInput(
  config: ScoringConfig | null | undefined,
  maxRound: number,
): Record<string, string> {
  const cfg    = config ?? {}
  const result: Record<string, string> = {}
  for (let r = 1; r <= Math.max(maxRound, 6); r++) {
    result[String(r)] = cfg[String(r)] !== undefined
      ? String(cfg[String(r)])
      : String(fibonacci(r + 1))
  }
  return result
}




