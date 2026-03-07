// src/App.tsx
/// <reference types="vite/client" />
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

// ── Services ──────────────────────────────────────────────────
import { supabase }                                   from './services/supabaseClient'
import * as tournamentService                         from './services/tournamentService'
import * as gameService                               from './services/gameService'
import * as pickService                               from './services/pickService'
import * as profileService                            from './services/profileService'
import { computeLeaderboard, type LeaderboardEntry } from './services/leaderboardService'

// ── Hooks ─────────────────────────────────────────────────────
import { useRealtimeSync } from './hooks/useRealtimeSync'

// ── Utils ─────────────────────────────────────────────────────
import { ThemeCtx, THEMES }   from './utils/theme'
import { isPicksLocked }      from './utils/time'
import { computeGameNumbers } from './utils/helpers'

// ── Components ────────────────────────────────────────────────
import AuthForm           from './components/AuthForm'
import Sidebar            from './components/Sidebar'
import Toaster            from './components/Toaster'
import ConfirmModal       from './components/ConfirmModal'
import AddTournamentModal from './components/AddTournamentModal'
import SnoopModal         from './components/SnoopModal'
import MobileHeader       from './components/MobileHeader'

// ── Views ─────────────────────────────────────────────────────
import HomeView         from './views/HomeView'
import SettingsView     from './views/SettingsView'
import LeaderboardView  from './views/LeaderboardView'
import BracketView      from './views/BracketView'
import AdminBuilderView from './views/AdminBuilderView'

import type {
  Profile, Tournament, Game, Pick,
  ToastMsg, ConfirmModalCfg, ActiveView, TemplateKey,
} from './types'

