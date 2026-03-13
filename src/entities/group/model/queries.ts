// src/entities/group/model/queries.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/infra/supabaseClient'
import type { Group, GroupMember, Profile } from '../../../shared/types'

export const groupKeys = {
  all: ['groups'] as const,
  userGroups: () => [...groupKeys.all, 'user'] as const,
  details: (id: string) => [...groupKeys.all, 'detail', id] as const,
  members: (id: string) => [...groupKeys.all, 'members', id] as const,
}

export function useUserGroupsQuery() {
  return useQuery({
    queryKey: groupKeys.userGroups(),
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (*)
        `)
        .eq('user_id', user.id)

      if (error) throw new Error(error.message)
      
      return data.map((item: any) => item.groups as Group)
    },
  })
}

export function useGroupDetailsQuery(groupId: string) {
  return useQuery({
    queryKey: groupKeys.details(groupId),
    queryFn: async () => {
      if (!groupId) return null

      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (error) throw new Error(error.message)
      return data as Group
    },
    enabled: !!groupId,
  })
}

export function useGroupMembersQuery(groupId: string) {
  return useQuery({
    queryKey: groupKeys.members(groupId),
    queryFn: async () => {
      if (!groupId) return []

      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          user_id,
          joined_at,
          profiles (*)
        `)
        .eq('group_id', groupId)

      if (error) throw new Error(error.message)

      // Explicitly utilizing GroupMember to resolve TS6196
      return data.map((item: any): GroupMember & { profile: Profile } => ({
        group_id: item.group_id,
        user_id: item.user_id,
        joined_at: item.joined_at,
        profile: item.profiles as Profile
      }))
    },
    enabled: !!groupId,
  })
}

export function useJoinGroupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()

      if (groupError || !group) throw new Error('Invalid invite code or group not found.')

      const { error: insertError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id })

      if (insertError) throw new Error(insertError.message)
      
      return group.id
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.userGroups() })
      queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) })
    },
  })
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { name: string; invite_code: string }) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const { data: group, error: createError } = await supabase
        .from('groups')
        .insert({ 
          name: params.name, 
          invite_code: params.invite_code, 
          owner_id: user.id 
        })
        .select()
        .single()

      if (createError) throw new Error(createError.message)

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id })

      if (memberError) throw new Error(memberError.message)

      return group as Group
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.userGroups() })
    },
  })
}