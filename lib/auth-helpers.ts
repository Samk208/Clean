import { createServerSupabaseClient } from './supabase/server'
import { supabaseAdmin, type Inserts, type Updates } from './supabase/admin'
import { UserRole, type User, type AuthResponse } from './types'
import { NextRequest } from 'next/server'
import type { TypedSupabaseClient } from './supabase/types'
import type { QueryData, QueryResult } from '@supabase/supabase-js'

// Get current user from supabase client
export async function getCurrentUser(supabase: TypedSupabaseClient): Promise<User | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    // Use proper type inference with QueryData pattern
    const query = supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    
    const { data: user, error } = await query

    if (error || !user) return null

    // Transform database user to User type
    return {
      id: user.id,
      email: session.user.email ?? '',
      name: (user as any).name ?? '',
      role: (user as any).role as UserRole,
      avatar: (user as any).avatar || undefined,
      verified: (user as any).verified || false,
      createdAt: user.created_at ?? new Date().toISOString(),
      updatedAt: user.updated_at ?? new Date().toISOString()
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Verify user role
export function hasRole(user: User | null, allowedRoles: UserRole[]): boolean {
  if (!user) return false
  return allowedRoles.includes(user.role)
}

// Create user profile in database
export async function createUserProfile(
  userId: string,
  email: string,
  name: string,
  role: UserRole
): Promise<User | null> {
  try {
    console.log('Creating user profile with:', { userId, email, name, role })
    
    // Create the insert object with proper typing
    const insertData: Inserts<'profiles'> = {
      id: userId,
      // email is stored in auth.users; profiles keeps app fields
      name,
      role,
      verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any
    
    // Use supabaseAdmin to bypass RLS for user creation
    // Upsert to avoid conflicts with the on_auth_user_created trigger
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .upsert(insertData as any, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('Error creating user profile:', error)
      return null
    }

    if (!user) return null

    console.log('User profile created successfully:', user)
    
    // Transform to User type
    return {
      id: user.id,
      email: email ?? '',
      name: (user as any).name ?? '',
      role: (user as any).role as UserRole,
      avatar: (user as any).avatar || undefined,
      verified: (user as any).verified || false,
      createdAt: user.created_at ?? new Date().toISOString(),
      updatedAt: user.updated_at ?? new Date().toISOString()
    }
  } catch (error) {
    console.error('Unexpected error creating user profile:', error)
    return null
  }
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<User, 'name' | 'avatar' | 'verified'>>
): Promise<User | null> {
  try {
    // Create the update object with proper typing
    const updateData: Updates<'profiles'> = {
      ...(updates.name && { name: updates.name }),
      ...(updates.avatar !== undefined && { avatar: updates.avatar || null }),
      ...(updates.verified !== undefined && { verified: updates.verified }),
      updated_at: new Date().toISOString(),
    }

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData as any)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return null
    }

    if (!user) return null

    // Transform to User type
    return {
      id: user.id,
      email: '',
      name: (user as any).name ?? '',
      role: (user as any).role as UserRole,
      avatar: (user as any).avatar || undefined,
      verified: (user as any).verified || false,
      createdAt: user.created_at ?? new Date().toISOString(),
      updatedAt: user.updated_at ?? new Date().toISOString()
    }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return null
  }
}

// Generate error response
export function createAuthErrorResponse(
  message: string,
  errors?: Record<string, string>
): AuthResponse {
  return {
    ok: false,
    message,
    errors,
  }
}

// Generate success response
export function createAuthSuccessResponse(
  user: User,
  message?: string
): AuthResponse {
  return {
    ok: true,
    role: user.role,
    user,
    message,
  }
}

// Check if user is verified (for actions requiring verification)
export function requiresVerification(role: UserRole): boolean {
  return ['supplier', 'influencer'].includes(role)
}

// Get user by email
export async function getUserByEmail(email: string): Promise<{ data: User | null; error?: any }> {
  try {
    // Look up real existence in auth.users via Admin API
    // Note: Supabase JS Admin API doesn't expose getUserByEmail in all versions, so we list and filter.
    // This is acceptable for low volume sign-ups; for high volume, implement a server-side RPC.
    const perPage = 200
    let page = 1
    let foundUser: any | null = null
    // Normalize email case for comparison
    const target = email.trim().toLowerCase()

    // Paginate until we find the user or exhaust
    while (true) {
      const { data: pageData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (listErr) return { data: null, error: listErr }
      const users = pageData?.users || []
      const match = users.find((u: any) => (u.email || '').trim().toLowerCase() === target)
      if (match) {
        foundUser = match
        break
      }
      if (!users.length) break
      page += 1
      // Safety cap for pagination
      if (page > 25) break
    }

    if (!foundUser) return { data: null, error: null }

    // Fetch profile to build a complete User object if present
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', foundUser.id)
      .maybeSingle()

    const transformedUser: User = {
      id: foundUser.id,
      email: foundUser.email ?? email,
      name: (profile as any)?.name ?? '',
      role: ((profile as any)?.role ?? 'customer') as UserRole,
      avatar: (profile as any)?.avatar || undefined,
      verified: (profile as any)?.verified || false,
      createdAt: (profile as any)?.created_at ?? new Date().toISOString(),
      updatedAt: (profile as any)?.updated_at ?? new Date().toISOString()
    }

    return { data: transformedUser, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
