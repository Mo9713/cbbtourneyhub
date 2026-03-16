// src/shared/ui/MobileHeader.tsx

import { PanelLeft }      from 'lucide-react'
import { useTheme }       from '../lib/theme'
import { useAuth }        from '../../features/auth'
import Avatar             from './Avatar'
import { useUIStore }     from '../store/uiStore'

interface Props {
  onMenuOpen: () => void
  sidebarBg?: string
  logo?: string
}

// FIX: Removed sidebarBg from the destructured arguments here so TS doesn't flag it as unused
export default function MobileHeader({ onMenuOpen, logo }: Props) {
  const theme = useTheme()
  const { profile } = useAuth()
  const setActiveView = useUIStore(s => s.setActiveView)
  const selectTournament = useUIStore(s => s.selectTournament)

  return (
    <div className={`md:hidden flex items-center justify-between px-4 py-3 border-b ${theme.borderBase} ${theme.headerBg} sticky top-0 z-40 shadow-sm`}>
      <div className="flex items-center gap-3 h-8">
        <button 
          onClick={onMenuOpen}
          className={`p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors`}
        >
          <PanelLeft size={20} />
        </button>
        
        <img 
          src={logo || "/logo.png"} 
          alt="TourneyHub Logo" 
          className="h-6 w-auto object-contain drop-shadow-sm" 
        />
      </div>

      <button 
        onClick={() => { selectTournament(null); setActiveView('settings') }}
        className="flex-shrink-0 transition-transform active:scale-95"
      >
        <Avatar profile={profile} size="sm" />
      </button>
    </div>
  )
}