// src/features/tournament/model/queries.ts
//
// @deprecated — Logic moved to src/entities/tournament/model/queries.ts
//
// This file is a backward-compat shim. All hook logic, query keys, and
// mutation hooks now live in the entity layer. This shim ensures that
// any legacy `import { tournamentKeys } from '../../features/tournament/model/queries'`
// callsites continue to resolve without modification until they are
// individually migrated in Phase 2.

export * from '../../../entities/tournament/model/queries'