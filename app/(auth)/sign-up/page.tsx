"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { z } from "zod"
import type { Icon } from "@/lib/types"
import { supabase } from "@/lib/supabase/client"

const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  role: z.enum(["supplier", "influencer", "customer"], {
    required_error: "Please select a role",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type SignUpForm = z.infer<typeof signUpSchema>

const StoreIcon: Icon = ({ className }) => (
  <svg className={className || "h-6 w-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
)

const UsersIcon: Icon = ({ className }) => (
  <svg className={className || "h-6 w-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
    />
  </svg>
)

const ShoppingBagIcon: Icon = ({ className }) => (
  <svg className={className || "h-6 w-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z"
    />
  </svg>
)

const roleOptions = [
  {
    value: "supplier",
    label: "Supplier",
    description: "I want to sell products through influencers",
    icon: StoreIcon,
    badge: "Business",
    color: "bg-green-50 border-green-200 text-green-800",
    features: ["Product management", "Commission tracking", "Analytics dashboard", "Brand verification"]
  },
  {
    value: "influencer",
    label: "Influencer",
    description: "I want to create my shop and earn commissions",
    icon: UsersIcon,
    badge: "Creator",
    color: "bg-purple-50 border-purple-200 text-purple-800",
    features: ["Personal storefront", "Commission earnings", "Social media integration", "Identity verification"]
  },
  {
    value: "customer",
    label: "Customer",
    description: "I want to shop from my favorite influencers",
    icon: ShoppingBagIcon,
    badge: "Shopper",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    features: ["Personalized shopping", "Follow creators", "Exclusive deals", "Easy checkout"]
  },
]

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const form = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: undefined,
    },
  })

  const watchedRole = form.watch("role")

  const onSubmit = async (data: SignUpForm) => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!result.ok) {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, message]) => {
            if (message) {
              form.setError(field as keyof SignUpForm, { message: message as string })
            }
          })
        }
        setError(result.error || "Something went wrong. Please try again.")
        return
      }

      toast({
        title: "Account created successfully!",
        description: "Welcome to One-Link! Let's set up your profile.",
      })

      // Ensure a real session exists: sign in client-side
      try {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (signInErr) {
          // Non-fatal: user can still be redirected but onboarding will require sign-in
          console.warn("Client sign-in after sign-up failed:", signInErr)
        }
      } catch (e) {
        console.warn("Client sign-in threw:", e)
      }

      // Enhanced routing: Direct to advanced onboarding for suppliers and influencers
      const redirectPath =
        result.role === "supplier" || result.role === "influencer"
          ? `/auth/onboarding?role=${result.role === "supplier" ? "brand" : "influencer"}`
          : "/shop"

      router.push(redirectPath)
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/api/auth/callback` }
      })
      if (error) throw error
    } catch (e) {
      toast({ title: "Google sign-up failed", description: String(e), variant: "destructive" })
    }
  }

  const handleKakaoSignUp = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/api/auth/callback` }
      })
      if (error) throw error
    } catch (e) {
      toast({ title: "Kakao sign-up failed", description: String(e), variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-4xl space-y-8">
        {/* Skip to main content link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-indigo-600 text-white px-4 py-2 rounded-lg z-50"
        >
          Skip to main content
        </a>

        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">One-Link</h1>
          </Link>
          <h2 id="main-content" className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Join thousands of suppliers, influencers, and customers
          </p>
        </div>

        <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl font-semibold text-center">Sign Up</CardTitle>
            <CardDescription className="text-center">Choose your account type and create your profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Social Sign Up Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-sm font-medium bg-transparent"
                onClick={handleGoogleSignUp}
                aria-label="Sign up with Google"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
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
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 text-sm font-medium bg-yellow-300 hover:bg-yellow-400 text-gray-900"
                onClick={handleKakaoSignUp}
                aria-label="Sign up with Kakao"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Kakao
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

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" role="alert">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Sign Up Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Enhanced Role Selection */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-base font-medium">I am a... *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-1 gap-4"
                          aria-describedby={form.formState.errors.role ? "role-error" : undefined}
                        >
                          {roleOptions.map((option) => {
                            const Icon = option.icon
                            const isSelected = field.value === option.value
                            return (
                              <div key={option.value} className="flex items-center space-x-3">
                                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                                <Label
                                  htmlFor={option.value}
                                  className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                                    isSelected
                                      ? "border-indigo-500 bg-indigo-50 shadow-md"
                                      : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="flex items-start space-x-4">
                                    <div className={`p-2 rounded-lg ${isSelected ? "bg-indigo-100" : "bg-gray-100"}`}>
                                      <Icon className={isSelected ? "text-indigo-600" : "text-gray-600"} />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="font-semibold text-gray-900 dark:text-white">{option.label}</div>
                                        <Badge variant="secondary" className={`text-xs ${option.color}`}>
                                          {option.badge}
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {option.description}
                                      </div>
                                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                                        {option.features.map((feature, idx) => (
                                          <div key={idx} className="flex items-center">
                                            <div className="w-1 h-1 bg-gray-400 rounded-full mr-2"></div>
                                            {feature}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </Label>
                              </div>
                            )
                          })}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage id="role-error" />
                    </FormItem>
                  )}
                />

                {/* Enhanced Onboarding Preview */}
                {watchedRole && (watchedRole === "supplier" || watchedRole === "influencer") && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">
                      🚀 What happens next?
                    </h4>
                    <p className="text-sm text-blue-800 mb-3">
                      After creating your account, you'll complete a comprehensive onboarding process including:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                      <div>✓ Profile setup</div>
                      <div>✓ Identity verification</div>
                      <div>✓ Document upload</div>
                      <div>✓ Payment setup</div>
                    </div>
                  </div>
                )}

                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">First name</FormLabel>
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
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <Input
                              {...field}
                              placeholder="First name"
                              className="pl-10 h-11"
                              autoComplete="given-name"
                              aria-describedby={form.formState.errors.firstName ? "firstName-error" : undefined}
                            />
                          </div>
                        </FormControl>
                        <FormMessage id="firstName-error" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Last name</FormLabel>
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
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <Input
                              {...field}
                              placeholder="Last name"
                              className="pl-10 h-11"
                              autoComplete="family-name"
                              aria-describedby={form.formState.errors.lastName ? "lastName-error" : undefined}
                            />
                          </div>
                        </FormControl>
                        <FormMessage id="lastName-error" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email */}
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
                              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
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

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Create password"
                              className="pl-10 pr-10 h-11"
                              autoComplete="new-password"
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
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
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

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Confirm password</FormLabel>
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
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm password"
                              className="pl-10 pr-10 h-11"
                              autoComplete="new-password"
                              aria-describedby={
                                form.formState.errors.confirmPassword ? "confirmPassword-error" : undefined
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? (
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
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
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
                        <FormMessage id="confirmPassword-error" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-white font-medium text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>
            </Form>

            {/* Sign In Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {/* Terms */}
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
