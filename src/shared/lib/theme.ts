// src/shared/lib/theme.ts
import { createContext, useContext } from 'react'
import type { ThemeKey } from '../../shared/types'

export interface ThemeConfig {
  key: ThemeKey; label: string; emoji: string
  btn: string; btnSm: string; accent: string; accentB: string
  border: string; borderB: string; bg: string; bgMd: string
  dot: string; ring: string; bar: string; glow: string
  tabActive: string; headerBg: string; logo: string
  appBg: string; sidebarBg: string; panelBg: string; inputBg: string
  progressBar?: string
}

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  ember: {
    key: 'ember', label: 'Ember', emoji: '🔥',
    btn:    'bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-600/25',
    btnSm:  'bg-orange-600 hover:bg-orange-500',
    accent: 'text-orange-400', accentB: 'text-orange-300',
    border: 'border-orange-500/40', borderB: 'border-orange-400',
    bg:     'bg-orange-600/10',  bgMd: 'bg-orange-600/20',
    dot:    'bg-orange-400',     ring: 'ring-orange-500',
    bar:    'bg-orange-500',     glow: 'shadow-orange-500/20',
    tabActive: 'border-orange-500 text-orange-400',
    headerBg:  'bg-orange-500/5 border-orange-500/20',
    logo:      'bg-orange-600',
    // Theme Slate (Neutral Blue-Gray)
    appBg:     'bg-slate-50 dark:bg-slate-950',
    sidebarBg: 'bg-slate-100 dark:bg-slate-900',
    panelBg:   'bg-white dark:bg-slate-900',
    inputBg:   'bg-slate-100 dark:bg-slate-800',
    progressBar: 'bg-orange-500',
  },

  ice: {
    key: 'ice', label: 'Ice', emoji: '🧊',
    btn:    'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/25',
    btnSm:  'bg-cyan-600 hover:bg-cyan-500',
    accent: 'text-cyan-400', accentB: 'text-cyan-300',
    border: 'border-cyan-500/40', borderB: 'border-cyan-400',
    bg:     'bg-cyan-600/10',  bgMd: 'bg-cyan-600/20',
    dot:    'bg-cyan-400',     ring: 'ring-cyan-500',
    bar:    'bg-cyan-500',     glow: 'shadow-cyan-500/20',
    tabActive: 'border-cyan-500 text-cyan-400',
    headerBg:  'bg-cyan-500/5 border-cyan-500/20',
    logo:      'bg-cyan-600',
    // Theme Zinc (Neutral Industrial)
    appBg:     'bg-zinc-50 dark:bg-zinc-950',
    sidebarBg: 'bg-zinc-100 dark:bg-zinc-900',
    panelBg:   'bg-white dark:bg-zinc-900',
    inputBg:   'bg-zinc-100 dark:bg-zinc-800',
    progressBar: 'bg-cyan-500',
  },

  plasma: {
    key: 'plasma', label: 'Plasma', emoji: '⚡',
    btn:    'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/25',
    btnSm:  'bg-violet-600 hover:bg-violet-500',
    accent: 'text-violet-400', accentB: 'text-violet-300',
    border: 'border-violet-500/40', borderB: 'border-violet-400',
    bg:     'bg-violet-600/10',  bgMd: 'bg-violet-600/20',
    dot:    'bg-violet-400',     ring: 'ring-violet-500',
    bar:    'bg-violet-500',     glow: 'shadow-violet-500/20',
    tabActive: 'border-violet-500 text-violet-400',
    headerBg:  'bg-violet-500/5 border-violet-500/20',
    logo:      'bg-violet-600',
    // Theme Neutral (Pure Neutral)
    appBg:     'bg-neutral-50 dark:bg-neutral-950',
    sidebarBg: 'bg-neutral-100 dark:bg-neutral-900',
    panelBg:   'bg-white dark:bg-neutral-900',
    inputBg:   'bg-neutral-100 dark:bg-neutral-800',
    progressBar: 'bg-violet-500',
  },

  forest: {
    key: 'forest', label: 'Forest', emoji: '🌲',
    btn:    'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25',
    btnSm:  'bg-emerald-600 hover:bg-emerald-500',
    accent: 'text-emerald-400', accentB: 'text-emerald-300',
    border: 'border-emerald-500/40', borderB: 'border-emerald-400',
    bg:     'bg-emerald-600/10',  bgMd: 'bg-emerald-600/20',
    dot:    'bg-emerald-400',     ring: 'ring-emerald-500',
    bar:    'bg-emerald-500',     glow: 'shadow-emerald-500/20',
    tabActive: 'border-emerald-500 text-emerald-400',
    headerBg:  'bg-emerald-500/5 border-emerald-500/20',
    logo:      'bg-emerald-600',
    // Theme Stone (Warm Neutral)
    appBg:     'bg-stone-50 dark:bg-stone-950',
    sidebarBg: 'bg-stone-100 dark:bg-stone-900',
    panelBg:   'bg-white dark:bg-stone-900',
    inputBg:   'bg-stone-100 dark:bg-stone-800',
    progressBar: 'bg-emerald-500',
  },
}

export const ThemeCtx = createContext<ThemeConfig>(THEMES.ember)
export const useTheme = () => useContext(ThemeCtx)