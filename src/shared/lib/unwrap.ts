// src/shared/lib/unwrap.ts
//
// N-09 FIX: Single, centralised ServiceResult unwrapper.
//
// IMPORTANT: This file intentionally has zero imports. The ServiceResult
// shape is inlined rather than imported to guarantee this file is always
// recognised as an ES module regardless of TypeScript configuration.
// Any import—even `import type`—can prevent "is not a module" recognition
// in certain moduleResolution modes (bundler, node16, nodenext).

/**
 * Unwraps a ServiceResult promise, throwing on the failure branch.
 * Converts the discriminated-union API contract into the thrown-error
 * contract expected by TanStack Query queryFn / mutationFn.
 */
export async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}