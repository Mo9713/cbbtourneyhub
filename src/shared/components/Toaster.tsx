// src/components/Toaster.tsx
import { Check, X, Zap } from 'lucide-react'
import type { ToastMsg } from '../types'

export default function Toaster({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border shadow-2xl text-sm font-medium text-white
            backdrop-blur-md bg-slate-800/90
            ${t.type === 'error' ? 'border-rose-500/40' : t.type === 'success' ? 'border-emerald-500/40' : 'border-slate-600'}`}
          style={{ animation: 'slideUp 0.25s ease-out' }}>
          {t.type === 'success' && <Check size={14} className="text-emerald-400" />}
          {t.type === 'error'   && <X     size={14} className="text-rose-400" />}
          {t.type === 'info'    && <Zap   size={14} className="text-sky-400" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}