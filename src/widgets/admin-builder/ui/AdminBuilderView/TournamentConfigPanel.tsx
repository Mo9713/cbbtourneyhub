// src/widgets/admin-builder/ui/AdminBuilderView/TournamentConfigPanel.tsx
import { useState, useEffect } from 'react'
import { Settings2, Hash, ToggleLeft, ToggleRight, CalendarClock, ShieldAlert } from 'lucide-react'
import { useTheme }            from '../../../../shared/lib/theme'
import { getRoundLabel }       from '../../../../shared/lib/helpers'
import { isoToInputInTz, inputInTzToISO } from '../../../../shared/lib/time'
import type { Tournament, Game, ScoringConfig } from '../../../../shared/types'

function fibonacci(r: number): number {
  if (r <= 0) return 0;
  if (r === 1) return 1;
  if (r === 2) return 2;
  let a = 1, b = 2;
  for (let i = 3; i <= r; i++) { const c = a + b; a = b; b = c; }
  return b;
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

  const [survivorRuleInput, setSurvivorRuleInput] = useState<'end_early' | 'revive_all'>(
    tournament.survivor_elimination_rule || 'end_early'
  )

  const [roundLocksInput, setRoundLocksInput] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    for (let i = 1; i <= 6; i++) {
      init[i] = isoToInputInTz(tournament.round_locks?.[i] ?? null, null)
    }
    return init
  })

  useEffect(() => {
    setRoundNamesInput(tournament.round_names?.length ? [...tournament.round_names] : [])
  }, [tournament.round_names])

  useEffect(() => {
    setScoringInput(buildScoringInput(tournament.scoring_config, maxRound))
  }, [tournament.scoring_config, maxRound])

  const handleSave = async () => {
    setSaving(true)
    
    if (tournament.game_type === 'survivor') {
      const packedLocks: Record<number, string> = {}
      for (let i = 1; i <= 6; i++) {
        const iso = inputInTzToISO(roundLocksInput[i], null)
        if (iso) packedLocks[i] = iso
      }

      await onUpdate({
        round_names: roundNamesInput.map(n => n.trim()),
        survivor_elimination_rule: survivorRuleInput,
        round_locks: packedLocks
      })
    } else {
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
    }
    
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

  const inputCls = `${theme.inputBg} border ${theme.borderBase} rounded-lg px-2 py-1 ${theme.textBase} text-xs focus:outline-none focus:border-slate-500 transition-colors`

  const isSurvivor = tournament.game_type === 'survivor'

  return (
    <div className="px-5 border-b border-amber-500/10 bg-amber-500/5 flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[11px] font-bold text-amber-600 dark:text-amber-400/70 hover:text-amber-500 dark:hover:text-amber-300 uppercase tracking-widest transition-colors w-full text-left py-2"
      >
        <Settings2 size={11} />
        Tournament Config
        <span className={`${theme.textMuted} normal-case font-normal tracking-normal ml-1`}>
          {isSurvivor ? 'elimination rules · round locks' : 'scoring · round names · tiebreaker'}
        </span>
        <span className={`ml-auto ${theme.textMuted} transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* SHARED: ROUND NAMES */}
          <div className={`${theme.panelBg} border ${theme.borderBase} rounded-xl p-3`}>
            <h4 className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest mb-1`}>
              Custom Round Names
            </h4>
            <p className={`text-[10px] ${theme.textMuted} mb-2`}>Leave blank to use the default label.</p>
            <div className="space-y-1.5 h-48 overflow-y-auto scrollbar-thin pr-1">
              {Array.from({ length: maxRound }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-[10px] ${theme.textMuted} w-14 flex-shrink-0`}>Round {i + 1}</span>
                  <input
                    value={roundNamesInput[i] ?? ''}
                    onChange={e => {
                      const next = [...roundNamesInput]
                      next[i] = e.target.value
                      setRoundNamesInput(next)
                    }}
                    placeholder={getRoundLabel(i + 1, maxRound)}
                    className={`flex-1 ${inputCls} placeholder:${theme.textMuted}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {!isSurvivor && (
            <>
              {/* STANDARD: SCORING */}
              <div className={`${theme.panelBg} border ${theme.borderBase} rounded-xl p-3`}>
                <h4 className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest mb-2 flex items-center gap-1.5`}>
                  <Hash size={9} /> Points per Round
                </h4>
                <div className="space-y-1.5 h-40 overflow-y-auto scrollbar-thin pr-1">
                  {Array.from({ length: maxRound }, (_, i) => {
                    const r = String(i + 1)
                    return (
                      <div key={r} className="flex items-center gap-2">
                        <span className={`text-[10px] ${theme.textMuted} w-14 flex-shrink-0`}>Round {r}</span>
                        <input
                          type="number" min="0"
                          value={scoringInput[r] ?? ''}
                          onChange={e => setScoringInput(prev => ({ ...prev, [r]: e.target.value }))}
                          className={`w-14 text-center ${inputCls}`}
                        />
                        <span className={`text-[10px] ${theme.textMuted}`}>(fib: {fibonacci(i + 2)})</span>
                      </div>
                    )
                  })}
                </div>
                {tournament.scoring_config && (
                  <button onClick={resetToFibonacci}
                    className="mt-2 text-[10px] text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors">
                    ↺ Reset to Fibonacci
                  </button>
                )}
              </div>

              {/* STANDARD: TIEBREAKER */}
              <div className={`${theme.panelBg} border ${theme.borderBase} rounded-xl p-3`}>
                <h4 className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest mb-2`}>
                  Tie-Breaker
                </h4>
                <p className={`text-[10px] ${theme.textMuted} mb-3`}>
                  Require users to predict the championship game's final score.
                </p>
                <button
                  onClick={() => onUpdate({ requires_tiebreaker: !tournament.requires_tiebreaker })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-bold
                    ${tournament.requires_tiebreaker
                      ? `${theme.bg} ${theme.border} ${theme.accent}`
                      : `${theme.inputBg} ${theme.borderBase} ${theme.textMuted} hover:brightness-95 dark:hover:brightness-110`
                    }`}
                >
                  {tournament.requires_tiebreaker ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {tournament.requires_tiebreaker ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </>
          )}

          {isSurvivor && (
            <>
              {/* SURVIVOR: ROUND LOCKS */}
              <div className={`${theme.panelBg} border ${theme.borderBase} rounded-xl p-3`}>
                <h4 className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest mb-2 flex items-center gap-1.5`}>
                  <CalendarClock size={11} /> Discrete Round Locks
                </h4>
                <p className={`text-[10px] ${theme.textMuted} mb-2`}>
                  Round N+1 opens the moment Round N locks.
                </p>
                <div className="space-y-2 h-40 overflow-y-auto scrollbar-thin pr-1">
                  {Array.from({ length: 6 }, (_, i) => {
                    const r = i + 1
                    return (
                      <div key={r} className="flex flex-col">
                        <label className={`text-[9px] font-bold ${theme.textMuted} uppercase`}>Lock Round {r} At (CT)</label>
                        <input
                          type="datetime-local"
                          value={roundLocksInput[r] ?? ''}
                          onChange={e => setRoundLocksInput(prev => ({ ...prev, [r]: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* SURVIVOR: ELIMINATION RULE */}
              <div className={`${theme.panelBg} border ${theme.borderBase} rounded-xl p-3`}>
                <h4 className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest mb-2 flex items-center gap-1.5`}>
                  <ShieldAlert size={11} /> Mass Elimination Rule
                </h4>
                <p className={`text-[10px] ${theme.textMuted} mb-3`}>
                  If all remaining survivors lose in the same round:
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setSurvivorRuleInput('end_early')}
                    className={`text-left px-3 py-2 rounded-xl border transition-all text-xs font-bold ${
                      survivorRuleInput === 'end_early'
                        ? `${theme.bg} ${theme.border} text-amber-500`
                        : `${theme.inputBg} ${theme.borderBase} ${theme.textMuted}`
                    }`}
                  >
                    End Early (Tiebreaker Applies)
                  </button>
                  <button
                    onClick={() => setSurvivorRuleInput('revive_all')}
                    className={`text-left px-3 py-2 rounded-xl border transition-all text-xs font-bold ${
                      survivorRuleInput === 'revive_all'
                        ? `${theme.bg} border-emerald-500/30 text-emerald-500`
                        : `${theme.inputBg} ${theme.borderBase} ${theme.textMuted}`
                    }`}
                  >
                    Revive All Survivors for Next Round
                  </button>
                </div>
              </div>
            </>
          )}

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