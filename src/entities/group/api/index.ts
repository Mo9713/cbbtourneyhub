// src/entities/group/api/index.ts
//
// BUG FIX (B-2): fetchGroupDetails now wrapped in withAuth. Previously it
// used the anon Supabase client, causing RLS to reject the query for any
// user whose policy requires authentication to read group rows. The component
// receiving null returned early, making the group dashboard disappear.
//
// BUG FIX (B-3): joinGroup now checks for an existing membership row before
// inserting. Without this, either a duplicate-key Postgres error leaked as
// a raw error message, or a second row was inserted depending on RLS policy.
// A friendly "already a member" message is returned instead.
//
// NITPICK FIX: fetchUserGroups .filter(Boolean) guards against null group
// entries that can appear when a left-join row has an RLS-blocked groups
// column (returns null instead of throwing).

import { supabase, withAuth } from '../../../shared/infra/supabaseClient'
import type { Group, GroupMember, Profile, ServiceResult } from '../../../shared/types'

export async function fetchUserGroups(): Promise<ServiceResult<Group[]>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, groups (*)')
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    // NITPICK FIX: filter(Boolean) drops null entries from RLS-blocked rows.
    return {
      ok:   true,
      data: data
        .map((item: any) => item.groups as Group)
        .filter(Boolean),
    }
  })
}

// BUG FIX B-2: wrapped in withAuth so authenticated RLS policies are
// satisfied. Previously called as the anon client and silently failed
// for users whose group rows are locked behind an auth check.
export async function fetchGroupDetails(groupId: string): Promise<ServiceResult<Group>> {
  return withAuth(async () => {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Group not found.' }
    return { ok: true, data: data as Group }
  })
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
      group_id:  item.group_id,
      user_id:   item.user_id,
      joined_at: item.joined_at,
      profile:   item.profiles as Profile,
    })),
  }
}

export async function joinGroup(inviteCode: string): Promise<ServiceResult<string>> {
  return withAuth(async (user) => {
    // Resolve the group from the invite code.
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single()
    if (groupError || !group) {
      return { ok: false, error: 'Invalid invite code or group not found.' }
    }

    // BUG FIX B-3: Check for an existing membership row before inserting.
    // Without this, a unique-constraint violation surfaces as a raw Postgres
    // error string, or a duplicate row is silently created.
    const { data: existing } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return { ok: false, error: 'You are already a member of this group.' }
    }

    const { error: insertError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id })
    if (insertError) return { ok: false, error: insertError.message }

    return { ok: true, data: group.id as string }
  })
}

export async function createGroup(params: {
  name:        string
  invite_code: string
}): Promise<ServiceResult<Group>> {
  return withAuth(async (user) => {
    const { data: group, error: createError } = await supabase
      .from('groups')
      .insert({ name: params.name, invite_code: params.invite_code, owner_id: user.id })
      .select()
      .single()
    if (createError || !group) {
      return { ok: false, error: createError?.message ?? 'Group creation failed.' }
    }
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id })
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