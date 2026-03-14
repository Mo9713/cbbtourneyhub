// src/entities/group/model/queries.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { unwrap }  from '../../../shared/lib/unwrap'
import * as api    from '../api'
import type { Group, GroupMember, Profile } from '../../../shared/types'

// ── Query Keys ────────────────────────────────────────────────

export const groupKeys = {
  all:        ['groups']                               as const,
  userGroups: ()           => ['groups', 'user']       as const,
  details:    (id: string) => ['groups', 'detail', id] as const,
  members:    (id: string) => ['groups', 'members', id] as const,
}

// ── safeInvalidate ────────────────────────────────────────────

function safeInvalidate(qc: QueryClient, queryKey: readonly unknown[]): void {
  if (qc.isMutating() > 0) {
    setTimeout(() => void qc.invalidateQueries({ queryKey }), 150)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

// ── Queries ───────────────────────────────────────────────────

export function useUserGroupsQuery() {
  return useQuery<Group[], Error, Group[]>({
    queryKey: groupKeys.userGroups(),
    queryFn:  () => unwrap(api.fetchUserGroups()),
    select:   (data) => data ?? ([] as Group[]),
  })
}

export function useGroupDetailsQuery(groupId: string) {
  return useQuery<Group, Error>({
    queryKey: groupKeys.details(groupId),
    queryFn:  () => unwrap(api.fetchGroupDetails(groupId)),
    enabled:  !!groupId,
  })
}

export function useGroupMembersQuery(groupId: string) {
  type MemberWithProfile = GroupMember & { profile: Profile }
  return useQuery<MemberWithProfile[], Error, MemberWithProfile[]>({
    queryKey: groupKeys.members(groupId),
    queryFn:  () => unwrap(api.fetchGroupMembers(groupId)),
    enabled:  !!groupId,
    select:   (data) => data ?? ([] as MemberWithProfile[]),
  })
}

// ── Mutations ─────────────────────────────────────────────────

export function useJoinGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (inviteCode) => unwrap(api.joinGroup(inviteCode)),
    onSuccess: (groupId) => {
      // `groupId` is correctly typed as string — no longer unknown
      safeInvalidate(qc, groupKeys.userGroups())
      safeInvalidate(qc, groupKeys.members(groupId))
    },
  })
}

type CreateGroupVars = { name: string; invite_code: string }

export function useCreateGroupMutation() {
  const qc = useQueryClient()
  return useMutation<Group, Error, CreateGroupVars>({
    mutationFn: (params) => unwrap(api.createGroup(params)),
    onSuccess: () => {
      safeInvalidate(qc, groupKeys.userGroups())
    },
  })
}

export function useDeleteGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (groupId) => unwrap(api.deleteGroup(groupId)),
    onSuccess: () => {
      safeInvalidate(qc, groupKeys.all)
    },
  })
}