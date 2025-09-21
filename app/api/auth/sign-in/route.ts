export const runtime = 'nodejs'

import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from "next/headers"
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { signInSchema } from '@/lib/validators'
import { createAuthErrorResponse, createAuthSuccessResponse } from '@/lib/auth-helpers'
import { type AuthResponse } from "@/lib/types"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('Sign-in attempt started')
    const cookieStore = cookies()
    const supabase = await createServerSupabaseClient()

    let body
    try {
      body = await request.json()
    } catch (e) {
      console.error('Failed to parse request body:', e)
      return NextResponse.json(
        createAuthErrorResponse('Invalid request body'),
        { status: 400 }
      )
    }

    console.log('Sign-in request for email:', body.email)

    // Validate input
    const validation = signInSchema.safeParse(body)
    if (!validation.success) {
      console.error('Validation failed:', validation.error.flatten())
      const errors: Record<string, string> = {}
      validation.error.errors.forEach((error) => {
        errors[error.path[0] as string] = error.message
      })

      return NextResponse.json(
        createAuthErrorResponse('Please check your input and try again.', errors),
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Attempt to sign in with Supabase
    console.log('Attempting Supabase auth sign-in...')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('Supabase auth error:', authError)
      return NextResponse.json(
        createAuthErrorResponse('Invalid email or password. Please check your credentials and try again.'),
        { status: 401 }
      )
    }

    console.log('Supabase auth successful, fetching user profile...')
    // Get auth user id then fetch profile from view
    const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser()
    if (getUserError || !authUser) {
      console.error('Failed to get authenticated user:', getUserError)
      return NextResponse.json(
        createAuthErrorResponse('Authentication state error. Please try again.'),
        { status: 500 }
      )
    }

    // Fetch minimal profile fields from public.profiles (accessible to authenticated users via RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role, verified, created_at, updated_at')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      console.error('User profile lookup error:', profileError)
      return NextResponse.json(
        createAuthErrorResponse('User profile not found. Please contact support.'),
        { status: 404 }
      )
    }

    if (!profile) {
      console.error('No user profile found for email:', email)
      return NextResponse.json(
        createAuthErrorResponse('User profile not found. Please contact support.'),
        { status: 404 }
      )
    }

    const responseUser = {
      ...(profile as any),
      email: authUser.email ?? email,
    }

    console.log('Sign-in successful for user:', (responseUser as any).id)
    return NextResponse.json(createAuthSuccessResponse(responseUser as any))
  } catch (error) {
    console.error('Unexpected sign-in error:', error)
    return NextResponse.json(
      createAuthErrorResponse('Something went wrong. Please try again.'),
      { status: 500 }
    )
  }
}

