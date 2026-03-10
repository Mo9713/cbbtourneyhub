// src/features/bracket/ui/BracketView/ChampionCallout.tsx
import { Crown }    from 'lucide-react'
import { useTheme } from '../../../../shared/lib/theme'

interface Props {
  champion:  string | null
  readOnly:  boolean
  ownerName?: string
}

export default function ChampionCallout({ champion, readOnly, ownerName }: Props) {
  if (!champion) return null

  const theme = useTheme()

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800/80 rounded-xl overflow-hidden w-full flex-shrink-0 shadow-sm flex flex-col items-center justify-center p-4 min-h-[7.5rem]">
      <Crown size={24} className={`${theme.accent} mb-2`} />
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
        {readOnly ? `${ownerName}'s Pick` : 'Your Champion'}
      </p>
      <p className={`text-center font-display text-lg font-bold uppercase leading-tight ${theme.accent}`}>
        {champion}
      </p>
    </div>
  )
}