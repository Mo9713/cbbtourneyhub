// src/features/tournament/AdminBuilderView/AdminHeader.tsx
import { useState, useEffect } from 'react'
import {
  Plus, Lock, Globe, AlertTriangle, Edit3,
  RefreshCw, Trash2, X, ChevronRight,
} from 'lucide-react'
import { isoToInputCST, cstInputToISO } from '../../../shared/utils/time'
import type { Tournament, Game }        from '../../../shared/types'

interface Props {
  tournament:         Tournament
  games:              Game[]
  publishValid:       boolean
  onRename:           (name: string) => void
  onUpdate:           (updates: Partial<Tournament>) => void
  onPublish:          () => void
  onLock:             () => void
  onAddNextRound:     () => void
  onReload:           () => void
  onDeleteTournament: () => void
}

export default function AdminHeader({
  tournament, publishValid,
  onRename, onUpdate, onPublish, onLock,
  onAddNextRound, onReload, onDeleteTournament,
}: Props) {
  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState(tournament.name)
  const [unlocksAtInput, setUnlocksAtInput] = useState(isoToInputCST(tournament.unlocks_at))
  const [locksAtInput,   setLocksAtInput]   = useState(isoToInputCST(tournament.locks_at))
  const [savedTime,      setSavedTime]      = useState(false)

  // Sync date inputs when tournament updates externally (realtime)
  useEffect(() => { setUnlocksAtInput(isoToInputCST(tournament.unlocks_at)) }, [tournament.unlocks_at])
  useEffect(() => { setLocksAtInput(isoToInputCST(tournament.locks_at))     }, [tournament.locks_at])

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onRename(nameInput.trim() || tournament.name)
    setEditingName(false)
  }

  const handleSaveTipOff = () => {
    onUpdate({
      unlocks_at: cstInputToISO(unlocksAtInput),
      locks_at:   cstInputToISO(locksAtInput),
    })
    setSavedTime(true)
    setTimeout(() => setSavedTime(false), 2000)
  }

  const inputCls = 'bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors'

  return (
    <div className="px-5 py-3 border-b border-amber-500/10 bg-amber-500/5 flex-shrink-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">

        {/* ── Left: title + status ── */}
        <div>
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {editingName ? (
              <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                  className="bg-slate-800 border border-amber-500/40 rounded-lg px-2 py-1 text-white text-sm font-bold focus:outline-none"
                />
                <button type="submit"
                  className="p-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 transition-all">
                  <ChevronRight size={12} />
                </button>
                <button type="button" onClick={() => setEditingName(false)}
                  className="p-1 rounded text-slate-500 hover:text-white transition-all">
                  <X size={12} />
                </button>
              </form>
            ) : (
              <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 group">
                <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide group-hover:text-amber-300 transition-colors">
                  {tournament.name}
                </h2>
                <Edit3 size={12} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
              </button>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest
              ${tournament.status === 'draft' ? 'bg-amber-500/20 text-amber-400'  :
                tournament.status === 'open'  ? 'bg-emerald-500/20 text-emerald-400' :
                                                'bg-slate-700 text-slate-400'}`}>
              {tournament.status}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Click output dot → input dot to link. Drag cards to reorder.{' '}
            <kbd className="text-slate-600 bg-slate-800 px-1 rounded text-[9px]">Esc</kbd> cancels linking.
          </p>
        </div>

        {/* ── Right: schedule + actions ── */}
        <div className="flex items-start gap-4 flex-wrap">

          {/* Tip-off window */}
          <div className="flex items-end gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Unlocks At (CT)
              </label>
              <input type="datetime-local" value={unlocksAtInput}
                onChange={e => setUnlocksAtInput(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Locks At (CT)
              </label>
              <input type="datetime-local" value={locksAtInput}
                onChange={e => setLocksAtInput(e.target.value)}
                className={inputCls} />
            </div>
            <button onClick={handleSaveTipOff}
              className={`px-3 py-1.5 text-white rounded-lg text-[10px] font-bold transition-all self-end
                ${savedTime ? 'bg-emerald-600 border border-emerald-500' : 'bg-amber-600/80 hover:bg-amber-600'}`}>
              {savedTime ? 'Saved!' : 'Save'}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onReload} title="Reload games"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
              <RefreshCw size={12} />
            </button>
            <button onClick={onAddNextRound}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">
              <Plus size={11} /> Add Next Round
            </button>

            {tournament.status === 'draft' && (
              <div className="flex items-center gap-1.5">
                {!publishValid && (
                  <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                    <AlertTriangle size={10} />
                    <span className="text-[10px] font-semibold">Unlinked games</span>
                  </div>
                )}
                <button onClick={onPublish} disabled={!publishValid}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Globe size={11} /> Publish
                </button>
              </div>
            )}

            {tournament.status === 'open' && (
              <button onClick={onLock}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-bold transition-all">
                <Lock size={11} /> Lock
              </button>
            )}

            <button onClick={onDeleteTournament}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all">
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}






