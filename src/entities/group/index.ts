// src/entities/group/index.ts
//
// Slice root — re-exports from both sublayers so consumers can import
// from 'entities/group' without knowing the internal file structure.
//
// api/   → raw async functions (fetchUserGroups, createGroup, etc.)
// model/ → TanStack Query hooks and query keys

export * from './api'
export * from './model'