// src/components/Avatar.tsx
import { useTheme } from '../utils/theme'
import type { Profile } from '../types'

interface AvatarProps {
  profile:   Profile | null
  size?:     'sm' | 'md' | 'lg'
  /** When true and profile.favorite_team exists, renders a small team badge below. */
  showTeam?: boolean
}

export default function Avatar({ profile, size = 'md', showTeam = false }: AvatarProps) {
  const theme = useTheme()
  const sz    = size === 'sm' ? 'w-7 h-7 text-xs'
              : size === 'lg' ? 'w-14 h-14 text-xl'
              : 'w-9 h-9 text-sm'

  const img = profile?.avatar_url
    ? (
      <img
        src={profile.avatar_url}
        alt={profile.display_name}
        className={`${sz} rounded-full object-cover border-2 ${theme.borderB} flex-shrink-0`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    ) : (
      <div className={`${sz} rounded-full ${theme.btn.split(' ')[0]} flex items-center justify-center font-bold text-white flex-shrink-0`}>
        {profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
      </div>
    )

  if (!showTeam || !profile?.favorite_team) return img

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      {img}
      <span
        className={`text-[9px] font-semibold leading-none truncate max-w-[4.5rem] px-1.5 py-0.5 rounded ${theme.bg} ${theme.accent}`}
        title={profile.favorite_team}
      >
        {profile.favorite_team}
      </span>
    </div>
  )
}
