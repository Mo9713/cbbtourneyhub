// src/features/auth/api/profileService.ts
//
// @deprecated — Logic moved to src/entities/profile/api/index.ts
//
// This file is a backward-compat shim. All Supabase profile read/write
// functions (`fetchProfile`, `updateMyProfile`, `updateTheme`, etc.)
// now live in the entity layer. Any remaining callsites that import
// from this path will continue to work; they will be migrated in Phase 2
// when the auth feature layer is finalized.

export * from '../../../entities/profile/api'