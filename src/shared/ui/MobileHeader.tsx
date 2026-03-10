// src/shared/ui/MobileHeader.tsx
import { Menu } from 'lucide-react'

interface Props {
  onMenuOpen: () => void
  sidebarBg:  string
  logo:       string
}

export default function MobileHeader({ onMenuOpen, sidebarBg, logo }: Props) {
  return (
    <div className={`md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3 border-b border-slate-800 ${sidebarBg}`}>
      <button
        onClick={onMenuOpen}
        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
      >
        <Menu size={20} />
      </button>
      <div className={`w-7 h-7 rounded-lg ${logo} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-xs font-bold">PH</span>
      </div>
      <span className="font-display text-lg font-extrabold text-white uppercase tracking-wide">
        Predictor Hub
      </span>
    </div>
  )
}
