// src/views/SettingsView.tsx
import { useState } from 'react'
import { User as UserIcon, Palette, Key, Check, Image } from 'lucide-react'
import { useTheme, THEMES } from '../utils/theme'
import type { ThemeConfig } from '../utils/theme'
import type { Profile, ToastMsg, ThemeKey } from '../types'

// ── Services ─────────────────────────────────────────────────
import { supabase }         from '../services/supabaseClient'
import * as profileService  from '../services/profileService'

interface Props {
  profile:         Profile
  userEmail:       string
  onProfileUpdate: (p: Profile) => void
  push:            (msg: string, type?: ToastMsg['type']) => void
}

export default function SettingsView({ profile, userEmail, onProfileUpdate, push }: Props) {
  const theme = useTheme()

  const [displayName,  setDisplayName]  = useState(profile.display_name)
  const [avatarUrl,    setAvatarUrl]    = useState(profile.avatar_url ?? '')
  const [saving,       setSaving]       = useState(false)

  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [changingPass, setChangingPass] = useState(false)

  const save = async () => {
    setSaving(true)
    const result = await profileService.updateMyProfile({
      display_name:  displayName.trim() || profile.display_name,
      avatar_url:    avatarUrl.trim() || null,
      // favorite_team removed here
    })
    if (result.ok) {
      onProfileUpdate(result.data)
      push('Profile saved!', 'success')
    } else {
      push(result.error, 'error')
    }
    setSaving(false)
  }

  const changePass = async () => {
    if (!currentPass) { push('Enter your current password', 'error'); return }
    if (!newPass || newPass.length < 6) { push('New password must be at least 6 characters', 'error'); return }
    if (newPass !== confirmPass) { push('New passwords do not match', 'error'); return }

    setChangingPass(true)
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPass })
    if (verifyErr) {
      push('Current password is incorrect', 'error')
      setChangingPass(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) {
      push(error.message, 'error')
    } else {
      push('Password updated!', 'success')
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    }
    setChangingPass(false)
  }

  const setThemeKey = async (t: ThemeKey) => {
    const result = await profileService.updateTheme(t)
    if (result.ok) onProfileUpdate(result.data)
    else push(result.error, 'error')
  }

  const inputCls = `w-full ${theme.inputBg} border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors`

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">Settings</h2>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg space-y-6">

          {/* ── Profile ── */}
          <div className={`${theme.panelBg} border border-slate-800 rounded-2xl p-5`}>
            <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserIcon size={12} /> Profile
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Display Name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                  <Image size={10} /> Avatar Image URL
                </label>
                <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/your-photo.jpg" className={inputCls} />
                {avatarUrl.trim() && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={avatarUrl.trim()} alt="Avatar preview"
                      className={`w-10 h-10 rounded-full object-cover border-2 ${theme.borderB}`}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="text-[10px] text-slate-500">Preview</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={save} disabled={saving}
              className={`mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40`}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>

          {/* ── Theme ── */}
          <div className={`${theme.panelBg} border border-slate-800 rounded-2xl p-5`}>
            <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Palette size={12} /> Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(THEMES) as ThemeConfig[]).map(t => (
                <button key={t.key} onClick={() => setThemeKey(t.key)}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all text-left
                    ${profile.theme === t.key ? `${t.border} ${t.bg}` : 'border-slate-800 hover:border-slate-700 bg-slate-800/40'}`}>
                  <span className="text-xl">{t.emoji}</span>
                  <div>
                    <span className={`text-sm font-semibold block ${profile.theme === t.key ? t.accentB : 'text-slate-300'}`}>
                      {t.label}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {t.key === 'ember' ? 'Warm dark' : t.key === 'ice' ? 'Cool dark' :
                       t.key === 'plasma' ? 'Deep violet' : 'Rich green'}
                    </span>
                  </div>
                  {profile.theme === t.key && <Check size={13} className={`ml-auto ${t.accent}`} />}
                </button>
              ))}
            </div>
          </div>

          {/* ── Change Password ── */}
          <div className={`${theme.panelBg} border border-slate-800 rounded-2xl p-5`}>
            <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Key size={12} /> Change Password
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Current Password</label>
                <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                  placeholder="Your current password" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">New Password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                  placeholder="Minimum 6 characters" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Confirm New Password</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Repeat new password" className={inputCls} />
              </div>
            </div>
            <button onClick={changePass}
              disabled={changingPass || !currentPass || !newPass || !confirmPass}
              className={`mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40`}>
              {changingPass ? 'Verifying…' : 'Update Password'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}