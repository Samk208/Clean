import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { signUpSchema } from "@/lib/validators"
import { createAuthErrorResponse, createAuthSuccessResponse, createUserProfile, getUserByEmail } from "@/lib/auth-helpers"
import { type AuthResponse } from "@/lib/types"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Test Supabase connection first
    console.log('Testing Supabase connection...')
    console.log('Environment variables check:')
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING')
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')

    // Test supabaseAdmin connection
    try {
      const { data, error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true })
      if (error) {
        console.error('Supabase admin connection test failed:', error)
        return NextResponse.json(
          createAuthErrorResponse("Database connection failed. Please check configuration."),
          { status: 500 }
        )
      }
      console.log('Supabase admin connection test successful')
    } catch (connError) {
      console.error('Supabase admin connection error:', connError)
      return NextResponse.json(
        createAuthErrorResponse("Database connection error. Please check configuration."),
        { status: 500 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (e) {
      console.error('Failed to parse request body:', e)
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 })
    }

    console.log('Sign-up request body:', { ...body, password: '[REDACTED]', confirmPassword: '[REDACTED]' })

    const validation = signUpSchema.safeParse(body)

    if (!validation.success) {
      console.error('Validation failed:', validation.error.flatten())
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid input. Please check your details and try again.",
          fieldErrors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const { email, password, role, firstName, lastName } = validation.data
    const name = `${firstName} ${lastName}`

    console.log('Processing sign-up for:', { email, role, name })

    // Check if user already exists
    console.log('Checking if user exists...')
    const { data: existingUser, error: existingUserError } = await getUserByEmail(email)

    if (existingUserError) {
      // Do not fail sign-up just because the existence check failed.
      // Log and continue - duplicate will be caught by createUser below.
      console.warn('User existence check failed; proceeding to create user anyway:', existingUserError)
    }

    if (existingUser) {
      console.log('User already exists')
      return NextResponse.json(
        createAuthErrorResponse("A user with this email already exists."),
        { status: 409 }
      )
    }

    // Try using supabaseAdmin for auth operations to bypass client issues
    console.log('Creating Supabase auth user with admin client...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        name,
        role,
      }
    })

    if (authError) {
      console.error('Supabase admin auth error:', authError)
      const message = authError.message || 'Unable to create account'
      const isDuplicate = message.toLowerCase().includes('already') || message.toLowerCase().includes('registered')
      const status = isDuplicate ? 409 : 400
      return NextResponse.json(
        {
          ...createAuthErrorResponse(`Unable to create account: ${message}`),
          ...(process.env.NODE_ENV === 'development' ? { debug: { code: (authError as any).code, details: (authError as any).error_description || (authError as any).message } } : {}),
        },
        { status }
      )
    }

    if (!authData.user) {
      console.error('No user returned from Supabase admin auth')
      return NextResponse.json(
        createAuthErrorResponse("Account creation failed. Please try again."),
        { status: 400 }
      )
    }

    console.log('Auth user created with admin client, creating profile...')
    // Create user profile in database
    const user = await createUserProfile(authData.user.id, email, name, role)
    if (!user) {
      console.error('Failed to create user profile')
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        createAuthErrorResponse("Account creation failed. Please try again."),
        { status: 500 }
      )
    }

    console.log('User profile created successfully')

    // Immediately sign the user in to create a session cookie
    try {
      const supabase = createServerSupabaseClient(request)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        console.warn('Sign-in after sign-up failed; user must sign in manually:', signInError)
      } else {
        console.log('User signed in and session established after sign-up')
      }
    } catch (e) {
      console.warn('Failed to establish session after sign-up:', e)
    }

    return NextResponse.json(
      createAuthSuccessResponse(user, "Account created successfully! ")
    )
  } catch (error: any) {
    console.error('Unexpected sign-up error:', error)
    const body: any = createAuthErrorResponse("Something went wrong. Please try again.")
    if (process.env.NODE_ENV === 'development') {
      body.debug = { message: String(error?.message || error) }
    }
    return NextResponse.json(body, { status: 500 })
  }
}
