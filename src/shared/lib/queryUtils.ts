// src/shared/lib/queryUtils.ts
//
// ── Shared Realtime Debounce Utility ─────────────────────────
// A single module-level invalidateTimers Map is the authoritative
// deduplication registry for ALL cache invalidations across the app.
//
// Previously, useRealtimeSync, pick/model/queries, and
// useSurvivorPickMutation each maintained their own isolated Maps.
// This meant a Supabase Realtime "echo" event and a mutation's
// onSettled handler could both fire safeInvalidate for the same key
// within the 150ms window — into different Maps — with no deduplication
// between them. The race condition the debounce was designed to prevent
// could still occur cross-file.
//
// This singleton fixes that: all three callers share one Map.
//
// ── Prefix Invalidation Contract ─────────────────────────────
// invalidateQueries is called with exact: false (the TanStack Query
// default). A key like ['picks', 'mine'] will match ALL compound
// observer keys of the form ['picks', 'mine', tid, gameIds[]].
// This is intentional and must be preserved by all callers.
//
// FIX N-NEW-3: stableKeyString now wraps JSON.stringify in a try/catch.
// If a query key contains non-JSON-serializable values (functions, class
// instances, circular refs), the fallback uses String() coercion, which
// is still deterministic per value but produces less-unique keys for
// complex objects. All current key shapes in the app are plain
// string/array-of-strings and take the JSON.stringify path. The guard
// prevents a future non-JSON key from silently collapsing multiple
// distinct keys into the same timer slot and breaking deduplication.

import { type QueryClient, type QueryKey } from '@tanstack/react-query'

const REALTIME_DEBOUNCE_MS = 150

// Module-level singleton — shared across all consumers.
const invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Produces a stable string representation of a TanStack Query key for use
 * as a Map key in the debounce timer registry.
 *
 * FIX N-NEW-3: Wrapped in try/catch so that future query keys containing
 * non-JSON-serializable values (functions, class instances) do not throw.
 * The fallback String() coercion is deterministic for primitives and
 * produces a best-effort key for complex objects.
 */
function stableKeyString(queryKey: QueryKey): string {
  try {
    // Primary path — correct and unique for all plain-value key shapes.
    return JSON.stringify(queryKey)
  } catch {
    // Fallback for non-JSON-serializable values. Less unique for complex
    // objects but safe — will never throw and always returns a string.
    return String(queryKey)
  }
}

/**
 * Defers cache invalidation by 150ms when a local mutation is in-flight
 * to prevent Supabase Realtime "echo" events from reverting optimistic
 * UI updates. Timer deduplication ensures rapid successive events for
 * the same key reset the clock rather than stacking callbacks.
 *
 * @param qc        - The active TanStack QueryClient instance.
 * @param queryKey  - The key (or prefix) to invalidate.
 */
export function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  // FIX N-NEW-3: Use stableKeyString instead of bare JSON.stringify.
  const keyStr = stableKeyString(queryKey)

  if (qc.isMutating() > 0) {
    // Clear any pending timer for this key before setting a new one.
    if (invalidateTimers.has(keyStr)) {
      clearTimeout(invalidateTimers.get(keyStr)!)
    }
    const timer = setTimeout(() => {
      // exact: false — intentional prefix coverage. See file-level comment.
      void qc.invalidateQueries({ queryKey, exact: false })
      invalidateTimers.delete(keyStr)
    }, REALTIME_DEBOUNCE_MS)
    invalidateTimers.set(keyStr, timer)
  } else {
    // No mutation in-flight — invalidate immediately.
    // exact: false — intentional prefix coverage. See file-level comment.
    void qc.invalidateQueries({ queryKey, exact: false })
  }
}