// src/shared/infra/queryClient.ts
//
// Global TanStack Query client configuration.
//
// ── Realtime Debounce Contract ────────────────────────────────
// All entity-layer mutations must call `safeInvalidate()` (defined in
// the entity model files) rather than calling `qc.invalidateQueries()`
// directly. If `qc.isMutating() > 0` at settlement time, the invalidation
// is deferred by 150ms to prevent Supabase Realtime "echo" events from
// clobbering in-flight optimistic UI updates.
//
// ── staleTime Rationale ───────────────────────────────────────
// 1 minute is intentional. View swaps (HomeView ↔ BracketView) would
// otherwise trigger immediate refetches and cause visible layout thrashing
// before Realtime subscriptions re-establish and take over as the live
// update channel. Individual queries may override this (e.g. profile
// data is set to `Infinity` since it is managed exclusively via
// optimistic mutation writes).

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1_000 * 60 * 1,  // 1 min — data considered fresh
      gcTime:               1_000 * 60 * 5,  // 5 min — cache retained after unmount
      retry:                1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations never retry — game/pick writes must be explicit and idempotent.
      retry: 0,
    },
  },
})