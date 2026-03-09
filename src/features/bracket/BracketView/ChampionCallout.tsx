// src/views/BracketView/ChampionCallout.tsx
import { Crown } from 'lucide-react'
import { useTheme } from '../../utils/theme'

interface Props {
  /** null = user has not yet picked the championship game → render nothing. */
  champion:  string | null
  readOnly:  boolean
  ownerName?: string
}

// Returns null when champion is null, which is the visual half of the
// Premature Champion fix. The logic half lives in BracketView/index.tsx.
export default function ChampionCallout({ champion, readOnly, ownerName }: Props) {
  if (!champion) return null

  const theme = useTheme()

  return (
    <div className="flex-shrink-0 px-6 pb-6 flex justify-center">
      <div className={`flex flex-col items-center gap-2 p-5 rounded-2xl border w-full max-w-xs
        ${theme.bg} ${theme.border}`}>
        <Crown size={20} className={theme.accent} />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {readOnly ? `${ownerName}'s Champion` : 'Your Champion'}
        </p>
        <p className={`font-display text-2xl font-extrabold uppercase tracking-wide ${theme.accent}`}>
          {champion}
        </p>
      </div>
    </div>
  )
}
