// ============================================================
// COLLEGE BASKETBALL CONFERENCE PREDICTOR HUB — V6
// App.tsx · React + Supabase + Tailwind CSS + lucide-react
//
// .env.local:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
//
// DB: Requires `sort_order INT` column on games table
// ============================================================

import { createClient, User } from '@supabase/supabase-js'
import {
  useState, useEffect, useCallback, useMemo,
  createContext, useContext, useRef, useLayoutEffect,
} from 'react'
import {
  Trophy, Plus, Lock, Globe, AlertTriangle, LogOut,
  Edit3, Link2, CheckCircle, Circle, Crown, Target, X,
  Zap, Settings, Shield, RefreshCw, BarChart2, Home,
  User as UserIcon, Palette, Key, Image, ChevronRight,
  TrendingUp, EyeOff, Check, ExternalLink, Trash2,
  Unlink, AlertCircle, Eye, GripVertical,
} from 'lucide-react'

// ── Supabase ──────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

// ── Types ─────────────────────────────────────────────────────
type TournamentStatus = 'draft' | 'open' | 'locked'
type ThemeKey = 'ember' | 'ice' | 'plasma' | 'forest'
type ActiveView = 'home' | 'bracket' | 'leaderboard' | 'admin' | 'settings'
type TemplateKey = 'blank' | 'standard' | 'bigdance'

interface Profile {
  id: string; display_name: string; is_admin: boolean
  theme: ThemeKey; avatar_url: string | null; favorite_team: string | null
}
interface Tournament { id: string; name: string; status: TournamentStatus }
interface Game {
  id: string; tournament_id: string; round_num: number
  team1_name: string; team2_name: string; actual_winner: string | null
  next_game_id: string | null; sort_order: number | null
  region?: string | null
}
interface Pick { id: string; user_id: string; game_id: string; predicted_winner: string }

interface ConfirmModalCfg {
  title: string; message: string
  confirmLabel?: string; dangerous?: boolean
  onConfirm: () => void; onCancel: () => void
}

// ── Theme System ──────────────────────────────────────────────
interface ThemeConfig {
  key: ThemeKey; label: string; emoji: string
  btn: string; btnSm: string; accent: string; accentB: string
  border: string; borderB: string; bg: string; bgMd: string
  dot: string; ring: string; bar: string; glow: string
  tabActive: string; headerBg: string; logo: string
}

const THEMES: Record<ThemeKey, ThemeConfig> = {
  ember: {
    key: 'ember', label: 'Ember', emoji: '🔥',
    btn: 'bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-600/25',
    btnSm: 'bg-orange-600 hover:bg-orange-500',
    accent: 'text-orange-400', accentB: 'text-orange-300',
    border: 'border-orange-500/40', borderB: 'border-orange-400',
    bg: 'bg-orange-600/10', bgMd: 'bg-orange-600/20',
    dot: 'bg-orange-400', ring: 'ring-orange-500',
    bar: 'bg-orange-500', glow: 'shadow-orange-500/20',
    tabActive: 'border-orange-500 text-orange-400',
    headerBg: 'bg-orange-500/5 border-orange-500/20', logo: 'bg-orange-600',
  },
  ice: {
    key: 'ice', label: 'Ice', emoji: '🧊',
    btn: 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/25',
    btnSm: 'bg-cyan-600 hover:bg-cyan-500',
    accent: 'text-cyan-400', accentB: 'text-cyan-300',
    border: 'border-cyan-500/40', borderB: 'border-cyan-400',
    bg: 'bg-cyan-600/10', bgMd: 'bg-cyan-600/20',
    dot: 'bg-cyan-400', ring: 'ring-cyan-500',
    bar: 'bg-cyan-500', glow: 'shadow-cyan-500/20',
    tabActive: 'border-cyan-500 text-cyan-400',
    headerBg: 'bg-cyan-500/5 border-cyan-500/20', logo: 'bg-cyan-600',
  },
  plasma: {
    key: 'plasma', label: 'Plasma', emoji: '⚡',
    btn: 'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/25',
    btnSm: 'bg-violet-600 hover:bg-violet-500',
    accent: 'text-violet-400', accentB: 'text-violet-300',
    border: 'border-violet-500/40', borderB: 'border-violet-400',
    bg: 'bg-violet-600/10', bgMd: 'bg-violet-600/20',
    dot: 'bg-violet-400', ring: 'ring-violet-500',
    bar: 'bg-violet-500', glow: 'shadow-violet-500/20',
    tabActive: 'border-violet-500 text-violet-400',
    headerBg: 'bg-violet-500/5 border-violet-500/20', logo: 'bg-violet-600',
  },
  forest: {
    key: 'forest', label: 'Forest', emoji: '🌲',
    btn: 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25',
    btnSm: 'bg-emerald-600 hover:bg-emerald-500',
    accent: 'text-emerald-400', accentB: 'text-emerald-300',
    border: 'border-emerald-500/40', borderB: 'border-emerald-400',
    bg: 'bg-emerald-600/10', bgMd: 'bg-emerald-600/20',
    dot: 'bg-emerald-400', ring: 'ring-emerald-500',
    bar: 'bg-emerald-500', glow: 'shadow-emerald-500/20',
    tabActive: 'border-emerald-500 text-emerald-400',
    headerBg: 'bg-emerald-500/5 border-emerald-500/20', logo: 'bg-emerald-600',
  },
}

const ThemeCtx = createContext<ThemeConfig>(THEMES.ember)
const useTheme = () => useContext(ThemeCtx)

// ── Scoring & Helpers ─────────────────────────────────────────
// FIX: True Fibonacci function — no hardcoded cap; R1=1, R2=2, R3=3, R4=5, R5=8, R6=13, R7=21, R8=34…
function fibonacci(n: number): number {
  if (n <= 0) return 0
  if (n === 1 || n === 2) return 1
  let a = 1, b = 1
  for (let i = 3; i <= n; i++) { const c = a + b; a = b; b = c }
  return b
}
// round r → fib(r + 1): r=1→fib(2)=1, r=2→fib(3)=2, r=3→fib(4)=3, r=4→fib(5)=5 …
const getScore = (r: number) => fibonacci(r + 1)

// FIX: Correct naming for 2-round tournaments. gap=1 is always "Semifinals".
function getRoundLabel(roundNum: number, maxRound: number): string {
  const gap = maxRound - roundNum
  if (gap === 0) return 'Championship'
  if (gap === 1) return 'Semifinals'
  if (gap === 2) return 'Quarterfinals'
  if (roundNum === 1) return 'First Round'
  if (roundNum === 2) return 'Second Round'
  return `Round ${roundNum}`
}

const isTBDName = (n: string) =>
  !n || n === 'TBD' || n === 'BYE' || n.startsWith('Winner of Game')

const statusDot = (s: TournamentStatus) =>
  s === 'open' ? 'bg-emerald-400' : s === 'draft' ? 'bg-amber-400' : 'bg-slate-600'
const statusLabel = (s: TournamentStatus) =>
  s === 'open' ? 'Open' : s === 'draft' ? 'Draft' : 'Locked'
const statusIcon = (s: TournamentStatus) =>
  s === 'open'   ? <Globe  size={11} className="text-emerald-400" /> :
  s === 'draft'  ? <Edit3  size={11} className="text-amber-400" /> :
                   <Lock   size={11} className="text-slate-500" />

function computeGameNumbers(games: Game[]): Record<string, number> {
  const sorted = [...games].sort((a, b) =>
    a.round_num !== b.round_num ? a.round_num - b.round_num : a.id.localeCompare(b.id)
  )
  const map: Record<string, number> = {}
  sorted.forEach((g, i) => { map[g.id] = i + 1 })
  return map
}

const BD_REGIONS = ['East', 'West', 'South', 'Midwest', 'Final Four']

