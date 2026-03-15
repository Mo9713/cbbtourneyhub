// src/widgets/tournament-bracket/ui/BracketView/ChampionCallout.tsx
import { Crown }    from 'lucide-react'
import { useTheme } from '../../../../shared/lib/theme'

interface Props {
  champion:       string | null
  actualChampion: string | null
  readOnly:       boolean
  ownerName?:     string
}

export default function ChampionCallout({ champion, actualChampion, readOnly, ownerName }: Props) {
  if (!champion) return null

  const theme = useTheme()
  const hasWinner = !!actualChampion

  let borderCls = `border ${theme.borderBase}`
  let textCls   = theme.accent
  let iconCls   = theme.accent

  if (hasWinner) {
    if (champion === actualChampion) {
      borderCls = 'border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
      textCls   = 'text-emerald-500 font-black'
      iconCls   = 'text-emerald-500'
    } else {
      borderCls = 'border-2 border-rose-500/50 bg-rose-500/5'
      textCls   = 'text-rose-500 line-through decoration-2 opacity-80'
      iconCls   = 'text-rose-500 opacity-50'
    }
  }

  return (
    <div className={`${theme.panelBg} ${borderCls} rounded-xl overflow-hidden w-full flex-shrink-0 shadow-sm flex flex-col items-center justify-center p-4 min-h-[7.5rem] transition-all`}>
      <Crown size={24} className={`${iconCls} mb-2`} />
      <p className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-widest mb-1`}>
        {readOnly ? `${ownerName}'s Pick` : 'Your Champion'}
      </p>
      <div className="flex flex-col items-center text-center">
        <p className={`font-display text-lg font-bold uppercase leading-tight ${textCls}`}>
          {champion}
        </p>
        {hasWinner && champion !== actualChampion && (
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1.5 drop-shadow-sm">
            Actual: {actualChampion}
          </p>
        )}
      </div>
    </div>
  )
}