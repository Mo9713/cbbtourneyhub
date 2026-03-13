// src/features/tournament/api/api.ts
//
// @deprecated — Logic moved to src/entities/tournament/api/index.ts
//
// This file is a backward-compat shim. All internal logic has been
// extracted to the entity layer. Consumers that import directly from
// this path will continue to work during Phase 1.5; this shim will
// be deleted in Phase 2 once all callsites have been migrated.
//
// Also fixes the prior tsc error: the legacy file referenced
// `./templateService` with a relative path that TypeScript could not
// resolve after the entity extraction. Shimming to the entity layer
// bypasses that stale local reference entirely.

export * from '../../../entities/tournament/api'