// ── Toast ─────────────────────────────────────────────────────
interface ToastMsg { id: number; text: string; type: 'success' | 'error' | 'info' }
function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, text, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])
  return { toasts, push }
}
function Toaster({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border shadow-2xl text-sm font-medium text-white
            backdrop-blur-md bg-slate-800/90
            ${t.type === 'error' ? 'border-rose-500/40' : t.type === 'success' ? 'border-emerald-500/40' : 'border-slate-600'}`}
          style={{ animation: 'slideUp 0.25s ease-out' }}>
          {t.type === 'success' && <Check size={14} className="text-emerald-400" />}
          {t.type === 'error'   && <X     size={14} className="text-rose-400" />}
          {t.type === 'info'    && <Zap   size={14} className="text-sky-400" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ profile, size = 'md' }: { profile: Profile | null; size?: 'sm' | 'md' | 'lg' }) {
  const theme = useTheme()
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-9 h-9 text-sm'
  if (profile?.avatar_url) return (
    <img src={profile.avatar_url} alt={profile.display_name}
      className={`${sz} rounded-full object-cover border-2 ${theme.borderB} flex-shrink-0`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  )
  return (
    <div className={`${sz} rounded-full ${theme.btn.split(' ')[0]} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Confirm', dangerous, onConfirm, onCancel }: ConfirmModalCfg) {
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${dangerous ? 'bg-rose-500/15' : 'bg-amber-500/15'}`}>
            <AlertCircle size={18} className={dangerous ? 'text-rose-400' : 'text-amber-400'} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white text-sm font-bold transition-all ${
              dangerous ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Tournament Modal ──────────────────────────────────────
function AddTournamentModal({
  onClose, onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, template: TemplateKey, teamCount?: number) => void
}) {
  const theme = useTheme()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<TemplateKey>('blank')
  const [teamCount, setTeamCount] = useState(16)

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate(name.trim(), template, teamCount)
    onClose()
  }

  const templates: { key: TemplateKey; label: string; desc: string; icon: string }[] = [
    { key: 'blank', label: 'Blank Slate', desc: '0 games — build manually', icon: '📋' },
    { key: 'standard', label: 'Standard Bracket', desc: '8–32 teams, auto-linked with byes', icon: '🏆' },
    { key: 'bigdance', label: 'The Big Dance', desc: '64 teams · 63 games · 4 regions', icon: '🏀' },
  ]

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide">New Tournament</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Tournament Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="2025 Big East Tournament"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            autoFocus />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Template</label>
          <div className="space-y-2">
            {templates.map(t => (
              <button key={t.key} onClick={() => setTemplate(t.key)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  template === t.key
                    ? `${theme.border} ${theme.bg}`
                    : 'border-slate-800 hover:border-slate-700 bg-slate-800/40'
                }`}>
                <span className="text-xl">{t.icon}</span>
                <div>
                  <div className={`font-semibold text-sm ${template === t.key ? theme.accentB : 'text-slate-200'}`}>{t.label}</div>
                  <div className="text-[11px] text-slate-500">{t.desc}</div>
                </div>
                {template === t.key && <Check size={14} className={`ml-auto flex-shrink-0 ${theme.accent}`} />}
              </button>
            ))}
          </div>
        </div>

        {template === 'standard' && (
          <div className="mb-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Team Count: <span className={theme.accent}>{teamCount}</span>
            </label>
            <input type="range" min={4} max={32} value={teamCount} onChange={e => setTeamCount(+e.target.value)}
              className="w-full accent-orange-500" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>4</span><span>8</span><span>16</span><span>24</span><span>32</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!name.trim()}
            className={`px-5 py-2 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40 disabled:cursor-not-allowed`}>
            Create Tournament
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Auth Form ─────────────────────────────────────────────────
function AuthForm({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode]       = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setError(''); setSuccess(''); setLoading(true)
    if (mode === 'signup') {
      const { error: e } = await supabase.auth.signUp({ email, password: pass,
        options: { data: { display_name: name || email.split('@')[0] } } })
      if (e) setError(e.message)
      else setSuccess('Check your email to confirm your account.')
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (e) setError(e.message)
      else onAuth()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/25">
            <Trophy size={28} className="text-white" />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">Predictor Hub</h1>
          <p className="text-slate-500 text-sm mt-1">Conference Basketball</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex gap-1 mb-5 bg-slate-800 p-1 rounded-xl">
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === 'signup' && (
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Display name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="Password" onKeyDown={e => e.key === 'Enter' && handle()}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
          </div>

          {error   && <p className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="mt-3 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{success}</p>}

          <button onClick={handle} disabled={loading || !email || !pass}
            className="mt-4 w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-600/25">
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Home View ─────────────────────────────────────────────────
function HomeView({ tournaments, profile, allGames, picks, onSelectTournament }: {
  tournaments: Tournament[]; profile: Profile
  allGames: Record<string, Game[]>; picks: Pick[]
  onSelectTournament: (t: Tournament) => void
}) {
  const theme = useTheme()
  const open   = tournaments.filter(t => t.status === 'open')
  const draft  = tournaments.filter(t => t.status === 'draft')
  const locked = tournaments.filter(t => t.status === 'locked')

  const pickMap = useMemo(() => {
    const m: Record<string, number> = {}
    picks.forEach(p => {
      const g = Object.values(allGames).flat().find(g => g.id === p.game_id)
      if (g) m[g.tournament_id] = (m[g.tournament_id] ?? 0) + 1
    })
    return m
  }, [picks, allGames])

  const Card = ({ t }: { t: Tournament }) => {
    const games = allGames[t.id] ?? []
    const myPicks = pickMap[t.id] ?? 0
    const pct = games.length > 0 ? Math.round((myPicks / games.length) * 100) : 0
    return (
      <button onClick={() => onSelectTournament(t)}
        className={`text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.99] w-full
          ${t.status === 'open' ? `${theme.border} ${theme.bg} shadow-lg ${theme.glow}` : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide leading-tight">{t.name}</h3>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${statusDot(t.status)} ${t.status === 'open' ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          {statusIcon(t.status)}
          <span className="text-xs text-slate-400">{statusLabel(t.status)}</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-500">{games.length} games</span>
        </div>
        {t.status === 'open' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500">Your picks</span>
              <span className={`text-[10px] font-bold ${theme.accent}`}>{myPicks}/{games.length}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${theme.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-5 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">Welcome back</h2>
        <p className="text-slate-400 text-sm mt-0.5">{profile.display_name} · Pick your winners</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <Trophy size={48} className="mb-4 opacity-20" />
            <p className="text-sm">No tournaments yet.{profile.is_admin ? ' Create one to get started.' : ''}</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            {open.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Open for Picks</h3>
                <div className="grid gap-3 sm:grid-cols-2">{open.map(t => <Card key={t.id} t={t} />)}</div>
              </div>
            )}
            {locked.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Locked</h3>
                <div className="grid gap-3 sm:grid-cols-2">{locked.map(t => <Card key={t.id} t={t} />)}</div>
              </div>
            )}
            {draft.length > 0 && profile.is_admin && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Drafts (Admin Only)</h3>
                <div className="grid gap-3 sm:grid-cols-2">{draft.map(t => <Card key={t.id} t={t} />)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Settings View ─────────────────────────────────────────────
function SettingsView({ profile, onProfileUpdate, push }: {
  profile: Profile; onProfileUpdate: (p: Profile) => void; push: (msg: string, type?: ToastMsg['type']) => void
}) {
  const theme = useTheme()
  const [displayName,   setDisplayName]   = useState(profile.display_name)
  const [favoriteTeam,  setFavoriteTeam]  = useState(profile.favorite_team ?? '')
  const [avatarUrl,     setAvatarUrl]     = useState(profile.avatar_url ?? '')
  const [newPass,       setNewPass]       = useState('')
  const [saving,        setSaving]        = useState(false)

  const save = async () => {
    setSaving(true)
    const updates: Partial<Profile> = {
      display_name: displayName.trim() || profile.display_name,
      favorite_team: favoriteTeam.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }
    const { data } = await supabase.from('profiles').update(updates).eq('id', profile.id).select().single()
    if (data) { onProfileUpdate(data as Profile); push('Profile saved!', 'success') }
    setSaving(false)
  }

  const changePass = async () => {
    if (!newPass || newPass.length < 6) { push('Password must be ≥6 chars', 'error'); return }
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) push(error.message, 'error')
    else { push('Password updated!', 'success'); setNewPass('') }
  }

  const setTheme = async (t: ThemeKey) => {
    await supabase.from('profiles').update({ theme: t }).eq('id', profile.id)
    onProfileUpdate({ ...profile, theme: t })
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">Settings</h2>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg space-y-6">
          {/* Profile */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserIcon size={12} /> Profile
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Display Name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Favorite Team</label>
                <input value={favoriteTeam} onChange={e => setFavoriteTeam(e.target.value)} placeholder="e.g. Duke Blue Devils"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Image size={9} /> Avatar URL</label>
                <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
              </div>
            </div>
            <button onClick={save} disabled={saving}
              className={`mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${theme.btn} disabled:opacity-40`}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>

          {/* Theme */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Palette size={12} /> Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(THEMES) as ThemeConfig[]).map(t => (
                <button key={t.key} onClick={() => setTheme(t.key)}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all text-left
                    ${profile.theme === t.key ? `${t.border} ${t.bg}` : 'border-slate-800 hover:border-slate-700 bg-slate-800/40'}`}>
                  <span className="text-xl">{t.emoji}</span>
                  <span className={`text-sm font-semibold ${profile.theme === t.key ? t.accentB : 'text-slate-300'}`}>{t.label}</span>
                  {profile.theme === t.key && <Check size={13} className={`ml-auto ${t.accent}`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Key size={12} /> Security
            </h3>
            <div className="flex gap-2">
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
              <button onClick={changePass}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-all flex-shrink-0">
                Update
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Game Card (player-facing) — FIX: scores removed entirely ──
function GameCard({ game, userPick, effectiveTeam1, effectiveTeam2, isLocked, onPick, readOnly, ownerName }: {
  game: Game; userPick: Pick | undefined
  effectiveTeam1: string; effectiveTeam2: string
  isLocked: boolean; onPick: (game: Game, team: string) => void
  readOnly?: boolean; ownerName?: string
}) {
  const theme = useTheme()
  const teams = [
    { name: effectiveTeam1, key: 'team1' as const },
    { name: effectiveTeam2, key: 'team2' as const },
  ]

  return (
    <div className="relative bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl overflow-hidden w-52 flex-shrink-0 shadow-lg hover:border-slate-700 transition-all">
      <div className="px-3 py-1.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{getScore(game.round_num)}pt · R{game.round_num}</span>
        <div className="flex items-center gap-1.5">
          {game.actual_winner && <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle size={9} /> Final</span>}
          {!game.actual_winner && userPick && <span className={`text-[10px] font-semibold uppercase tracking-widest ${theme.accent}`}>Picked</span>}
          {readOnly && <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1"><EyeOff size={9} /> View</span>}
        </div>
      </div>

      {teams.map(({ name, key }) => {
        const isPicked    = userPick?.predicted_winner === name
        const isWinner    = game.actual_winner === name
        const isLoser     = !!(game.actual_winner && game.actual_winner !== name)
        const isTBD       = isTBDName(name)
        const pickedWrong = isPicked && isLoser
        return (
          <button key={key}
            disabled={isLocked || isTBD || !!game.actual_winner || readOnly}
            onClick={() => !isTBD && !readOnly && onPick(game, name)}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-all group
              ${isTBD || readOnly ? 'cursor-default' : 'cursor-pointer'}
              ${isWinner ? 'bg-emerald-500/15 border-l-2 border-l-emerald-400' : ''}
              ${pickedWrong ? 'bg-rose-500/10 border-l-2 border-l-rose-500' : ''}
              ${isPicked && !game.actual_winner ? `${theme.bg} border-l-2 ${theme.borderB.replace('border-', 'border-l-')}` : ''}
              ${!isPicked && !isWinner && !isTBD && !isLocked && !game.actual_winner && !readOnly ? 'hover:bg-slate-800/80' : ''}
            `}>
            <div className="flex-shrink-0 w-3.5">
              {isWinner    && <CheckCircle size={13} className="text-emerald-400" />}
              {pickedWrong && <X           size={13} className="text-rose-400" />}
              {isPicked && !game.actual_winner && <Circle size={13} className={`${theme.accent} fill-current`} />}
              {!isPicked && !isWinner && <Circle size={13} className="text-slate-700 group-hover:text-slate-500 transition-colors" />}
            </div>
            <span className={`flex-1 text-sm font-semibold truncate leading-tight ${
              isTBD       ? 'text-slate-600 italic' :
              isWinner    ? 'text-emerald-300' :
              pickedWrong ? 'text-rose-300/60 line-through' :
              isPicked    ? theme.accentB :
                            'text-slate-200 group-hover:text-white transition-colors'
            }`}>{isTBD ? '—' : name}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Bracket View ──────────────────────────────────────────────
function BracketView({ tournament, games, picks, profile, onPick, readOnly, ownerName }: {
  tournament: Tournament; games: Game[]; picks: Pick[]; profile: Profile
  onPick: (game: Game, team: string) => void
  readOnly?: boolean; ownerName?: string
}) {
  const theme = useTheme()
  const isLocked = tournament.status === 'locked' || tournament.status === 'draft'
  const isBigDance = games.some(g => g.region)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const displayGames = useMemo(() => {
    if (!isBigDance || !selectedRegion) return games
    return games.filter(g => g.region === selectedRegion)
  }, [games, isBigDance, selectedRegion])

  const effectiveNames = useMemo(() => {
    const names: Record<string, { team1: string; team2: string }> = {}
    games.forEach(g => { names[g.id] = { team1: g.team1_name, team2: g.team2_name } })
    const pickMap = new Map(picks.map(p => [p.game_id, p.predicted_winner]))
    // FIX: compute game numbers so we can look up the actual linked slot by "Winner of Game #N" text
    const gameNums = computeGameNumbers(games)
    const sorted = [...games].sort((a, b) => a.round_num - b.round_num)
    for (const game of sorted) {
      if (!game.next_game_id) continue
      const winner = game.actual_winner ?? pickMap.get(game.id)
      if (!winner) continue
      const nextGame = games.find(g => g.id === game.next_game_id)
      if (!nextGame) continue
      // FIX: determine slot by checking which slot contains "Winner of Game #N" text,
      // NOT by sort order — sort order was wrong when admin linked to bottom slot with top slot pre-filled
      const gNum = gameNums[game.id]
      const winnerText = `Winner of Game #${gNum}`
      let slot: 'team1' | 'team2'
      if (nextGame.team1_name === winnerText) slot = 'team1'
      else if (nextGame.team2_name === winnerText) slot = 'team2'
      else {
        // Fallback for games without linkage text (e.g. manually typed or old data)
        const feeders = sorted.filter(g => g.next_game_id === game.next_game_id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
        slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'team1' : 'team2'
      }
      if (names[game.next_game_id]) names[game.next_game_id][slot] = winner
    }
    return names
  }, [games, picks])

  const maxRound = useMemo(() => games.length ? Math.max(...games.map(g => g.round_num)) : 1, [games])

  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach(g => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [displayGames])

  const userPickMap = useMemo(() => new Map(picks.map(p => [p.game_id, p])), [picks])
  const pickedCount = picks.length; const totalGames = games.length

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${readOnly ? 'bg-violet-500/5 border-violet-500/20' : theme.headerBg}`}>
        <div>
          {readOnly && <div className="flex items-center gap-2 mb-1"><Eye size={14} className="text-violet-400" /><span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Read-Only</span></div>}
          <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide">
            {readOnly ? `${ownerName}'s Bracket` : tournament.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            {statusIcon(tournament.status)}
            <span className="text-xs text-slate-400">{statusLabel(tournament.status)}</span>
            {!readOnly && <><span className="text-slate-700">·</span><span className={`text-xs font-semibold ${theme.accent}`}>{pickedCount}/{totalGames} picks</span></>}
          </div>
        </div>
        {!readOnly && (
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <span className="text-xs text-slate-400">Progress</span>
              <span className={`text-sm font-bold ${theme.accent}`}>{pickedCount}/{totalGames}</span>
            </div>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${theme.bar} rounded-full transition-all`} style={{ width: `${totalGames ? (pickedCount / totalGames) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto bg-slate-900/50">
          <button onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0 ${!selectedRegion ? `${theme.tabActive}` : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            All Regions
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0 ${selectedRegion === r ? `${theme.tabActive}` : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      )}

      {isLocked && !readOnly && (
        <div className="mx-6 mt-4 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-3 flex-shrink-0">
          <Lock size={13} className="text-slate-400" />
          <p className="text-sm text-slate-400">{tournament.status === 'draft' ? 'Draft mode — not yet open for picks.' : 'This tournament is locked.'}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-6 min-w-max items-start">
          {rounds.map(([round, roundGames]) => (
            <div key={round} className="flex flex-col gap-3">
              <div className="text-center pb-3 border-b border-slate-800">
                <h3 className={`font-display text-sm font-bold uppercase tracking-[0.15em] ${theme.accent}`}>
                  {getRoundLabel(round, maxRound)}
                </h3>
                <span className="text-[10px] text-slate-600">{getScore(round)} points</span>
              </div>
              <div className="flex flex-col gap-3">
                {roundGames.map(game => (
                  <GameCard key={game.id} game={game}
                    userPick={userPickMap.get(game.id)}
                    effectiveTeam1={effectiveNames[game.id]?.team1 ?? game.team1_name}
                    effectiveTeam2={effectiveNames[game.id]?.team2 ?? game.team2_name}
                    isLocked={isLocked || readOnly || false}
                    onPick={onPick} readOnly={readOnly} ownerName={ownerName}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {(() => {
          const champGame = games.find(g => g.round_num === maxRound)
          const champPick = champGame ? picks.find(p => p.game_id === champGame.id)?.predicted_winner ?? null : null
          if (!champPick || readOnly) return null
          return (
            <div className="flex justify-center mt-10 mb-2">
              <div className="flex flex-col items-center gap-1 relative">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Your Champion</span>
                <div className="relative flex items-center justify-center px-10 py-5">
                  <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 260 76">
                    <defs>
                      <filter id="chalkfx" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" seed="8" result="noise"/>
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
                      </filter>
                    </defs>
                    <ellipse cx="130" cy="38" rx="118" ry="32" fill="none"
                      stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray="7 5" filter="url(#chalkfx)" />
                    <ellipse cx="130" cy="38" rx="121" ry="35" fill="none"
                      stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray="4 12" filter="url(#chalkfx)" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <Crown size={20} className={theme.accent} />
                    <span className={`font-display text-3xl font-extrabold uppercase tracking-wider ${theme.accentB}`}>{champPick}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Leaderboard View ──────────────────────────────────────────
function LeaderboardView({ allPicks, allGames, allProfiles, allTournaments, currentUserId, onSnoopUser }: {
  allPicks: Pick[]; allGames: Game[]; allProfiles: Profile[]
  allTournaments: Tournament[]; currentUserId: string
  onSnoopUser: (id: string) => void
}) {
  const theme = useTheme()
  const gameMap = useMemo(() => new Map(allGames.map(g => [g.id, g])), [allGames])

  const ranked = useMemo(() => {
    const scores: Record<string, { profile: Profile; points: number; correct: number; total: number; maxPossible: number }> = {}
    allProfiles.forEach(p => { scores[p.id] = { profile: p, points: 0, correct: 0, total: 0, maxPossible: 0 } })
    allPicks.forEach(pick => {
      if (!scores[pick.user_id]) return
      const game = gameMap.get(pick.game_id)
      if (!game) return
      scores[pick.user_id].total++
      if (game.actual_winner) {
        if (game.actual_winner === pick.predicted_winner) {
          scores[pick.user_id].points += getScore(game.round_num)
          scores[pick.user_id].correct++
        }
      } else {
        const eliminated = allGames.some(g => g.actual_winner && g.actual_winner !== pick.predicted_winner && (g.team1_name === pick.predicted_winner || g.team2_name === pick.predicted_winner))
        if (!eliminated) scores[pick.user_id].maxPossible += getScore(game.round_num)
      }
    })
    Object.values(scores).forEach(s => { s.maxPossible += s.points })
    return Object.values(scores).sort((a, b) => b.points - a.points || b.correct - a.correct)
  }, [allPicks, allGames, allProfiles, gameMap])

  const medals = ['🥇', '🥈', '🥉']
  const maxPoints = ranked[0]?.points ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${theme.headerBg}`}>
        <h2 className="font-display text-4xl font-extrabold text-white uppercase tracking-wide">Global Leaderboard</h2>
        <p className="text-xs text-slate-400 mt-0.5">Fibonacci scoring · Click a name to snoop their bracket</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {ranked.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600"><BarChart2 size={40} className="mb-3 opacity-30" /><p>No scored picks yet.</p></div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            <div className="grid grid-cols-[auto_1fr_80px_100px_120px] gap-3 px-4 pb-1">
              <div className="w-8" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Player</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Score</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Accuracy</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right">Max Possible</span>
            </div>
            {ranked.map((entry, idx) => {
              const isMe = entry.profile.id === currentUserId
              const pct = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
              const barW = maxPoints > 0 ? (entry.points / maxPoints) * 100 : 0
              return (
                <div key={entry.profile.id}
                  className={`relative group grid grid-cols-[auto_1fr_80px_100px_120px] gap-3 items-center px-4 py-3 rounded-xl border transition-all
                    ${isMe ? `${theme.bg} ${theme.border} shadow-lg ${theme.glow}` : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'}`}>
                  <div className="w-8 text-center flex-shrink-0">
                    {idx < 3 ? <span className="text-lg">{medals[idx]}</span> : <span className="text-slate-600 font-bold text-xs">#{idx + 1}</span>}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar profile={entry.profile} size="sm" />
                    <div className="min-w-0">
                      <button onClick={() => onSnoopUser(entry.profile.id)}
                        className={`font-semibold text-sm truncate flex items-center gap-1.5 hover:underline ${isMe ? theme.accentB : 'text-white hover:text-slate-200'}`}>
                        {entry.profile.display_name}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isMe && <span className={`text-[10px] font-bold uppercase ${theme.accent}`}>You</span>}
                        {entry.profile.is_admin && <Shield size={9} className="text-amber-400 flex-shrink-0" />}
                        {entry.profile.favorite_team && <span className="text-[10px] text-slate-600 truncate">{entry.profile.favorite_team}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display text-2xl font-extrabold tabular-nums ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600/80' : 'text-slate-400'}`}>{entry.points}</div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">pts</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-300 tabular-nums">{pct}%</div>
                    <div className="text-[10px] text-slate-600">{entry.correct}/{entry.total}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold tabular-nums ${entry.maxPossible > entry.points ? theme.accent : 'text-slate-600'}`}>{entry.maxPossible}</div>
                    <div className="text-[10px] text-slate-600 flex items-center justify-end gap-0.5"><TrendingUp size={8} /> max pts</div>
                  </div>
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${isMe ? theme.bar : idx < 3 ? 'bg-slate-600' : 'bg-slate-800'}`} style={{ width: `${barW}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Admin Game Card ───────────────────────────────────────────
// FIX: scores removed; winner resolution fixed; node dots aligned inline with team rows; gameNumbers prop added
function AdminGameCard({
  game, allGames, gameNum, gameNumbers, maxRound,
  onUpdate, onSetWinner, onDelete, onStartLink, onCompleteLink, onUnlink,
  linkingFromId, isValidLinkTarget,
  isDragOver, onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  game: Game; allGames: Game[]; gameNum: number; gameNumbers: Record<string, number>; maxRound: number
  onUpdate:       (id: string, updates: Partial<Game>) => void
  onSetWinner:    (game: Game, winner: string) => void
  onDelete:       (game: Game) => void
  onStartLink:    (gameId: string) => void
  onCompleteLink: (toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onUnlink:       (gameId: string) => void
  linkingFromId:  string | null
  isValidLinkTarget: boolean
  isDragOver: boolean
  onDragStart: (id: string) => void
  onDragOver:  (e: React.DragEvent, id: string) => void
  onDragEnd:   () => void
  onDrop:      (e: React.DragEvent, id: string) => void
}) {
  const theme = useTheme()
  const [team1, setTeam1] = useState(game.team1_name)
  const [team2, setTeam2] = useState(game.team2_name)
  const [showWinner, setShowWinner] = useState(false)

  // FIX: Stable sync — only update local state when the game prop actually changes
  useEffect(() => { setTeam1(game.team1_name) }, [game.team1_name])
  useEffect(() => { setTeam2(game.team2_name) }, [game.team2_name])

  const handleBlur = (field: 'team1_name' | 'team2_name', val: string) => {
    if (val.trim() === game[field]) return  // No-op if unchanged — prevents spurious re-renders
    onUpdate(game.id, { [field]: val.trim() || field === 'team1_name' ? val : val })
  }

  const isFirstRound    = game.round_num === Math.min(...allGames.map(g => g.round_num))
  const isChampionship  = game.round_num === maxRound
  const isLinkingFrom   = linkingFromId === game.id

  // FIX: Winner propagation — resolve "Winner of Game #N" placeholders to actual winners
  const resolveSlotName = (slotName: string): string => {
    if (!slotName.startsWith('Winner of Game #')) return slotName
    const gNum = parseInt(slotName.replace('Winner of Game #', ''), 10)
    const feederGame = allGames.find(g => gameNumbers[g.id] === gNum)
    return feederGame?.actual_winner ?? slotName
  }
  const effectiveTeam1 = resolveSlotName(game.team1_name)
  const effectiveTeam2 = resolveSlotName(game.team2_name)
  const winnerOptions  = [effectiveTeam1, effectiveTeam2].filter(n => n && !isTBDName(n))

  const handleOutClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLinkingFrom) onStartLink('') // cancel
    else onStartLink(game.id)
  }

  const handleInClick = (slot: 'team1_name' | 'team2_name') => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (linkingFromId && linkingFromId !== game.id) onCompleteLink(game.id, slot)
  }

  // Slot link status
  const slot1IsLinked = game.team1_name.startsWith('Winner of Game')
  const slot2IsLinked = game.team2_name.startsWith('Winner of Game')

  // Dot style helpers
  const inDotBase = 'w-3.5 h-3.5 rounded-full border-2 transition-all flex-shrink-0 z-20'
  const inDot1Class = linkingFromId && linkingFromId !== game.id && isValidLinkTarget
    ? `${inDotBase} border-emerald-400 bg-emerald-400/30 animate-pulse cursor-pointer scale-125`
    : slot1IsLinked
      ? `${inDotBase} border-amber-400 bg-amber-400/40 cursor-default`
      : `${inDotBase} border-slate-600 bg-slate-800 hover:border-slate-400 cursor-default`
  const inDot2Class = linkingFromId && linkingFromId !== game.id && isValidLinkTarget
    ? `${inDotBase} border-sky-400 bg-sky-400/30 animate-pulse cursor-pointer scale-125`
    : slot2IsLinked
      ? `${inDotBase} border-amber-400 bg-amber-400/40 cursor-default`
      : `${inDotBase} border-slate-600 bg-slate-800 hover:border-slate-400 cursor-default`

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(game.id) }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(e, game.id) }}
      onDragEnd={onDragEnd}
      onDrop={e => { e.stopPropagation(); onDrop(e, game.id) }}
      className={`relative transition-all ${isDragOver ? 'opacity-50 scale-95' : ''}`}
      style={{ paddingRight: '18px' }}
    >
      {/* Output dot — right side, centered vertically on card */}
      {!isChampionship && (
        <button
          data-out={game.id}
          onClick={handleOutClick}
          title={game.next_game_id ? 'Linked — click to re-link' : 'Click to link to next game'}
          className={`absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all z-20 ${
            isLinkingFrom
              ? 'border-amber-400 bg-amber-400 scale-150 cursor-pointer shadow-lg shadow-amber-400/40'
              : game.next_game_id
                ? 'border-emerald-500 bg-emerald-500/40 cursor-pointer hover:scale-110'
                : 'border-slate-500 bg-slate-700 hover:border-amber-400 hover:bg-amber-400/20 cursor-pointer'
          }`}
        />
      )}

      {/* Card — overflow-visible allows dots to protrude */}
      <div className={`bg-slate-900 border rounded-xl overflow-visible w-56 flex-shrink-0 shadow-lg transition-all ${
        isLinkingFrom          ? 'border-amber-400 shadow-amber-400/20' :
        isValidLinkTarget && linkingFromId ? 'border-emerald-500/60' :
        isDragOver             ? 'border-slate-500' :
        theme.border
      }`}>
        {/* Card Header */}
        <div className={`px-2.5 py-1.5 ${theme.bg} border-b ${theme.border} flex items-center justify-between rounded-t-xl`}>
          <div className="flex items-center gap-1.5">
            {/* Drag handle */}
            <GripVertical size={10} className="text-slate-600 cursor-grab active:cursor-grabbing" />
            <span className={`text-[10px] font-bold ${theme.accent} uppercase tracking-widest`}>
              #{gameNum} · R{game.round_num}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {game.actual_winner && (
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                <CheckCircle size={8} />{game.actual_winner}
              </span>
            )}
            {game.next_game_id && (
              <button onClick={e => { e.stopPropagation(); onUnlink(game.id) }}
                title="Remove link"
                className="p-0.5 rounded text-slate-600 hover:text-rose-400 transition-colors">
                <Unlink size={9} />
              </button>
            )}
            <button onClick={() => onDelete(game)}
              className="p-0.5 rounded text-slate-600 hover:text-rose-400 transition-colors">
              <Trash2 size={9} />
            </button>
          </div>
        </div>

        {/* Team Name Inputs — FIX: dots now inline/absolute relative to each row for perfect alignment */}
        <div className="px-2.5 pt-2.5 pb-0 space-y-1">
          {/* Team 1 row */}
          <div className="relative flex items-center">
            {!isFirstRound && (
              <button
                data-in1={game.id}
                onClick={handleInClick('team1_name')}
                title={slot1IsLinked ? game.team1_name : 'Connect Team 1 slot'}
                className={inDot1Class}
                style={{ position: 'absolute', left: '-21px' }}
              />
            )}
            <input
              value={team1}
              onChange={e => setTeam1(e.target.value)}
              onBlur={e => handleBlur('team1_name', e.target.value)}
              placeholder="Team 1"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>

          <div className="text-center text-[9px] text-slate-600 font-bold tracking-widest">VS</div>

          {/* Team 2 row */}
          <div className="relative flex items-center">
            {!isFirstRound && (
              <button
                data-in2={game.id}
                onClick={handleInClick('team2_name')}
                title={slot2IsLinked ? game.team2_name : 'Connect Team 2 slot'}
                className={inDot2Class}
                style={{ position: 'absolute', left: '-21px' }}
              />
            )}
            <input
              value={team2}
              onChange={e => setTeam2(e.target.value)}
              onBlur={e => handleBlur('team2_name', e.target.value)}
              placeholder="Team 2"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
        </div>

        <div className="px-2.5 pb-2.5 mt-2 space-y-2">
          {/* Link status */}
          <div className="text-[10px] text-slate-600 flex items-center gap-1">
            <Link2 size={8} />
            {game.next_game_id
              ? <span className="text-amber-400/70">→ Game #{gameNumbers[game.next_game_id] ?? '?'}</span>
              : <span className="text-slate-700">{isChampionship ? 'Championship' : 'Not linked'}</span>}
          </div>

          {/* Set winner */}
          <div>
            <button onClick={() => setShowWinner(v => !v)}
              className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors ${showWinner ? theme.accent : 'text-slate-500 hover:text-slate-300'}`}>
              <Target size={8} /> {showWinner ? 'Hide' : 'Set'} Winner
            </button>
            {showWinner && (
              <div className="mt-1.5 space-y-1">
                {winnerOptions.length > 0 ? (
                  <div className="flex gap-1">
                    {winnerOptions.map(team => (
                      <button key={team} onClick={() => onSetWinner(game, team)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all truncate px-1.5 ${
                          game.actual_winner === team ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}>
                        {team}{game.actual_winner === team && ' ✓'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-600 italic">
                    {game.team1_name.startsWith('Winner of Game') && game.team2_name.startsWith('Winner of Game')
                      ? 'Set winners in earlier rounds first'
                      : 'Add team names first'}
                  </p>
                )}
                {game.actual_winner && (
                  <button onClick={() => onSetWinner(game, '')}
                    className="w-full py-1 rounded-lg text-[10px] text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                    Clear Winner
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Admin Builder View ────────────────────────────────────────
interface SVGLine { x1: number; y1: number; x2: number; y2: number; gameId: string; fromSlot: 'in1' | 'in2' }

function AdminBuilderView({
  tournament, games, onUpdateGame, onAddGameToRound, onAddNextRound,
  onPublish, onLock, onSetWinner, onDeleteGame, onDeleteTournament, onReload, onLink, onUnlink,
  onRenameTournament,
}: {
  tournament: Tournament; games: Game[]
  onUpdateGame:         (id: string, updates: Partial<Game>) => void
  onAddGameToRound:     (round: number) => void
  onAddNextRound:       () => void
  onPublish:            () => void
  onLock:               () => void
  onSetWinner:          (game: Game, winner: string) => void
  onDeleteGame:         (game: Game) => void
  onDeleteTournament:   () => void
  onReload:             () => void
  onLink:               (fromGameId: string, toGameId: string, slot: 'team1_name' | 'team2_name') => void
  onUnlink:             (fromGameId: string) => void
  onRenameTournament:   (newName: string) => void
}) {
  const theme = useTheme()
  const [linkingFromId,  setLinkingFromId]  = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [draggedGameId,  setDraggedGameId]  = useState<string | null>(null)
  const [dragOverGameId, setDragOverGameId] = useState<string | null>(null)
  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState(tournament.name)
  const bracketRef = useRef<HTMLDivElement>(null)
  const [svgLines, setSvgLines] = useState<SVGLine[]>([])
  const [svgDims,  setSvgDims]  = useState({ w: 0, h: 0 })

  const gameNumbers = useMemo(() => computeGameNumbers(games), [games])
  const maxRound    = useMemo(() => games.length ? Math.max(...games.map(g => g.round_num)) : 0, [games])
  const isBigDance  = games.some(g => g.region)

  const displayGames = useMemo(() => {
    if (!isBigDance || !selectedRegion) return games
    return games.filter(g => g.region === selectedRegion)
  }, [games, isBigDance, selectedRegion])

  // FIX: Sort by sort_order within each round for stable rendering
  const rounds = useMemo(() => {
    const map = new Map<number, Game[]>()
    displayGames.forEach(g => {
      if (!map.has(g.round_num)) map.set(g.round_num, [])
      map.get(g.round_num)!.push(g)
    })
    // Sort each round's games by sort_order (nulls last), then stable by id
    map.forEach((roundGames, _r) => {
      roundGames.sort((a, b) => {
        const ao = a.sort_order ?? 999999
        const bo = b.sort_order ?? 999999
        if (ao !== bo) return ao - bo
        return a.id.localeCompare(b.id)
      })
    })
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [displayGames])

  const publishValid = useMemo(() => {
    if (games.length === 0) return false
    const nonChamp = games.filter(g => g.round_num < maxRound)
    return nonChamp.every(g => g.next_game_id !== null)
  }, [games, maxRound])

  // ── SVG connector lines ──
  const recomputeLines = useCallback(() => {
    const container = bracketRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const lines: SVGLine[] = []

    for (const game of games) {
      if (!game.next_game_id) continue
      const outDot = container.querySelector<HTMLElement>(`[data-out="${game.id}"]`)
      if (!outDot) continue
      const outR = outDot.getBoundingClientRect()
      const outX = outR.left + outR.width / 2 - containerRect.left + container.scrollLeft
      const outY = outR.top  + outR.height / 2 - containerRect.top  + container.scrollTop

      const nextGame = games.find(g => g.id === game.next_game_id)
      if (!nextGame) continue
      const gNum = gameNumbers[game.id]
      const winnerText = `Winner of Game #${gNum}`
      let slot: 'in1' | 'in2'
      if (nextGame.team1_name === winnerText) slot = 'in1'
      else if (nextGame.team2_name === winnerText) slot = 'in2'
      else {
        // Fallback: determine slot by feeder order
        const feeders = games.filter(g => g.next_game_id === game.next_game_id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
        slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'in1' : 'in2'
      }

      const inDot = container.querySelector<HTMLElement>(`[data-${slot}="${game.next_game_id}"]`)
      if (!inDot) continue
      const inR = inDot.getBoundingClientRect()
      const inX = inR.left + inR.width / 2 - containerRect.left + container.scrollLeft
      const inY = inR.top  + inR.height / 2 - containerRect.top  + container.scrollTop
      lines.push({ x1: outX, y1: outY, x2: inX, y2: inY, gameId: game.id, fromSlot: slot })
    }
    setSvgLines(lines)
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight })
  }, [games, gameNumbers])

  useLayoutEffect(() => { recomputeLines() }, [games, recomputeLines, selectedRegion])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLinkingFromId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Link handlers ──
  const handleStartLink = (gameId: string) => {
    setLinkingFromId(prev => (prev === gameId || gameId === '') ? null : gameId)
  }
  const handleCompleteLink = (toGameId: string, slot: 'team1_name' | 'team2_name') => {
    if (!linkingFromId || linkingFromId === toGameId) return
    const fromGame = games.find(g => g.id === linkingFromId)
    const toGame   = games.find(g => g.id === toGameId)
    if (!fromGame || !toGame || fromGame.round_num >= toGame.round_num) return
    onLink(linkingFromId, toGameId, slot)
    setLinkingFromId(null)
  }

  // ── Drag-and-drop reorder within a column ──
  const handleDragStart = (id: string) => setDraggedGameId(id)
  const handleDragOver  = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (id !== draggedGameId) setDragOverGameId(id)
  }
  const handleDragEnd = () => { setDraggedGameId(null); setDragOverGameId(null) }
  const handleDrop = async (e: React.DragEvent, targetGameId: string) => {
    e.preventDefault()
    if (!draggedGameId || draggedGameId === targetGameId) {
      handleDragEnd(); return
    }
    const dragged = games.find(g => g.id === draggedGameId)
    const target  = games.find(g => g.id === targetGameId)
    if (!dragged || !target || dragged.round_num !== target.round_num) {
      handleDragEnd(); return
    }
    // Reorder within the round, then persist new sort_order values
    const roundGames = games
      .filter(g => g.round_num === dragged.round_num)
      .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999) || a.id.localeCompare(b.id))
    const dragIdx   = roundGames.findIndex(g => g.id === draggedGameId)
    const targetIdx = roundGames.findIndex(g => g.id === targetGameId)
    const reordered = [...roundGames]
    reordered.splice(dragIdx, 1)
    reordered.splice(targetIdx, 0, dragged)

    await Promise.all(
      reordered.map((g, i) => supabase.from('games').update({ sort_order: i }).eq('id', g.id))
    )
    onReload()
    handleDragEnd()
  }

  return (
    <div className="flex flex-col h-full" onClick={() => setLinkingFromId(null)}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-amber-500/20 flex items-center justify-between flex-shrink-0 bg-amber-500/5">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-400" />
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => {
                  setEditingName(false)
                  if (nameInput.trim() && nameInput.trim() !== tournament.name) onRenameTournament(nameInput.trim())
                  else setNameInput(tournament.name)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
                  if (e.key === 'Escape') { setEditingName(false); setNameInput(tournament.name) }
                }}
                className="font-display text-xl font-extrabold text-white uppercase tracking-wide bg-slate-800 border border-amber-500/40 rounded-lg px-2 py-0.5 focus:outline-none focus:border-amber-400 w-64"
              />
            ) : (
              <>
                <h2 className="font-display text-xl font-extrabold text-white uppercase tracking-wide">
                  Admin Builder — {tournament.name}
                </h2>
                <button onClick={() => { setEditingName(true); setNameInput(tournament.name) }}
                  title="Rename tournament"
                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-amber-400 transition-colors">
                  <Edit3 size={11} />
                </button>
              </>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              tournament.status === 'draft' ? 'bg-amber-500/20 text-amber-400' :
              tournament.status === 'open'  ? 'bg-emerald-500/20 text-emerald-400' :
                                              'bg-slate-700 text-slate-400'}`}>
              {statusLabel(tournament.status)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click output dot → input dot to link. Drag cards to reorder. <kbd className="text-slate-600 bg-slate-800 px-1 rounded text-[9px]">Esc</kbd> cancels linking.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={onReload} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
            <RefreshCw size={12} />
          </button>
          <button onClick={onAddNextRound}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">
            <Plus size={11} /> Add Next Round
          </button>
          {tournament.status === 'draft' && (
            <div className="flex items-center gap-1.5">
              {!publishValid && (
                <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                  <AlertTriangle size={10} />
                  <span className="text-[10px] font-semibold">Unlinked games</span>
                </div>
              )}
              <button onClick={onPublish} disabled={!publishValid}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Globe size={11} /> Publish
              </button>
            </div>
          )}
          {tournament.status === 'open' && (
            <button onClick={onLock}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-bold transition-all">
              <Lock size={11} /> Lock
            </button>
          )}
          <button onClick={onDeleteTournament}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all">
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>

      {/* Region tabs for Big Dance */}
      {isBigDance && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-amber-500/10 flex-shrink-0 overflow-x-auto bg-slate-900/30">
          <button onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0 ${!selectedRegion ? 'border-amber-500 text-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            All
          </button>
          {BD_REGIONS.map(r => (
            <button key={r} onClick={() => setSelectedRegion(r)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0 ${selectedRegion === r ? 'border-amber-500 text-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Linking mode banner */}
      {linkingFromId && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-semibold flex-shrink-0">
          <Link2 size={12} />
          Linking Game #{gameNumbers[linkingFromId] ?? '?'} — Click an input dot on a higher-round game, or press Esc to cancel
          <button onClick={() => setLinkingFromId(null)} className="ml-auto text-amber-400/60 hover:text-amber-400 transition-colors"><X size={12} /></button>
        </div>
      )}

      {/* Bracket area */}
      <div
        ref={bracketRef}
        className="flex-1 overflow-auto relative"
        style={{ cursor: linkingFromId ? 'crosshair' : 'default' }}
        onScroll={recomputeLines}
      >
        {/* SVG overlay */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: svgDims.w || '100%', height: svgDims.h || '100%', pointerEvents: 'none', zIndex: 0 }}
          className="overflow-visible">
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {svgLines.map((line, i) => {
            const cx = (line.x1 + line.x2) / 2
            return (
              <path key={`${line.gameId}-${i}`}
                d={`M ${line.x1} ${line.y1} C ${cx} ${line.y1}, ${cx} ${line.y2}, ${line.x2} ${line.y2}`}
                stroke={line.fromSlot === 'in1' ? '#f59e0b' : '#38bdf8'}
                strokeWidth="1.5" fill="none" strokeOpacity="0.55"
                strokeDasharray="5 3" filter="url(#glow)"
              />
            )
          })}
        </svg>

        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <Plus size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No games yet. Click "Add Next Round" to start building.</p>
          </div>
        ) : (
          <div className="relative flex gap-10 min-w-max items-start p-8" style={{ zIndex: 1 }} onClick={e => e.stopPropagation()}>
            {rounds.map(([round, roundGames]) => (
              <div key={round} className="flex flex-col gap-3" style={{ overflow: 'visible' }}>
                <div className="text-center pb-3 border-b border-amber-500/20">
                  <h3 className="font-display text-sm font-bold text-amber-400/70 uppercase tracking-widest">
                    {getRoundLabel(round, maxRound)}
                  </h3>
                  <span className="text-[10px] text-slate-600">{roundGames.length} game{roundGames.length !== 1 ? 's' : ''} · {getScore(round)}pt</span>
                </div>
                <div className="flex flex-col gap-5" style={{ overflow: 'visible' }}>
                  {roundGames.map(game => (
                    <AdminGameCard
                      key={game.id}
                      game={game}
                      allGames={games}
                      gameNum={gameNumbers[game.id] ?? 0}
                      gameNumbers={gameNumbers}
                      maxRound={maxRound}
                      onUpdate={onUpdateGame}
                      onSetWinner={onSetWinner}
                      onDelete={onDeleteGame}
                      onStartLink={handleStartLink}
                      onCompleteLink={handleCompleteLink}
                      onUnlink={onUnlink}
                      linkingFromId={linkingFromId}
                      isValidLinkTarget={
                        linkingFromId !== null &&
                        linkingFromId !== game.id &&
                        (games.find(g => g.id === linkingFromId)?.round_num ?? 0) < game.round_num
                      }
                      isDragOver={dragOverGameId === game.id}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
                <button
                  onClick={() => onAddGameToRound(round)}
                  className="mt-1 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-700 text-slate-600 hover:text-slate-400 hover:border-slate-500 text-[10px] font-semibold transition-all">
                  <Plus size={10} /> Add Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Snoop Modal ───────────────────────────────────────────────
function SnoopModal({ targetProfile, tournaments, allGames, allPicks, onClose }: {
  targetProfile: Profile; tournaments: Tournament[]
  allGames: Game[]; allPicks: Pick[]; onClose: () => void
}) {
  const [selectedTid, setSelectedTid] = useState<string | null>(
    tournaments.find(t => t.status !== 'draft')?.id ?? tournaments[0]?.id ?? null
  )
  const targetPicks = useMemo(() => allPicks.filter(p => p.user_id === targetProfile.id), [allPicks, targetProfile.id])
  const gamesByTournament = useMemo(() => {
    const map: Record<string, Game[]> = {}
    allGames.forEach(g => { if (!map[g.tournament_id]) map[g.tournament_id] = []; map[g.tournament_id].push(g) })
    return map
  }, [allGames])
  const selectedTournament = tournaments.find(t => t.id === selectedTid)
  const selectedGames  = selectedTid ? (gamesByTournament[selectedTid] ?? []) : []
  const selectedPicks  = targetPicks.filter(p => selectedGames.some(g => g.id === p.game_id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-violet-500/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar profile={targetProfile} size="md" />
            <div>
              <div className="flex items-center gap-2"><Eye size={14} className="text-violet-400" /><span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Bracket Snoop</span></div>
              <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide">{targetProfile.display_name}'s Picks</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"><X size={16} /></button>
        </div>
        <div className="flex gap-1 px-4 pt-3 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
          {tournaments.filter(t => t.status !== 'draft').map(t => (
            <button key={t.id} onClick={() => setSelectedTid(t.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0 ${selectedTid === t.id ? 'text-violet-400 border-violet-500 bg-violet-500/10' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto">
          {selectedTournament ? (
            <BracketView
              tournament={selectedTournament}
              games={selectedGames}
              picks={selectedPicks}
              profile={targetProfile}
              onPick={() => {}}
              readOnly
              ownerName={targetProfile.display_name}
            />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No tournament selected.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ tournaments, selectedId, gamesCache, picks, profile, activeView,
  onSelectTournament, onAddTournament, onSetView, onHome }: {
  tournaments: Tournament[]; selectedId: string | null
  gamesCache: Record<string, Game[]>; picks: Pick[]; profile: Profile
  activeView: ActiveView
  onSelectTournament: (t: Tournament) => void
  onAddTournament: () => void
  onSetView: (v: ActiveView) => void
  onHome: () => void
}) {
  const theme = useTheme()
  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'home',        label: 'Home',        icon: <Home        size={13} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <BarChart2   size={13} /> },
  ]

  const missingPicks = useMemo(() => {
    const s = new Set<string>()
    tournaments.filter(t => t.status === 'open').forEach(t => {
      const tGames = gamesCache[t.id] ?? []
      const picked = picks.filter(p => tGames.some(g => g.id === p.game_id))
      if (picked.length < tGames.length) s.add(t.id)
    })
    return s
  }, [tournaments, gamesCache, picks])

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
      <button onClick={onHome} className="px-4 py-4 border-b border-slate-800 flex items-center gap-3 hover:bg-slate-800/40 transition-colors text-left">
        <div className={`w-8 h-8 rounded-lg ${theme.logo} flex items-center justify-center shadow-lg flex-shrink-0`}>
          <Trophy size={15} className="text-white" />
        </div>
        <div>
          <div className="font-display text-sm font-extrabold text-white uppercase tracking-wider">Predictor Hub</div>
          <div className="text-[10px] text-slate-500">Conference Basketball</div>
        </div>
      </button>

      <button onClick={() => onSetView('settings')} className="px-4 py-3 border-b border-slate-800 flex items-center gap-2.5 hover:bg-slate-800/40 transition-colors text-left">
        <Avatar profile={profile} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{profile.display_name}</div>
          {profile.is_admin
            ? <div className="flex items-center gap-1"><Shield size={9} className="text-amber-400" /><span className="text-[10px] text-amber-400/70">Admin</span></div>
            : <div className="text-[10px] text-slate-500 truncate">{profile.favorite_team ?? 'Edit settings'}</div>}
        </div>
        <Settings size={11} className="text-slate-600 flex-shrink-0" />
      </button>

      <div className="px-3 py-2 border-b border-slate-800">
        {navItems.map(n => (
          <button key={n.id} onClick={() => { if (n.id === 'home') onHome(); else onSetView(n.id) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === n.id ? `${theme.bg} ${theme.accent}` : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}>
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-5 pt-2 pb-1">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Tournaments</span>
        </div>
        {tournaments.length === 0 && <div className="px-5 py-3 text-xs text-slate-600 italic">No tournaments yet.</div>}
        {tournaments.map(t => {
          const hasMissing = missingPicks.has(t.id)
          const isSelected = t.id === selectedId
          return (
            <button key={t.id} onClick={() => onSelectTournament(t)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-all group ${isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/40'}`}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(t.status)} ${t.status === 'open' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium flex-1 truncate ${hasMissing ? 'text-rose-400' : isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{t.name}</span>
              {hasMissing && <AlertTriangle size={11} className="text-rose-400 flex-shrink-0 animate-pulse" />}
              {profile.is_admin && (
                <button onClick={e => { e.stopPropagation(); onSelectTournament(t); onSetView('admin') }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Settings size={10} className="text-amber-400" />
                </button>
              )}
            </button>
          )
        })}
      </div>

      {profile.is_admin && (
        <div className="p-3 border-t border-slate-800">
          <button onClick={onAddTournament}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-all ${theme.btn}`}>
            <Plus size={13} /> Add New Tournament
          </button>
        </div>
      )}

      <div className="p-3 border-t border-slate-800">
        <button onClick={() => supabase.auth.signOut()}
          className="w-full flex items-center justify-center gap-2 py-2 text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors">
          <LogOut size={11} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

// ── Template Generators ───────────────────────────────────────
async function generateStandardTemplate(tournamentId: string, teamCount: number): Promise<void> {
  const n = Math.max(teamCount, 2)
  const numRounds = Math.ceil(Math.log2(n))
  const r1Games = n - Math.pow(2, numRounds - 1)

  const champRes = await supabase.from('games').insert({
    tournament_id: tournamentId, round_num: numRounds,
    team1_name: 'TBD', team2_name: 'TBD', sort_order: 0,
  }).select('id').single()
  if (!champRes.data) return
  let prevIds: string[] = [champRes.data.id]

  for (let r = numRounds - 1; r >= 2; r--) {
    const rows = prevIds.flatMap((pid, pi) => [
      { tournament_id: tournamentId, round_num: r, team1_name: 'TBD', team2_name: 'TBD', next_game_id: pid, sort_order: pi * 2 },
      { tournament_id: tournamentId, round_num: r, team1_name: 'TBD', team2_name: 'TBD', next_game_id: pid, sort_order: pi * 2 + 1 },
    ])
    const res = await supabase.from('games').insert(rows).select('id')
    if (res.data) prevIds = res.data.map((g: any) => g.id)
  }

  if (r1Games <= 0) return

  if (r1Games >= prevIds.length * 2) {
    const rows = prevIds.flatMap((pid, pi) => [
      { tournament_id: tournamentId, round_num: 1, team1_name: 'TBD', team2_name: 'TBD', next_game_id: pid, sort_order: pi * 2 },
      { tournament_id: tournamentId, round_num: 1, team1_name: 'TBD', team2_name: 'TBD', next_game_id: pid, sort_order: pi * 2 + 1 },
    ])
    await supabase.from('games').insert(rows)
  } else {
    const rows = prevIds.slice(0, r1Games).map((pid, pi) => ({
      tournament_id: tournamentId, round_num: 1,
      team1_name: 'TBD', team2_name: 'TBD', next_game_id: pid, sort_order: pi,
    }))
    await supabase.from('games').insert(rows)
  }
}

// After template insertion, update each "next" game's team slots to "Winner of Game #N"
async function linkTemplateSlots(tournamentId: string): Promise<void> {
  const { data: rawGames } = await supabase.from('games').select('*').eq('tournament_id', tournamentId)
  if (!rawGames) return
  const allG = rawGames as Game[]
  const gameNums = computeGameNumbers(allG)
  // Build per-next-game slot updates
  const nextUpdates: Record<string, { team1_name?: string; team2_name?: string }> = {}
  for (const game of allG) {
    if (!game.next_game_id) continue
    const gNum = gameNums[game.id]
    const winnerText = `Winner of Game #${gNum}`
    const feeders = allG
      .filter(g => g.next_game_id === game.next_game_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
    const slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'team1_name' : 'team2_name'
    if (!nextUpdates[game.next_game_id]) nextUpdates[game.next_game_id] = {}
    nextUpdates[game.next_game_id][slot] = winnerText
  }
  await Promise.all(
    Object.entries(nextUpdates).map(([gameId, upd]) =>
      supabase.from('games').update(upd).eq('id', gameId)
    )
  )
}

async function generateBigDanceTemplate(tournamentId: string): Promise<void> {
  const champRes = await supabase.from('games').insert({
    tournament_id: tournamentId, round_num: 6,
    team1_name: 'TBD', team2_name: 'TBD', region: 'Final Four', sort_order: 0,
  }).select('id').single()
  if (!champRes.data) return
  const champId = champRes.data.id

  const ff = await supabase.from('games').insert([
    { tournament_id: tournamentId, round_num: 5, team1_name: 'TBD', team2_name: 'TBD', next_game_id: champId, region: 'Final Four', sort_order: 0 },
    { tournament_id: tournamentId, round_num: 5, team1_name: 'TBD', team2_name: 'TBD', next_game_id: champId, region: 'Final Four', sort_order: 1 },
  ]).select('id')
  if (!ff.data) return
  const ffIds = ff.data.map((g: any) => g.id)

  const regions = ['East', 'West', 'South', 'Midwest']
  const e8 = await supabase.from('games').insert(
    regions.map((region, i) => ({
      tournament_id: tournamentId, round_num: 4,
      team1_name: 'TBD', team2_name: 'TBD',
      next_game_id: ffIds[Math.floor(i / 2)], region, sort_order: i,
    }))
  ).select('id')
  if (!e8.data) return
  const e8Ids = e8.data.map((g: any) => g.id)

  const s16 = await supabase.from('games').insert(
    regions.flatMap((region, ri) => [0, 1].map(j => ({
      tournament_id: tournamentId, round_num: 3,
      team1_name: 'TBD', team2_name: 'TBD',
      next_game_id: e8Ids[ri], region, sort_order: ri * 2 + j,
    })))
  ).select('id')
  if (!s16.data) return
  const s16Ids = s16.data.map((g: any) => g.id)

  const r32 = await supabase.from('games').insert(
    regions.flatMap((region, ri) => [0, 1, 2, 3].map(j => ({
      tournament_id: tournamentId, round_num: 2,
      team1_name: 'TBD', team2_name: 'TBD',
      next_game_id: s16Ids[ri * 2 + Math.floor(j / 2)], region, sort_order: ri * 4 + j,
    })))
  ).select('id')
  if (!r32.data) return
  const r32Ids = r32.data.map((g: any) => g.id)

  await supabase.from('games').insert(
    regions.flatMap((region, ri) => [0, 1, 2, 3, 4, 5, 6, 7].map(j => ({
      tournament_id: tournamentId, round_num: 1,
      team1_name: 'TBD', team2_name: 'TBD',
      next_game_id: r32Ids[ri * 4 + Math.floor(j / 2)], region, sort_order: ri * 8 + j,
    })))
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [user,               setUser]               = useState<User | null>(null)
  const [profile,            setProfile]            = useState<Profile | null>(null)
  const [tournaments,        setTournaments]        = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [games,              setGames]              = useState<Game[]>([])
  const [gamesCache,         setGamesCache]         = useState<Record<string, Game[]>>({})
  const [picks,              setPicks]              = useState<Pick[]>([])
  const [allMyPicks,         setAllMyPicks]         = useState<Pick[]>([])
  const [allPicks,           setAllPicks]           = useState<Pick[]>([])
  const [allGames,           setAllGames]           = useState<Game[]>([])
  const [allProfiles,        setAllProfiles]        = useState<Profile[]>([])
  const [activeView,         setActiveView]         = useState<ActiveView>('home')
  const [appLoading,         setAppLoading]         = useState(true)
  const [snoopTargetId,      setSnoopTargetId]      = useState<string | null>(null)
  const [confirmModal,       setConfirmModal]       = useState<ConfirmModalCfg | null>(null)
  const [showAddTournament,  setShowAddTournament]  = useState(false)
  const { toasts, push } = useToasts()

  const currentTheme = profile?.theme ? THEMES[profile.theme] ?? THEMES.ember : THEMES.ember
  const gameNumbers  = useMemo(() => computeGameNumbers(games), [games])

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => setUser(session?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) { setProfile(null); setAppLoading(false); return }
    setAppLoading(true)
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { setProfile(data as Profile); setAppLoading(false) })
  }, [user])

  // ── Data loaders ──
  const loadTournaments = useCallback(async () => {
    const { data } = await supabase.from('tournaments').select('*').order('name')
    if (data) setTournaments(data as Tournament[])
  }, [])

  // FIX: Order by sort_order for stable rendering; secondary order by round_num
  const loadGames = useCallback(async (tid: string) => {
    const { data } = await supabase
      .from('games').select('*').eq('tournament_id', tid)
      .order('round_num', { ascending: true })
      .order('sort_order', { ascending: true, nullsFirst: false })
    if (data) {
      setGames(data as Game[])
      setGamesCache(prev => ({ ...prev, [tid]: data as Game[] }))
    }
  }, [])

  useEffect(() => { if (profile) loadTournaments() }, [profile, loadTournaments])
  useEffect(() => {
    if (!profile || tournaments.length === 0) return
    tournaments.forEach(t => { if (!gamesCache[t.id]) loadGames(t.id) })
  }, [tournaments, profile])
  useEffect(() => { if (selectedTournament) loadGames(selectedTournament.id) }, [selectedTournament, loadGames])

  const loadPicks = useCallback(async (tid: string) => {
    if (!profile) return
    const tGames = gamesCache[tid] ?? []
    if (tGames.length === 0) return
    const { data } = await supabase.from('picks').select('*').eq('user_id', profile.id).in('game_id', tGames.map(g => g.id))
    if (data) setPicks(data as Pick[])
  }, [profile, gamesCache])

  // Load ALL user picks globally (for home page counts and sidebar indicators)
  const loadAllMyPicks = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('picks').select('*').eq('user_id', profile.id)
    if (data) setAllMyPicks(data as Pick[])
  }, [profile])

  useEffect(() => {
    if (selectedTournament && gamesCache[selectedTournament.id]) loadPicks(selectedTournament.id)
  }, [selectedTournament, gamesCache, loadPicks])

  useEffect(() => { if (profile) loadAllMyPicks() }, [profile, loadAllMyPicks])

  const loadLeaderboard = useCallback(async () => {
    const [p, g, pr] = await Promise.all([
      supabase.from('picks').select('*'),
      supabase.from('games').select('*'),
      supabase.from('profiles').select('*'),
    ])
    if (p.data)  setAllPicks(p.data as Pick[])
    if (g.data)  setAllGames(g.data as Game[])
    if (pr.data) setAllProfiles(pr.data as Profile[])
  }, [])

  useEffect(() => {
    if ((activeView === 'leaderboard' || snoopTargetId) && profile) loadLeaderboard()
  }, [activeView, snoopTargetId, profile, loadLeaderboard])

  // ── Actions ──
  const handleSelectTournament = (t: Tournament) => {
    setSelectedTournament(t)
    setActiveView('bracket')
  }

  const handlePick = async (game: Game, team: string) => {
    if (!profile) return
    const existing = picks.find(p => p.game_id === game.id)
    if (existing?.predicted_winner === team) {
      await supabase.from('picks').delete().eq('id', existing.id)
      setPicks(prev => prev.filter(p => p.id !== existing.id))
      setAllMyPicks(prev => prev.filter(p => p.id !== existing.id))
      push('Pick removed', 'info'); return
    }
    const { data, error } = await supabase.from('picks')
      .upsert({ user_id: profile.id, game_id: game.id, predicted_winner: team }, { onConflict: 'user_id,game_id' })
      .select().single()
    if (!error && data) {
      setPicks(prev => [...prev.filter(p => p.game_id !== game.id), data as Pick])
      setAllMyPicks(prev => [...prev.filter(p => p.game_id !== game.id), data as Pick])
      push(`Picked: ${team}`, 'success')
    }
  }

  const handleCreateTournament = async (name: string, template: TemplateKey, teamCount = 16) => {
    const { data } = await supabase.from('tournaments').insert({ name, status: 'draft' }).select().single()
    if (!data) { push('Failed to create tournament', 'error'); return }
    const t = data as Tournament
    try {
      if (template === 'standard') {
        push('Generating bracket…', 'info')
        await generateStandardTemplate(t.id, teamCount)
        await linkTemplateSlots(t.id)
      } else if (template === 'bigdance') {
        push('Generating 63-game bracket…', 'info')
        await generateBigDanceTemplate(t.id)
        await linkTemplateSlots(t.id)
      }
    } catch (_e) { push('Template generation had an error', 'error') }
    await loadTournaments()
    await loadGames(t.id)
    setSelectedTournament(t)
    setActiveView('admin')
    push(`"${name}" created!`, 'success')
  }

  const handleUpdateGame = async (id: string, updates: Partial<Game>) => {
    await supabase.from('games').update(updates).eq('id', id)
    await loadGames(selectedTournament!.id)
  }

  const handleSetWinner = async (game: Game, winner: string) => {
    const gNums = gameNumbers

    if (!winner && game.actual_winner && game.next_game_id) {
      const feeders = games.filter(g => g.next_game_id === game.next_game_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      const slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'team1_name' : 'team2_name'
      const resetText = `Winner of Game #${gNums[game.id]}`
      await supabase.from('games').update({ [slot]: resetText }).eq('id', game.next_game_id)
    }

    await supabase.from('games').update({ actual_winner: winner || null }).eq('id', game.id)

    if (winner && game.next_game_id) {
      const feeders = games.filter(g => g.next_game_id === game.next_game_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      const slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'team1_name' : 'team2_name'
      await supabase.from('games').update({ [slot]: winner }).eq('id', game.next_game_id)
    }

    await loadGames(selectedTournament!.id)
    push(winner ? `Winner: ${winner}` : 'Winner cleared', winner ? 'success' : 'info')
  }

  const handleLink = async (fromGameId: string, toGameId: string, slot: 'team1_name' | 'team2_name') => {
    const fromGame = games.find(g => g.id === fromGameId)
    if (!fromGame) return
    const gNum = gameNumbers[fromGameId]
    const winnerText = `Winner of Game #${gNum}`
    if (fromGame.next_game_id) await handleUnlink(fromGameId)
    await supabase.from('games').update({ next_game_id: toGameId }).eq('id', fromGameId)
    await supabase.from('games').update({ [slot]: winnerText }).eq('id', toGameId)
    await loadGames(selectedTournament!.id)
    push('Games linked!', 'success')
  }

  const handleUnlink = async (fromGameId: string) => {
    const fromGame = games.find(g => g.id === fromGameId)
    if (!fromGame || !fromGame.next_game_id) return
    const gNum = gameNumbers[fromGameId]
    const winnerText = `Winner of Game #${gNum}`
    const nextGame = games.find(g => g.id === fromGame.next_game_id)
    if (nextGame) {
      if (nextGame.team1_name === winnerText) await supabase.from('games').update({ team1_name: 'TBD' }).eq('id', fromGame.next_game_id)
      else if (nextGame.team2_name === winnerText) await supabase.from('games').update({ team2_name: 'TBD' }).eq('id', fromGame.next_game_id)
    }
    await supabase.from('games').update({ next_game_id: null }).eq('id', fromGameId)
    await loadGames(selectedTournament!.id)
    push('Link removed', 'info')
  }

  // FIX: Assign sort_order when adding games for stable ordering
  const handleAddGameToRound = async (round: number) => {
    if (!selectedTournament) return
    const roundGames = games.filter(g => g.round_num === round)
    const maxOrder = roundGames.length > 0 ? Math.max(...roundGames.map(g => g.sort_order ?? 0)) : -1
    await supabase.from('games').insert({
      tournament_id: selectedTournament.id, round_num: round,
      team1_name: 'TBD', team2_name: 'TBD', sort_order: maxOrder + 1,
    })
    await loadGames(selectedTournament.id)
    push('Game added', 'success')
  }

  const handleAddNextRound = async () => {
    if (!selectedTournament) return
    const nextRound = games.length > 0 ? Math.max(...games.map(g => g.round_num)) + 1 : 1
    await supabase.from('games').insert({
      tournament_id: selectedTournament.id, round_num: nextRound,
      team1_name: 'TBD', team2_name: 'TBD', sort_order: 0,
    })
    await loadGames(selectedTournament.id)
    push(`Round ${nextRound} created`, 'success')
  }

  const handleDeleteGame = (game: Game) => {
    setConfirmModal({
      title: 'Delete Game',
      message: `Delete Round ${game.round_num} game (${game.team1_name} vs ${game.team2_name})? This will also remove all associated picks.`,
      confirmLabel: 'Delete',
      dangerous: true,
      onConfirm: async () => {
        setConfirmModal(null)
        await supabase.from('picks').delete().eq('game_id', game.id)
        for (const feeder of games.filter(g => g.next_game_id === game.id)) {
          await supabase.from('games').update({ next_game_id: null }).eq('id', feeder.id)
        }
        if (game.next_game_id) {
          const gNum = gameNumbers[game.id]
          const winnerText = `Winner of Game #${gNum}`
          const nextGame = games.find(g => g.id === game.next_game_id)
          if (nextGame) {
            if (nextGame.team1_name === winnerText) await supabase.from('games').update({ team1_name: 'TBD' }).eq('id', game.next_game_id)
            else if (nextGame.team2_name === winnerText) await supabase.from('games').update({ team2_name: 'TBD' }).eq('id', game.next_game_id)
          }
        }
        await supabase.from('games').delete().eq('id', game.id)
        await loadGames(selectedTournament!.id)
        push('Game deleted', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }

  const handleDeleteTournament = () => {
    if (!selectedTournament) return
    setConfirmModal({
      title: 'Delete Tournament',
      message: `Permanently delete "${selectedTournament.name}"? This will also delete all games and picks. This cannot be undone.`,
      confirmLabel: 'Delete Forever',
      dangerous: true,
      onConfirm: async () => {
        setConfirmModal(null)
        const gameIds = games.map(g => g.id)
        if (gameIds.length > 0) await supabase.from('picks').delete().in('game_id', gameIds)
        await supabase.from('games').delete().eq('tournament_id', selectedTournament.id)
        await supabase.from('tournaments').delete().eq('id', selectedTournament.id)
        setSelectedTournament(null)
        setGames([])
        setActiveView('home')
        await loadTournaments()
        push('Tournament deleted', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }

  const handlePublish = async () => {
    if (!selectedTournament) return
    await supabase.from('tournaments').update({ status: 'open' }).eq('id', selectedTournament.id)
    await loadTournaments()
    setSelectedTournament(prev => prev ? { ...prev, status: 'open' } : null)
    push('Tournament published! Picks are now open.', 'success')
  }

  const handleRenameTournament = async (newName: string) => {
    if (!selectedTournament) return
    await supabase.from('tournaments').update({ name: newName }).eq('id', selectedTournament.id)
    setSelectedTournament(prev => prev ? { ...prev, name: newName } : null)
    await loadTournaments()
    push(`Renamed to "${newName}"`, 'success')
  }

  const handleLock = () => {
    setConfirmModal({
      title: 'Lock Tournament',
      message: 'Lock this tournament? No new picks will be accepted. You can still set actual winners.',
      confirmLabel: 'Lock',
      dangerous: false,
      onConfirm: async () => {
        setConfirmModal(null)
        if (!selectedTournament) return
        await supabase.from('tournaments').update({ status: 'locked' }).eq('id', selectedTournament.id)
        await loadTournaments()
        setSelectedTournament(prev => prev ? { ...prev, status: 'locked' } : null)
        push('Tournament locked.', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }

  const snoopProfile = useMemo(() =>
    snoopTargetId ? allProfiles.find(p => p.id === snoopTargetId) ?? null : null,
    [snoopTargetId, allProfiles]
  )

  if (appLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  )

  if (!user || !profile) return <AuthForm onAuth={() => supabase.auth.getUser().then(({ data }) => setUser(data.user))} />

  const showAdminTab = profile.is_admin && !!selectedTournament

  return (
    <ThemeCtx.Provider value={currentTheme}>
      <div className="h-screen bg-slate-950 flex overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
          @keyframes slideUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
          .font-display { font-family: 'Barlow Condensed', sans-serif }
          * { scrollbar-width: thin; scrollbar-color: #334155 transparent }
        `}</style>

        <Sidebar
          tournaments={tournaments}
          selectedId={selectedTournament?.id ?? null}
          gamesCache={gamesCache}
          picks={allMyPicks}
          profile={profile}
          activeView={activeView}
          onSelectTournament={handleSelectTournament}
          onAddTournament={() => setShowAddTournament(true)}
          onSetView={setActiveView}
          onHome={() => { setActiveView('home'); setSelectedTournament(null) }}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedTournament && (activeView === 'bracket' || activeView === 'admin') && (
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 flex-shrink-0 bg-slate-900/50">
              <button onClick={() => setActiveView('bracket')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 ${activeView === 'bracket' ? currentTheme.tabActive : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                Make Picks
              </button>
              {showAdminTab && (
                <button onClick={() => setActiveView('admin')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${activeView === 'admin' ? 'text-amber-400 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                  <Shield size={11} /> Admin Builder
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {activeView === 'settings' ? (
              <SettingsView profile={profile} onProfileUpdate={setProfile} push={push} />
            ) : activeView === 'leaderboard' ? (
              <LeaderboardView allPicks={allPicks} allGames={allGames} allProfiles={allProfiles}
                allTournaments={tournaments} currentUserId={profile.id}
                onSnoopUser={id => { setSnoopTargetId(id); loadLeaderboard() }}
              />
            ) : activeView === 'home' || !selectedTournament ? (
              <HomeView tournaments={tournaments} profile={profile}
                allGames={gamesCache} picks={allMyPicks}
                onSelectTournament={handleSelectTournament}
              />
            ) : activeView === 'admin' && profile.is_admin ? (
              <AdminBuilderView
                tournament={selectedTournament} games={games}
                onUpdateGame={handleUpdateGame}
                onAddGameToRound={handleAddGameToRound}
                onAddNextRound={handleAddNextRound}
                onPublish={handlePublish}
                onLock={handleLock}
                onSetWinner={handleSetWinner}
                onDeleteGame={handleDeleteGame}
                onDeleteTournament={handleDeleteTournament}
                onReload={() => loadGames(selectedTournament.id)}
                onLink={handleLink}
                onUnlink={handleUnlink}
                onRenameTournament={handleRenameTournament}
              />
            ) : (
              <BracketView
                tournament={selectedTournament} games={games}
                picks={picks} profile={profile} onPick={handlePick}
              />
            )}
          </div>
        </main>

        {snoopTargetId && snoopProfile && (
          <SnoopModal
            targetProfile={snoopProfile}
            tournaments={tournaments.filter(t => t.status !== 'draft')}
            allGames={allGames} allPicks={allPicks}
            onClose={() => setSnoopTargetId(null)}
          />
        )}

        {confirmModal && <ConfirmModal {...confirmModal} />}

        {showAddTournament && (
          <AddTournamentModal
            onClose={() => setShowAddTournament(false)}
            onCreate={handleCreateTournament}
          />
        )}

        <Toaster toasts={toasts} />
      </div>
    </ThemeCtx.Provider>
  )
}