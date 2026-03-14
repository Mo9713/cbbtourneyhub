// src/shared/ui/MobileHeader.tsx
import { Menu } from 'lucide-react'
import { useTheme } from '../lib/theme'

interface Props {
  onMenuOpen: () => void
  sidebarBg?: string
  logo?:      string
}

export default function MobileHeader({ onMenuOpen }: Props) {
  const theme = useTheme()

  return (
    <header className={`md:hidden flex items-center justify-between px-4 h-14 border-b ${theme.borderBase} ${theme.panelBg} shrink-0`}>
      <button
        onClick={onMenuOpen}
        className={`p-2 -ml-2 rounded-lg transition-colors ${theme.textMuted} hover:${theme.textBase} hover:bg-black/5 dark:hover:bg-white/5`}
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-inner bg-slate-200 dark:bg-black/20`}>
          <span className="text-lg leading-none drop-shadow-md">{theme.logo}</span>
        </div>
        <span className={`font-display font-extrabold text-lg tracking-tight uppercase ${theme.textBase}`}>
          TH
        </span>
      </div>
      
      <div className="w-8" aria-hidden /> {/* Spacer for centering */}
    </header>
  )
}