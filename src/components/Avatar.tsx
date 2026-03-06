// src/components/Avatar.tsx
import { useTheme } from '../utils/theme'
import type { Profile } from '../types'

interface AvatarProps {
  profile: Profile | null
  size?: 'sm' | 'md' | 'lg'
}

export default function Avatar({ profile, size = 'md' }: AvatarProps) {
  const theme = useTheme()
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-9 h-9 text-sm'

  if (profile?.avatar_url) return (
    <img
      src={profile.avatar_url}
      alt={profile.display_name}
      className={`${sz} rounded-full object-cover border-2 ${theme.borderB} flex-shrink-0`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )

  return (
    <div className={`${sz} rounded-full ${theme.btn.split(' ')[0]} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
    </div>
  )
}