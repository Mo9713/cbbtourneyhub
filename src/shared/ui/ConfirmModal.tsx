// src/shared/ui/ConfirmModal.tsx
import { AlertCircle } from 'lucide-react'
import type { ConfirmModalCfg } from '../types'

export default function ConfirmModal({
  title, message, confirmLabel = 'Confirm', dangerous, onConfirm, onCancel,
}: ConfirmModalCfg) {
  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onCancel}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${dangerous ? 'bg-rose-500/15' : 'bg-amber-500/15'}`}>
            <AlertCircle size={18} className={dangerous ? 'text-rose-400' : 'text-amber-400'} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white text-sm font-bold transition-all ${
              dangerous ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}



