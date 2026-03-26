import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unwrap }  from '../../../shared/lib/unwrap'
import * as api    from '../api'
import type { Group, GroupMember, Profile } from '../../../shared/types'

// FIX 1: Import useAuth to grab the profile ID for our mobile speed fix
import { useAuth } from '../../../features/auth'
// FIX A-02: Import global safeInvalidate instead of recreating it
import { safeInvalidate } from '../../../shared/lib/queryUtils'

export const groupKeys = {
  all:        ['groups']                                       as const,
  // FIX 2: Dynamically include the user ID in the key
  userGroups: (userId?: string) => ['groups', 'user', userId]  as const,
  details:    (id: string) => ['groups', 'detail', id]         as const,
  members:    (id: string) => ['groups', 'members', id]        as const,
}

export function useUserGroupsQuery() {
  const { profile } = useAuth()

  return useQuery<Group[], Error, Group[]>({
    queryKey: groupKeys.userGroups(profile?.id),
    queryFn:  () => unwrap(api.fetchUserGroups()),
    enabled:  !!profile?.id,
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
    onSuccess: () => {
      // FIX 3: Invalidate EVERYTHING related to groups to ensure sidebar updates
      safeInvalidate(qc, groupKeys.all)
      // FIX 4: Force the app to fetch the newly unlocked private tournaments!
      safeInvalidate(qc, ['tournaments'])
    },
  })
}

export function useCreateGroupMutation() {
  const qc = useQueryClient()
  return useMutation<Group, Error, { name: string; invite_code: string }>({
    mutationFn: (params) => unwrap(api.createGroup(params)),
    onSuccess: () => { 
      safeInvalidate(qc, groupKeys.all) 
      safeInvalidate(qc, ['tournaments'])
    },
  })
}

export function useDeleteGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (groupId) => unwrap(api.deleteGroup(groupId)),
    onSuccess: () => { 
      safeInvalidate(qc, groupKeys.all) 
      safeInvalidate(qc, ['tournaments'])
    },
  })
}

export function useLeaveGroupMutation() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (groupId) => unwrap(api.leaveGroup(groupId)),
    onSuccess: () => {
      safeInvalidate(qc, groupKeys.all)
      safeInvalidate(qc, ['tournaments'])
    },
  })
}