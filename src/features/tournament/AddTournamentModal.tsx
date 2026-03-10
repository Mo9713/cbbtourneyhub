// src/features/tournament/AddTournamentModal.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useTheme } from '../../shared/lib/theme'
import type { TemplateKey } from '../../shared/types'

interface Props {
  onClose: () => void
  onCreate: (name: string, template: TemplateKey, teamCount?: number) => void
}

export default function AddTournamentModal({ onClose, onCreate }: Props) {
  const theme = useTheme()
  const [name,      setName]      = useState('')
  const [template,  setTemplate]  = useState<TemplateKey>('blank')
  const [teamCount, setTeamCount] = useState(16)

  const templates: { key: TemplateKey; label: string; desc: string; icon: string }[] = [
    { key: 'blank',    label: 'Blank Slate',     desc: '0 games — build manually',              icon: '📋' },
    { key: 'standard', label: 'Standard Bracket', desc: '8–32 teams, auto-linked with byes',    icon: '🏆' },
    { key: 'bigdance', label: 'The Big Dance',    desc: '64 teams · 63 games · 4 regions',      icon: '🏀' },
  ]

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate(name.trim(), template, teamCount)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className={`${theme.panelBg} border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide">New Tournament</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Tournament Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="2025 Big East Tournament"
            autoFocus
            className={`w-full ${theme.inputBg} border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors`}
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Template</label>
          <div className="space-y-2">
            {templates.map(t => (
              <button key={t.key} onClick={() => setTemplate(t.key)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  template === t.key
                    ? `${theme.border} ${theme.bg}`
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
                }`}>
                <span className="text-xl">{t.icon}</span>
                <div>
                  <span className={`text-sm font-semibold block ${template === t.key ? theme.accentB : 'text-slate-300'}`}>
                    {t.label}
                  </span>
                  <span className="text-[10px] text-slate-500">{t.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {template === 'standard' && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Team Count
            </label>
            <select
              value={teamCount}
              onChange={e => setTeamCount(Number(e.target.value))}
              className={`w-full ${theme.inputBg} border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors`}>
              {[8, 16, 32].map(n => (
                <option key={n} value={n}>{n} teams</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!name.trim()}
            className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40`}>
            Create Tournament
          </button>
        </div>
      </div>
    </div>
  )
}

