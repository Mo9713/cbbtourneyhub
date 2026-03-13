// src/features/auth/ui/AuthForm.tsx

import { useState } from 'react'
import { Trophy, Zap } from 'lucide-react'
import * as authService from '../../../shared/infra/authService'

type AuthMode = 'signin' | 'signup' | 'forgot'

export default function AuthForm({ onAuth }: { onAuth: () => void }) {
  const [mode,     setMode]     = useState<AuthMode>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  const switchMode = (m: AuthMode) => {
    setMode(m)
    setError(null)
    setSuccess(null)
  }

  const submit = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('Display name is required'); return }
        const result = await authService.signUp(email, password, name)
        if (!result.ok) { setError(result.error); return }
        setSuccess('Check your email to confirm your account!')

      } else if (mode === 'signin') {
        const result = await authService.signInWithPassword(email, password)
        if (!result.ok) { setError(result.error); return }
        onAuth()

      } else {
        const result = await authService.resetPasswordForEmail(email)
        if (!result.ok) { setError(result.error); return }
        setSuccess('Password reset email sent!')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0905] flex items-center justify-center p-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Barlow Condensed', sans-serif }
      `}</style>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/30">
            <Trophy size={26} className="text-white" />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">
            Predictor Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1">Conference Basketball Picks</p>
        </div>

        <div className="bg-[#150e08] border border-slate-800 rounded-2xl p-6">
          {/* ── Mode tabs ── */}
          <div className="flex gap-1 mb-5 bg-slate-900/60 rounded-xl p-1">
            {(['signin', 'signup'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mode === m
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* ── Fields ── */}
          <div className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#1c140a] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#1c140a] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full bg-[#1c140a] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* ── Feedback ── */}
          {error && (
            <p className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-3 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          {/* ── Submit ── */}
          <button
            onClick={submit}
            disabled={loading}
            className="mt-4 w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Zap size={14} />
            {loading
              ? 'Loading…'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>

          {/* ── Aux navigation ── */}
          <div className="mt-4 text-center">
            {mode === 'signin' && (
              <button
                onClick={() => switchMode('forgot')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button
                onClick={() => switchMode('signin')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 mx-auto"
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}