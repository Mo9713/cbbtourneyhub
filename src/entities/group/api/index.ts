// src/entities/group/api/index.ts

import { supabase, withAuth } from '../../../shared/infra/supabaseClient'
import type { Group, GroupMember, Profile, ServiceResult } from '../../../shared/types'

export async function fetchUserGroups(): Promise<ServiceResult<Group[]>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, groups (*)')
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data.map((item: any) => item.groups as Group) }
  })
}

export async function fetchGroupDetails(groupId: string): Promise<ServiceResult<Group>> {
  const { data, error } = await supabase.from('groups').select('*').eq('id', groupId).single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Group not found.' }
  return { ok: true, data: data as Group }
}

export async function fetchGroupMembers(
  groupId: string,
): Promise<ServiceResult<(GroupMember & { profile: Profile })[]>> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, joined_at, profiles (*)')
    .eq('group_id', groupId)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: data.map((item: any) => ({
      group_id: item.group_id, user_id: item.user_id, joined_at: item.joined_at, profile: item.profiles as Profile,
    })),
  }
}

export async function joinGroup(inviteCode: string): Promise<ServiceResult<string>> {
  return withAuth(async (user) => {
    const { data: group, error: groupError } = await supabase.from('groups').select('id').eq('invite_code', inviteCode).single()
    if (groupError || !group) return { ok: false, error: 'Invalid invite code or group not found.' }
    const { error: insertError } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    if (insertError) return { ok: false, error: insertError.message }
    return { ok: true, data: group.id as string }
  })
}

export async function createGroup(params: { name: string; invite_code: string }): Promise<ServiceResult<Group>> {
  return withAuth(async (user) => {
    const { data: group, error: createError } = await supabase
      .from('groups')
      .insert({ name: params.name, invite_code: params.invite_code, owner_id: user.id })
      .select()
      .single()
    if (createError || !group) return { ok: false, error: createError?.message ?? 'Group creation failed.' }
    const { error: memberError } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    if (memberError) return { ok: false, error: memberError.message }
    return { ok: true, data: group as Group }
  })
}

export async function deleteGroup(groupId: string): Promise<ServiceResult<string>> {
  return withAuth(async () => {
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: groupId }
  })
}

// FIX: Implement group departure for non-owners
export async function leaveGroup(groupId: string): Promise<ServiceResult<string>> {
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: groupId }
  })
}