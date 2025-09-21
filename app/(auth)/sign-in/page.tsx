"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { UserRole, type AuthResponse } from "@/lib/types"
import { supabase } from "@/lib/supabase/client"

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignInForm = z.infer<typeof signInSchema>

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const retryWithBackoff = async <T,>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> => {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) break

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
      await sleep(delay)
    }
  }

  throw lastError!
}

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: SignInForm) => {
    if (isLoading) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const responseData = (await response.json()) as AuthResponse

      if (response.status === 429) {
        throw new Error("Rate limited")
      }

      const result = { response, responseData }

      if (!result.responseData.ok) {
        if (result.responseData.errors) {
          Object.entries(result.responseData.errors).forEach(([field, message]) => {
            if (message) {
              form.setError(field as keyof SignInForm, { message: message as string })
            }
          })
        }
        setError(result.responseData.message || "Something went wrong. Please try again.")
        return
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      })

      const redirectPath =
        result.responseData.role === UserRole.SUPPLIER
          ? "/dashboard/supplier"
          : result.responseData.role === UserRole.INFLUENCER
            ? "/dashboard/influencer"
            : "/shop/example-handle"

      router.push(redirectPath)
    } catch (err) {
      console.error("[v0] Sign-in error:", err)
      setError("Unable to sign in. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/api/auth/callback` }
      })
      if (error) throw error
    } catch (e) {
      toast({ title: "Google sign-in failed", description: String(e), variant: "destructive" })
    }
  }

  const handleKakaoSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/api/auth/callback` }
      })
      if (error) throw error
    } catch (e) {
      toast({ title: "Kakao sign-in failed", description: String(e), variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-indigo-600 text-white px-4 py-2 rounded-lg z-50"
        >
          Skip to main content
        </a>

        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">One-Link</h1>
          </Link>
          <h2 id="main-content" className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to your account to continue</p>
        </div>

        <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl font-semibold text-center">Sign In</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-sm font-medium bg-transparent"
                onClick={handleGoogleSignIn}
                aria-label="Sign in with Google"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 2.43-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-sm font-medium bg-yellow-300 hover:bg-yellow-400 text-gray-900"
                onClick={handleKakaoSignIn}
                aria-label="Sign in with Kakao"
              >
                {/* Simple Kakao glyph replacement */}
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Continue with Kakao
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">Or continue with email</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" role="alert">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.85-1.83-1.51-2.95-1.42-.15-1.15.41-2.35 1.05-3.11z"
                  />
                </svg>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <svg
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                            />
                          </svg>
                          <Input
                            {...field}
                            type="email"
                            placeholder="Enter your email"
                            className="pl-10 h-11"
                            autoComplete="email"
                            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                          />
                        </div>
                      </FormControl>
                      <FormMessage id="email-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <svg
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 01-8 0v4h8z"
                            />
                          </svg>
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="pl-10 pr-10 h-11"
                            autoComplete="current-password"
                            aria-describedby={form.formState.errors.password ? "password-error" : undefined}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage id="password-error" />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Link
                      href="/reset"
                      className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{" "}
                <Link
                  href="/sign-up"
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                >
                  Sign up
                </Link>
              </p>
            </div>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By continuing, you agree to our{" "}
              <Link
                href="/terms"
                className="underline hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="underline hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
              >
                Privacy Policy
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
