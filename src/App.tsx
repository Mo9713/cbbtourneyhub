// src/App.tsx

/// <reference types="vite/client" />
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient, User } from '@supabase/supabase-js'
import { Shield, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react'

import { ThemeCtx, THEMES } from './utils/theme'
import { isPicksLocked } from './utils/time'
import { computeGameNumbers } from './utils/helpers'

import AuthForm            from './components/AuthForm'
import Sidebar             from './components/Sidebar'
import Toaster             from './components/Toaster'
import ConfirmModal        from './components/ConfirmModal'
import AddTournamentModal  from './components/AddTournamentModal'

import HomeView            from './views/HomeView'
import SettingsView        from './views/SettingsView'
import LeaderboardView     from './views/LeaderboardView'
import BracketView         from './views/BracketView'
import AdminBuilderView    from './views/AdminBuilderView'

import type {
  Profile, Tournament, Game, Pick,
  ToastMsg, ConfirmModalCfg, ActiveView, TemplateKey,
} from './types'
import { useState as useStateAlias, useCallback as useCallbackAlias } from 'react'

// ── Supabase client ───────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

// ── Toast hook ────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, text, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])
  return { toasts, push }
}

// ── Snoop Modal ───────────────────────────────────────────────
function SnoopModal({ targetProfile, tournaments, allGames, allPicks, onClose }: {
  targetProfile: Profile; tournaments: Tournament[]
  allGames: Game[]; allPicks: Pick[]; onClose: () => void
}) {
  const [selectedTid, setSelectedTid] = useState<string | null>(
    tournaments.find(t => t.status !== 'draft')?.id ?? tournaments[0]?.id ?? null
  )
  const targetPicks = useMemo(() =>
    allPicks.filter(p => p.user_id === targetProfile.id),
    [allPicks, targetProfile.id]
  )
  const gamesByTournament = useMemo(() => {
    const map: Record<string, Game[]> = {}
    allGames.forEach(g => {
      if (!map[g.tournament_id]) map[g.tournament_id] = []
      map[g.tournament_id].push(g)
    })
    return map
  }, [allGames])

  const selectedTournament = tournaments.find(t => t.id === selectedTid)
  const selectedGames  = selectedTid ? (gamesByTournament[selectedTid] ?? []) : []
  const selectedPicks  = targetPicks.filter(p => selectedGames.some(g => g.id === p.game_id))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col shadow-2xl shadow-violet-900/30 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-violet-500/20 flex items-center justify-between bg-violet-500/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-white uppercase tracking-wide">
              Snooping: {targetProfile.display_name}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
            ✕
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-800 flex-shrink-0 overflow-x-auto bg-slate-900/50">
          {tournaments.map(t => (
            <button key={t.id} onClick={() => setSelectedTid(t.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex-shrink-0
                ${selectedTid === t.id
                  ? 'text-violet-400 border-violet-500 bg-violet-500/10'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}>
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
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              No tournament selected.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Mobile Header ─────────────────────────────────────────────
function MobileHeader({ onMenuOpen, sidebarBg, logo }: {
  onMenuOpen: () => void; sidebarBg: string; logo: string
}) {
  return (
    <div className={`md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3 border-b border-slate-800 ${sidebarBg}`}>
      <button onClick={onMenuOpen}
        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
        <Menu size={20} />
      </button>
      <div className={`w-7 h-7 rounded-lg ${logo} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-xs font-bold">PH</span>
      </div>
      <span className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Predictor Hub</span>
    </div>
  )
}

// ── Template generators ───────────────────────────────────────
async function generateStandardTemplate(tournamentId: string, teamCount: number) {
  const rounds = Math.log2(teamCount)
  let prevIds: string[] = []
  for (let r = rounds; r >= 1; r--) {
    const count = Math.pow(2, rounds - r)
    const { data } = await supabase.from('games').insert(
      Array.from({ length: count }, (_, i) => ({
        tournament_id: tournamentId, round_num: r,
        team1_name: r === 1 ? `Team ${i * 2 + 1}` : 'TBD',
        team2_name: r === 1 ? `Team ${i * 2 + 2}` : 'TBD',
        next_game_id: prevIds[Math.floor(i / 2)] ?? null,
        sort_order: i,
      }))
    ).select('id')
    if (data) prevIds = data.map((g: any) => g.id)
  }
}

async function linkTemplateSlots(tournamentId: string) {
  const { data: games } = await supabase
    .from('games').select('*').eq('tournament_id', tournamentId)
    .order('round_num').order('sort_order')
  if (!games) return
  const sorted = [...games].sort((a: any, b: any) =>
    a.round_num !== b.round_num ? a.round_num - b.round_num : a.id.localeCompare(b.id)
  )
  const nums: Record<string, number> = {}
  sorted.forEach((g: any, i: number) => { nums[g.id] = i + 1 })
  for (const game of games as any[]) {
    if (!game.next_game_id) continue
    const feeders = (games as any[])
      .filter((g: any) => g.next_game_id === game.next_game_id)
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
    const slot = feeders.findIndex((f: any) => f.id === game.id) === 0 ? 'team1_name' : 'team2_name'
    const winnerText = `Winner of Game #${nums[game.id]}`
    await supabase.from('games').update({ [slot]: winnerText }).eq('id', game.next_game_id)
  }
}

async function generateBigDanceTemplate(tournamentId: string) {
  const regions = ['East', 'West', 'South', 'Midwest']

  const champ = await supabase.from('games').insert([{
    tournament_id: tournamentId, round_num: 6,
    team1_name: 'TBD', team2_name: 'TBD',
    region: 'Final Four', sort_order: 0,
  }]).select('id')
  if (!champ.data) return
  const champId = champ.data[0].id

  const ff = await supabase.from('games').insert([0, 1].map(i => ({
    tournament_id: tournamentId, round_num: 5,
    team1_name: 'TBD', team2_name: 'TBD',
    next_game_id: champId, region: 'Final Four', sort_order: i,
  }))).select('id')
  if (!ff.data) return
  const ffIds = ff.data.map((g: any) => g.id)

  const e8 = await supabase.from('games').insert(
    regions.map((region, ri) => ({
      tournament_id: tournamentId, round_num: 4,
      team1_name: 'TBD', team2_name: 'TBD',
      next_game_id: ffIds[Math.floor(ri / 2)], region, sort_order: ri,
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
  const [sidebarOpen,        setSidebarOpen]        = useState(true)
  const [mobileMenuOpen,     setMobileMenuOpen]     = useState(false)
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

  const loadGames = useCallback(async (tid: string) => {
    const { data } = await supabase.from('games').select('*').eq('tournament_id', tid)
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
    const { data } = await supabase.from('picks').select('*')
      .eq('user_id', profile.id).in('game_id', tGames.map(g => g.id))
    if (data) setPicks(data as Pick[])
  }, [profile, gamesCache])

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

  // ── Realtime ──
  useEffect(() => {
    if (!profile) return
    const channel = supabase.channel('games-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, () => {
        loadTournaments()
        if (selectedTournament) loadGames(selectedTournament.id)
        if (activeView === 'leaderboard') loadLeaderboard()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => {
        if (selectedTournament) loadGames(selectedTournament.id)
        tournaments.forEach(t => { if (gamesCache[t.id]) loadGames(t.id) })
        if (activeView === 'leaderboard') loadLeaderboard()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, selectedTournament, activeView])

  // ── Actions ──
  const handleSelectTournament = (t: Tournament) => {
    setSelectedTournament(t)
    setActiveView('bracket')
  }

  const handlePick = async (game: Game, team: string) => {
    if (!profile) return
    if (isPicksLocked(selectedTournament!, profile.is_admin)) {
      push('Picks are locked', 'error'); return
    }
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
    if (!winner && game.actual_winner && game.next_game_id) {
      const feeders = games.filter(g => g.next_game_id === game.next_game_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      const slot = feeders.findIndex(f => f.id === game.id) === 0 ? 'team1_name' : 'team2_name'
      await supabase.from('games').update({ [slot]: `Winner of Game #${gameNumbers[game.id]}` }).eq('id', game.next_game_id)
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
    if (fromGame.next_game_id) await handleUnlink(fromGameId)
    await supabase.from('games').update({ next_game_id: toGameId }).eq('id', fromGameId)
    await supabase.from('games').update({ [slot]: `Winner of Game #${gameNumbers[fromGameId]}` }).eq('id', toGameId)
    await loadGames(selectedTournament!.id)
    push('Games linked!', 'success')
  }

  const handleUnlink = async (fromGameId: string) => {
    const fromGame = games.find(g => g.id === fromGameId)
    if (!fromGame || !fromGame.next_game_id) return
    const winnerText = `Winner of Game #${gameNumbers[fromGameId]}`
    const nextGame   = games.find(g => g.id === fromGame.next_game_id)
    if (nextGame) {
      if (nextGame.team1_name === winnerText)
        await supabase.from('games').update({ team1_name: 'TBD' }).eq('id', fromGame.next_game_id)
      else if (nextGame.team2_name === winnerText)
        await supabase.from('games').update({ team2_name: 'TBD' }).eq('id', fromGame.next_game_id)
    }
    await supabase.from('games').update({ next_game_id: null }).eq('id', fromGameId)
    await loadGames(selectedTournament!.id)
    push('Link removed', 'info')
  }

  const handleAddGameToRound = async (round: number) => {
    if (!selectedTournament) return
    const roundGames = games.filter(g => g.round_num === round)
    const maxOrder   = roundGames.length > 0 ? Math.max(...roundGames.map(g => g.sort_order ?? 0)) : -1
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
      confirmLabel: 'Delete', dangerous: true,
      onConfirm: async () => {
        setConfirmModal(null)
        await supabase.from('picks').delete().eq('game_id', game.id)
        for (const feeder of games.filter(g => g.next_game_id === game.id))
          await supabase.from('games').update({ next_game_id: null }).eq('id', feeder.id)
        if (game.next_game_id) {
          const winnerText = `Winner of Game #${gameNumbers[game.id]}`
          const nextGame   = games.find(g => g.id === game.next_game_id)
          if (nextGame) {
            if (nextGame.team1_name === winnerText)
              await supabase.from('games').update({ team1_name: 'TBD' }).eq('id', game.next_game_id)
            else if (nextGame.team2_name === winnerText)
              await supabase.from('games').update({ team2_name: 'TBD' }).eq('id', game.next_game_id)
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
      message: `Permanently delete "${selectedTournament.name}"? All games and picks will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete Forever', dangerous: true,
      onConfirm: async () => {
        setConfirmModal(null)
        const gameIds = games.map(g => g.id)
        if (gameIds.length > 0) await supabase.from('picks').delete().in('game_id', gameIds)
        await supabase.from('games').delete().eq('tournament_id', selectedTournament.id)
        await supabase.from('tournaments').delete().eq('id', selectedTournament.id)
        setSelectedTournament(null); setGames([]); setActiveView('home')
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

  const handleLock = () => {
    setConfirmModal({
      title: 'Lock Tournament',
      message: 'Lock this tournament? No new picks will be accepted.',
      confirmLabel: 'Lock', dangerous: false,
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

  const handleRenameTournament = async (newName: string) => {
    if (!selectedTournament) return
    await supabase.from('tournaments').update({ name: newName }).eq('id', selectedTournament.id)
    setSelectedTournament(prev => prev ? { ...prev, name: newName } : null)
    await loadTournaments()
    push(`Renamed to "${newName}"`, 'success')
  }

  const handleUpdateTournament = async (updates: Partial<Tournament>) => {
    if (!selectedTournament) return
    await supabase.from('tournaments').update(updates).eq('id', selectedTournament.id)
    setSelectedTournament(prev => prev ? { ...prev, ...updates } : null)
    await loadTournaments()
    push('Tournament schedule saved', 'success')
  }

  const snoopProfile = useMemo(() =>
    snoopTargetId ? allProfiles.find(p => p.id === snoopTargetId) ?? null : null,
    [snoopTargetId, allProfiles]
  )

  // ── Render ──
  if (appLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  )

  if (!user || !profile) return (
    <AuthForm onAuth={() => supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))} />
  )

  const showAdminTab = profile.is_admin && !!selectedTournament

  const sidebarProps = {
    tournaments, selectedId: selectedTournament?.id ?? null,
    gamesCache, picks: allMyPicks, profile, activeView,
    onSelectTournament: handleSelectTournament,
    onAddTournament: () => setShowAddTournament(true),
    onSetView: setActiveView,
    onHome: () => { setActiveView('home'); setSelectedTournament(null) },
  }

  return (
    <ThemeCtx.Provider value={currentTheme}>
      <div className={`h-screen flex overflow-hidden ${currentTheme.appBg}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
          @keyframes slideUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
          .font-display { font-family: 'Barlow Condensed', sans-serif }
          * { scrollbar-width: thin; scrollbar-color: #334155 transparent }
        `}</style>

        <MobileHeader
          onMenuOpen={() => setMobileMenuOpen(true)}
          sidebarBg={currentTheme.sidebarBg}
          logo={currentTheme.logo}
        />

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative z-10 flex-shrink-0">
              <Sidebar {...sidebarProps} onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        <div className={`hidden md:flex flex-shrink-0 overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
          <Sidebar {...sidebarProps} onClose={() => {}} />
        </div>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-14 md:pt-0">
          <div className="hidden md:flex items-center gap-2 px-3 pt-2 pb-0 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
          </div>

          {selectedTournament && (activeView === 'bracket' || activeView === 'admin') && (
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 flex-shrink-0 bg-slate-900/50">
              <button onClick={() => setActiveView('bracket')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2
                  ${activeView === 'bracket' ? currentTheme.tabActive : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                Make Picks
              </button>
              {showAdminTab && (
                <button onClick={() => setActiveView('admin')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5
                    ${activeView === 'admin' ? 'text-amber-400 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                  <Shield size={11} /> Admin Builder
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {activeView === 'settings' ? (
              <SettingsView
                profile={profile} userEmail={user.email ?? ''}
                onProfileUpdate={setProfile} push={push}
              />
            ) : activeView === 'leaderboard' ? (
              <LeaderboardView
                allPicks={allPicks} allGames={allGames} allProfiles={allProfiles}
                allTournaments={tournaments} currentUserId={profile.id}
                isAdmin={profile.is_admin}
                onSnoopUser={id => { setSnoopTargetId(id); loadLeaderboard() }}
              />
            ) : activeView === 'home' || !selectedTournament ? (
              <HomeView
                tournaments={tournaments} profile={profile}
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
                onUpdateTournament={handleUpdateTournament}
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