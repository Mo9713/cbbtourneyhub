// src/entities/group/model/index.ts
//
// C-03 FIX: Public API for the group entity model layer.
// Consumers import hooks and query keys from here — never from
// internal paths like model/queries.ts directly.

export {
  groupKeys,
  useUserGroupsQuery,
  useGroupDetailsQuery,
  useGroupMembersQuery,
  useJoinGroupMutation,
  useCreateGroupMutation,
  useDeleteGroupMutation,
} from './queries'