// ── Toast Hook ────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, text, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])
  return { toasts, push }
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
  const [leaderboard,        setLeaderboard]        = useState<LeaderboardEntry[]>([])
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

  // ── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) =>
      setUser(session?.user ?? null)
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) { setProfile(null); setAppLoading(false); return }
    setAppLoading(true)
    profileService.fetchProfile(user.id).then(result => {
      if (result.ok) setProfile(result.data)
      setAppLoading(false)
    })
  }, [user])

  // ── Data Loaders ───────────────────────────────────────────
  const loadTournaments = useCallback(async () => {
    const result = await tournamentService.fetchTournaments()
    if (result.ok) {
      setTournaments(result.data)
    } else {
      push(`Database Error: ${result.error}`, 'error')
      console.error("FETCH ERROR:", result.error)
    }
  }, [push])

  const loadGames = useCallback(async (tid: string) => {
    const result = await gameService.fetchGames(tid)
    if (result.ok) {
      setGames(result.data)
      setGamesCache(prev => ({ ...prev, [tid]: result.data }))
    }
  }, [])

  const loadPicks = useCallback(async (tid: string) => {
    if (!profile) return
    const tGames = gamesCache[tid] ?? []
    if (tGames.length === 0) return
    const result = await pickService.fetchPicksForGames(tGames.map(g => g.id))
    if (result.ok) setPicks(result.data.filter(p => p.user_id === profile.id))
  }, [profile, gamesCache])

  const loadAllMyPicks = useCallback(async () => {
    if (!profile) return
    const result = await pickService.fetchMyPicks()
    if (result.ok) setAllMyPicks(result.data)
  }, [profile])

  const loadLeaderboard = useCallback(async () => {
    const [picksRes, gamesRes, profilesRes] = await Promise.all([
      pickService.fetchAllPicks(),
      gameService.fetchAllGames(),
      profileService.fetchAllProfiles(),
    ])
    const p = picksRes.ok    ? picksRes.data    : []
    const g = gamesRes.ok    ? gamesRes.data    : []
    const r = profilesRes.ok ? profilesRes.data : []
    setAllPicks(p); setAllGames(g); setAllProfiles(r)
    const tMap = new Map(tournaments.map(t => [t.id, t]))
    setLeaderboard(computeLeaderboard(p, g, g, r, tMap))
  }, [tournaments])

  // Re-compute leaderboard display when tournament scoring configs change
  useEffect(() => {
    if (allPicks.length > 0) {
      const tMap = new Map(tournaments.map(t => [t.id, t]))
      setLeaderboard(computeLeaderboard(allPicks, allGames, allGames, allProfiles, tMap))
    }
  }, [tournaments])

  // ── Boot Sequence ──────────────────────────────────────────
  useEffect(() => { if (profile) loadTournaments() }, [profile, loadTournaments])

  useEffect(() => {
    if (!profile || tournaments.length === 0) return
    tournaments.forEach(t => { if (!gamesCache[t.id]) loadGames(t.id) })
  }, [tournaments, profile])

  useEffect(() => {
    if (selectedTournament) loadGames(selectedTournament.id)
  }, [selectedTournament, loadGames])

  useEffect(() => {
    if (selectedTournament && gamesCache[selectedTournament.id]) loadPicks(selectedTournament.id)
  }, [selectedTournament, gamesCache, loadPicks])

  useEffect(() => { if (profile) loadAllMyPicks() }, [profile, loadAllMyPicks])

  useEffect(() => {
    if ((activeView === 'leaderboard' || snoopTargetId) && profile) loadLeaderboard()
  }, [activeView, snoopTargetId, profile])

  // ── Realtime (one line) ────────────────────────────────────
  useRealtimeSync({
    profile,
    selectedTournament,
    activeView,
    snoopTargetId,
    loadTournaments,
    loadGames,
    loadPicks,
    loadAllMyPicks,
    loadLeaderboard,
  })

  // ── Action Handlers ────────────────────────────────────────
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
      const result = await pickService.deletePick(existing.id)
      if (!result.ok) { push(result.error, 'error'); return }
      setPicks(prev => prev.filter(p => p.id !== existing.id))
      setAllMyPicks(prev => prev.filter(p => p.id !== existing.id))
      push('Pick removed', 'info'); return
    }
    const result = await pickService.savePick(game.id, team)
    if (!result.ok) { push(result.error, 'error'); return }
    setPicks(prev => [...prev.filter(p => p.game_id !== game.id), result.data])
    setAllMyPicks(prev => [...prev.filter(p => p.game_id !== game.id), result.data])
    push(`Picked: ${team}`, 'success')
  }

  const handleCreateTournament = async (name: string, template: TemplateKey, teamCount = 16) => {
    push('Creating tournament…', 'info')
    const result = await tournamentService.createTournament({ name, template, teamCount })
    if (!result.ok) { push(result.error, 'error'); return }
    await loadTournaments()
    await loadGames(result.data.id)
    setSelectedTournament(result.data)
    setActiveView('admin')
    push(`"${name}" created!`, 'success')
  }

  const handleUpdateGame = async (id: string, updates: Partial<Game>) => {
    const result = await gameService.updateGame(id, updates)
    if (!result.ok) { push(result.error, 'error'); return }
    await loadGames(selectedTournament!.id)
  }

  const handleSetWinner = async (game: Game, winner: string) => {
    const result = await gameService.setWinner(game, winner, games, gameNumbers)
    if (!result.ok) { push(result.error, 'error'); return }
    await loadGames(selectedTournament!.id)
    push(winner ? `Winner: ${winner}` : 'Winner cleared', winner ? 'success' : 'info')
  }

  const handleLink = async (fromGameId: string, toGameId: string, slot: 'team1_name' | 'team2_name') => {
    const fromGame = games.find(g => g.id === fromGameId)
    if (!fromGame) return
    const result = await gameService.linkGames(
      fromGame, toGameId, slot, gameNumbers[fromGameId], games, gameNumbers
    )
    if (!result.ok) { push(result.error, 'error'); return }
    await loadGames(selectedTournament!.id)
    push('Games linked!', 'success')
  }

  const handleUnlink = async (fromGameId: string) => {
    const fromGame = games.find(g => g.id === fromGameId)
    if (!fromGame) return
    const result = await gameService.unlinkGame(fromGame, games, gameNumbers)
    if (!result.ok) { push(result.error, 'error'); return }
    await loadGames(selectedTournament!.id)
    push('Link removed', 'info')
  }

  const handleAddGameToRound = async (round: number) => {
    if (!selectedTournament) return
    const roundGames = games.filter(g => g.round_num === round)
    const maxOrder   = roundGames.length > 0 ? Math.max(...roundGames.map(g => g.sort_order ?? 0)) : -1
    const result = await gameService.addGameToRound(selectedTournament.id, round, maxOrder + 1)
    if (!result.ok) { push(result.error, 'error'); return }
    await loadGames(selectedTournament.id)
    push('Game added', 'success')
  }

  const handleAddNextRound = async () => {
    if (!selectedTournament) return
    const nextRound = games.length > 0 ? Math.max(...games.map(g => g.round_num)) + 1 : 1
    const result = await gameService.addGameToRound(selectedTournament.id, nextRound, 0)
    if (!result.ok) { push(result.error, 'error'); return }
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
        const result = await gameService.deleteGame(game, games, gameNumbers)
        if (!result.ok) { push(result.error, 'error'); return }
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
        const result = await tournamentService.deleteTournament(
          selectedTournament.id, games.map(g => g.id)
        )
        if (!result.ok) { push(result.error, 'error'); return }
        setSelectedTournament(null); setGames([]); setActiveView('home')
        await loadTournaments()
        push('Tournament deleted', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }

  const handlePublish = async () => {
    if (!selectedTournament) return
    const result = await tournamentService.publishTournament(selectedTournament.id)
    if (!result.ok) { push(result.error, 'error'); return }
    setSelectedTournament(result.data)
    await loadTournaments()
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
        const result = await tournamentService.lockTournament(selectedTournament.id)
        if (!result.ok) { push(result.error, 'error'); return }
        setSelectedTournament(result.data)
        await loadTournaments()
        push('Tournament locked.', 'info')
      },
      onCancel: () => setConfirmModal(null),
    })
  }

  const handleRenameTournament = async (newName: string) => {
    if (!selectedTournament) return
    const result = await tournamentService.updateTournament(selectedTournament.id, { name: newName })
    if (!result.ok) { push(result.error, 'error'); return }
    setSelectedTournament(result.data)
    await loadTournaments()
    push(`Renamed to "${newName}"`, 'success')
  }

  const handleUpdateTournament = async (updates: Partial<Tournament>) => {
    if (!selectedTournament) return
    const result = await tournamentService.updateTournament(selectedTournament.id, updates)
    if (!result.ok) { push(result.error, 'error'); return }
    setSelectedTournament(result.data)
    await loadTournaments()
    push('Tournament settings saved', 'success')
  }

  const snoopProfile = useMemo(() =>
    snoopTargetId ? allProfiles.find(p => p.id === snoopTargetId) ?? null : null,
    [snoopTargetId, allProfiles]
  )

  // ── Render ─────────────────────────────────────────────────
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
    onHome: () => { setSelectedTournament(null); setActiveView('home') },
    onClose: () => { setSidebarOpen(false); setMobileMenuOpen(false) },
  }

  return (
    <ThemeCtx.Provider value={currentTheme}>
      <div className={`h-screen flex overflow-hidden ${currentTheme.appBg}`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
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

        {/* Mobile overlay sidebar */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative z-10 flex-shrink-0">
              <Sidebar {...sidebarProps} onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className={`hidden md:flex flex-shrink-0 overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
          <Sidebar {...sidebarProps} onClose={() => {}} />
        </div>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-14 md:pt-0">

          {/* Desktop toolbar row */}
          <div className="hidden md:flex items-center gap-2 px-3 pt-2 pb-0 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
          </div>

          {/* Bracket / Admin tabs */}
          {showAdminTab && (
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 flex-shrink-0 bg-slate-900/50">
              {(['bracket', 'admin'] as ActiveView[]).map(v => (
                <button key={v} onClick={() => setActiveView(v)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2
                    ${activeView === v
                      ? `${currentTheme.accent} border-current`
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                    }`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Main view */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'settings' ? (
              <SettingsView
                profile={profile} userEmail={user.email ?? ''}
                onProfileUpdate={setProfile} push={push}
              />
            ) : activeView === 'leaderboard' ? (
              <LeaderboardView
                leaderboard={leaderboard}
                allTournaments={tournaments}
                allGames={allGames}
                currentUserId={profile.id}
                isAdmin={profile.is_admin}
                onSnoopUser={setSnoopTargetId}
              />
            ) : !selectedTournament ? (
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

        {/* Overlays */}
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