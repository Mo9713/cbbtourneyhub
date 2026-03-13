// src/features/auth/ui/SettingsView/index.tsx

import { useState } from 'react'
import { User as UserIcon, Palette, Key, Check, Image } from 'lucide-react'
import { useTheme, THEMES } from '../../../../shared/lib/theme'

// FIX: We now import ThemeConfig correctly from our FSD types layer
import type { Profile, ToastMsg, ThemeKey, ThemeConfig } from '../../../../shared/types'

import * as authService            from '../../../../shared/infra/authService'
import { useUpdateProfileMutation } from '../../../../entities/profile/model/queries'

interface Props {
  profile:         Profile
  userEmail:       string
  onProfileUpdate: (p: Profile) => void
  push:            (msg: string, type?: ToastMsg['type']) => void
}

export default function SettingsView({ profile, userEmail, onProfileUpdate, push }: Props) {
  const theme = useTheme()

  const [displayName, setDisplayName] = useState(profile.display_name)
  const [avatarUrl,   setAvatarUrl]   = useState(profile.avatar_url ?? '')

  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [changingPass, setChangingPass] = useState(false)

  // ── Profile mutation ──────────────────────────────────────
  const updateProfile = useUpdateProfileMutation(profile.id)

  const save = async () => {
    try {
      const updated = await updateProfile.mutateAsync({
        display_name: displayName.trim() || profile.display_name,
        avatar_url:   avatarUrl.trim()   || null,
      })
      onProfileUpdate(updated)
      push('Profile saved!', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed.', 'error')
    }
  }

  const setThemeKey = async (t: ThemeKey) => {
    try {
      const updated = await updateProfile.mutateAsync({ theme: t })
      onProfileUpdate(updated)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Theme update failed.', 'error')
    }
  }

  // ── Password change ───────────────────────────────────────
  const changePass = async () => {
    if (!currentPass) { push('Enter your current password', 'error'); return }
    if (!newPass || newPass.length < 6) { push('New password must be at least 6 characters', 'error'); return }
    if (newPass !== confirmPass) { push('New passwords do not match', 'error'); return }

    setChangingPass(true)

    const verifyResult = await authService.signInWithPassword(userEmail, currentPass)
    if (!verifyResult.ok) {
      push('Current password is incorrect', 'error')
      setChangingPass(false)
      return
    }

    const updateResult = await authService.updatePassword(newPass)
    if (!updateResult.ok) {
      push(updateResult.error, 'error')
    } else {
      push('Password updated!', 'success')
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    }

    setChangingPass(false)
  }

  const inputCls = `w-full ${theme.inputBg} border ${theme.borderBase} rounded-xl px-3 py-2.5 ${theme.textBase} text-sm placeholder:${theme.textMuted} focus:outline-none focus:border-slate-500 transition-colors`
  const saving   = updateProfile.isPending

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className={`font-display text-3xl font-extrabold ${theme.textBase} uppercase tracking-wide`}>
          Settings
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg space-y-6">

          {/* ── Profile ──────────────────────────────────── */}
          <div className={`${theme.panelBg} border ${theme.borderBase} rounded-2xl p-5`}>
            <h3 className={`font-display text-sm font-bold ${theme.textBase} uppercase tracking-widest mb-4 flex items-center gap-2`}>
              <UserIcon size={12} /> Profile
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`block text-xs ${theme.textMuted} mb-1`}>Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`flex text-xs ${theme.textMuted} mb-1 items-center gap-1.5`}>
                  <Image size={10} /> Avatar Image URL
                </label>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/your-photo.jpg"
                  className={inputCls}
                />
                {avatarUrl.trim() && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={avatarUrl.trim()}
                      alt="Avatar preview"
                      className={`w-10 h-10 rounded-full object-cover border-2 ${theme.borderB}`}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className={`text-[10px] ${theme.textMuted}`}>Preview</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className={`mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40`}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>

          {/* ── Theme ────────────────────────────────────── */}
          <div className={`${theme.panelBg} border ${theme.borderBase} rounded-2xl p-5`}>
            <h3 className={`font-display text-sm font-bold ${theme.textBase} uppercase tracking-widest mb-4 flex items-center gap-2`}>
              <Palette size={12} /> Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(THEMES) as ThemeConfig[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setThemeKey(t.key)}
                  disabled={saving}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all text-left
                    ${profile.theme === t.key
                      ? `${t.border} ${t.bg}`
                      : `${theme.borderBase} ${theme.inputBg} hover:brightness-95 dark:hover:brightness-110`
                    }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <div>
                    <span className={`text-sm font-semibold block ${profile.theme === t.key ? t.accentB : theme.textBase}`}>
                      {t.label}
                    </span>
                    <span className={`text-[10px] ${theme.textMuted}`}>
                      {t.key === 'ember'  ? 'Warm dark'    :
                       t.key === 'ice'    ? 'Cool dark'    :
                       t.key === 'plasma' ? 'Deep violet'  :
                       t.key === 'forest' ? 'Earthy green' : 'Mono gray'}
                    </span>
                  </div>
                  {profile.theme === t.key && (
                    <Check size={13} className={`ml-auto ${t.accent}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Change Password ───────────────────────────── */}
          <div className={`${theme.panelBg} border ${theme.borderBase} rounded-2xl p-5`}>
            <h3 className={`font-display text-sm font-bold ${theme.textBase} uppercase tracking-widest mb-4 flex items-center gap-2`}>
              <Key size={12} /> Change Password
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`block text-xs ${theme.textMuted} mb-1`}>Current Password</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Your current password"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-xs ${theme.textMuted} mb-1`}>New Password</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-xs ${theme.textMuted} mb-1`}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              onClick={changePass}
              disabled={changingPass || !currentPass || !newPass || !confirmPass}
              className={`mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40`}
            >
              {changingPass ? 'Verifying…' : 'Update Password'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}