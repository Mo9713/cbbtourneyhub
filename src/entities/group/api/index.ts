// src/entities/group/api/index.ts
//
// C-03 FIX: This file now contains ONLY raw, framework-agnostic Supabase
// async functions returning ServiceResult<T>. TanStack Query hooks have
// been moved to their correct home at entities/group/model/queries.ts
// and are exported through entities/group/model/index.ts.
//
// The previous violation: this file re-exported React hooks (useQuery,
// useMutation wrappers) from model/queries.ts, making the api/ sublayer
// dependent on React — an inversion of the sublayer contract.

import { supabase, withAuth } from '../../../shared/infra/supabaseClient'
import type { Group, GroupMember, Profile, ServiceResult } from '../../../shared/types'

// ── Reads ─────────────────────────────────────────────────────

/**
 * Fetches all groups the authenticated user is a member of.
 * Uses a join so a single query returns the full Group shape.
 */
export async function fetchUserGroups(): Promise<ServiceResult<Group[]>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        groups (*)
      `)
      .eq('user_id', user.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data.map((item: any) => item.groups as Group) }
  })
}

/**
 * Fetches the details for a single group by ID.
 * Does not require auth — group metadata is publicly readable per RLS.
 */
export async function fetchGroupDetails(groupId: string): Promise<ServiceResult<Group>> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Group not found.' }
  return { ok: true, data: data as Group }
}

/**
 * Fetches all members of a group, joined with their profile rows.
 */
export async function fetchGroupMembers(
  groupId: string,
): Promise<ServiceResult<(GroupMember & { profile: Profile })[]>> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      user_id,
      joined_at,
      profiles (*)
    `)
    .eq('group_id', groupId)

  if (error) return { ok: false, error: error.message }

  return {
    ok:   true,
    data: data.map((item: any): GroupMember & { profile: Profile } => ({
      group_id:  item.group_id,
      user_id:   item.user_id,
      joined_at: item.joined_at,
      profile:   item.profiles as Profile,
    })),
  }
}

// ── Mutations ─────────────────────────────────────────────────

/**
 * Looks up a group by invite code and inserts the authenticated user
 * as a member. Returns the joined group's ID on success.
 */
export async function joinGroup(inviteCode: string): Promise<ServiceResult<string>> {
  return withAuth(async (user) => {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single()

    if (groupError || !group) {
      return { ok: false, error: 'Invalid invite code or group not found.' }
    }

    const { error: insertError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id })

    if (insertError) return { ok: false, error: insertError.message }
    return { ok: true, data: group.id as string }
  })
}

/**
 * Creates a new group and immediately adds the creator as a member.
 */
export async function createGroup(
  params: { name: string; invite_code: string },
): Promise<ServiceResult<Group>> {
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

/**
 * Permanently deletes a group. RLS enforces that only the owner can do this.
 * Returns the deleted group ID so callers can evict it from local state.
 */
export async function deleteGroup(groupId: string): Promise<ServiceResult<string>> {
  return withAuth(async () => {
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: groupId }
  })
}