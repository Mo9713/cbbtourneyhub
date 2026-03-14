// src/entities/group/model/queries.ts

import { useQuery, useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { unwrap }  from '../../../shared/lib/unwrap'
import * as api    from '../api'
import type { Group, GroupMember, Profile } from '../../../shared/types'

const REALTIME_DEBOUNCE_MS = 150
const invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const groupKeys = {
  all:        ['groups']                               as const,
  userGroups: ()           => ['groups', 'user']       as const,
  details:    (id: string) => ['groups', 'detail', id] as const,
  members:    (id: string) => ['groups', 'members', id] as const,
}

function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  const keyStr = JSON.stringify(queryKey)
  if (qc.isMutating() > 0) {
    if (invalidateTimers.has(keyStr)) {
      clearTimeout(invalidateTimers.get(keyStr)!)
    }
    const timer = setTimeout(() => {
      void qc.invalidateQueries({ queryKey })
      invalidateTimers.delete(keyStr)
    }, REALTIME_DEBOUNCE_MS)
    invalidateTimers.set(keyStr, timer)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

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

export function useJoinGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (inviteCode) => unwrap(api.joinGroup(inviteCode)),
    onSuccess: (groupId) => {
      safeInvalidate(qc, groupKeys.userGroups())
      safeInvalidate(qc, groupKeys.members(groupId))
    },
  })
}

export function useCreateGroupMutation() {
  const qc = useQueryClient()
  return useMutation<Group, Error, { name: string; invite_code: string }>({
    mutationFn: (params) => unwrap(api.createGroup(params)),
    onSuccess: () => { safeInvalidate(qc, groupKeys.userGroups()) },
  })
}

export function useDeleteGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (groupId) => unwrap(api.deleteGroup(groupId)),
    onSuccess: () => { safeInvalidate(qc, groupKeys.all) },
  })
}

// FIX: Mutation for non-owners to safely remove themselves
export function useLeaveGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (groupId) => unwrap(api.leaveGroup(groupId)),
    onSuccess: (groupId) => {
      safeInvalidate(qc, groupKeys.userGroups())
      safeInvalidate(qc, groupKeys.members(groupId))
    },
  })
}