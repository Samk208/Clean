"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  Building,
  CreditCard,
  User,
  Check,
  X,
  AlertCircle,
} from "lucide-react"
import type { OnboardingData } from "../page"

const brandKYBSchema = z.object({
  businessId: z.string().min(5, "Business ID is required"),
  hasRetailPermit: z.boolean(),
})

type BrandKYBForm = z.infer<typeof brandKYBSchema>

interface BrandKYBStepProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: (stepData: Partial<OnboardingData>) => void
  onPrev: () => void
}

interface FileUploadState {
  file: File | null
  preview: string | null
  status: "idle" | "uploading" | "success" | "error"
  progress: number
  error?: string
}

export default function BrandKYBStep({ data, updateData, onNext, onPrev }: BrandKYBStepProps) {
  const [businessRegistration, setBusinessRegistration] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })
  const [retailPermit, setRetailPermit] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })
  const [bankAccountBook, setBankAccountBook] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })
  const [authorizedRepId, setAuthorizedRepId] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })

  const form = useForm<BrandKYBForm>({
    resolver: zodResolver(brandKYBSchema),
    defaultValues: {
      businessId: data.businessId || "",
      hasRetailPermit: false,
    },
  })

  const watchHasRetailPermit = form.watch("hasRetailPermit")

  const startSimulatedProgress = (setState: React.Dispatch<React.SetStateAction<FileUploadState>>) => {
    setState((prev) => ({ ...prev, status: "uploading", progress: 5 }))
    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.status !== "uploading") {
          clearInterval(interval)
          return prev
        }
        const next = Math.min(prev.progress + 7, 95)
        return { ...prev, progress: next }
      })
    }, 180)
    return () => clearInterval(interval)
  }

  const handleFileUpload = useCallback(
    async (
      file: File,
      type: "registration" | "permit" | "bank" | "rep",
      setState: React.Dispatch<React.SetStateAction<FileUploadState>>,
    ) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        })
        return
      }

      const allowed = [/^image\//, /^application\/pdf$/]
      if (!allowed.some((r) => r.test(file.type))) {
        toast({ title: "Invalid file type", description: "Only images and PDFs are allowed", variant: "destructive" })
        return
      }

      const reader = new FileReader()
      reader.onload = async (e) => {
        const preview = e.target?.result as string
        setState({ file, preview, status: "uploading", progress: 0 })
        const stop = startSimulatedProgress(setState)

        const documentType =
          type === "registration"
            ? "business_registration"
            : type === "permit"
              ? "business_license"
              : type === "bank"
                ? "bank_verification"
                : "authorized_rep_id"

        try {
          const form = new FormData()
          form.set("file", file)
          form.set("documentType", documentType)

          const res = await fetch("/api/onboarding/docs", { method: "POST", body: form })
          const json = await res.json().catch(() => null)
          if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload failed")

          stop()
          setState((prev) => ({ ...prev, status: "success", progress: 100 }))

          const updateKey =
            type === "registration"
              ? "businessRegistration"
              : type === "permit"
                ? "retailPermit"
                : type === "bank"
                  ? "bankAccountBook"
                  : "authorizedRepId"
          updateData({ [updateKey]: file })

          toast({ title: "Uploaded", description: `${file.name} uploaded successfully` })
        } catch (err: any) {
          setState((prev) => ({ ...prev, status: "error", progress: 0, error: err?.message || "Upload error" }))
          toast({ title: "Upload failed", description: String(err?.message || err), variant: "destructive" })
        }
      }
      reader.readAsDataURL(file)
    },
    [updateData],
  )

  const removeFile = (
    type: "registration" | "permit" | "bank" | "rep",
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>,
  ) => {
    setState({ file: null, preview: null, status: "idle", progress: 0 })
    const updateKey =
      type === "registration"
        ? "businessRegistration"
        : type === "permit"
          ? "retailPermit"
          : type === "bank"
            ? "bankAccountBook"
            : "authorizedRepId"
    updateData({ [updateKey]: undefined })
  }

  const onSubmit = (formData: BrandKYBForm) => {
    if (!businessRegistration.file || !bankAccountBook.file || !authorizedRepId.file) {
      toast({
        title: "Missing Documents",
        description: "Please upload all required documents to continue.",
        variant: "destructive",
      })
      return
    }

    if (formData.hasRetailPermit && !retailPermit.file) {
      toast({
        title: "Retail Permit Required",
        description: "Please upload your retail permit or uncheck the option.",
        variant: "destructive",
      })
      return
    }

    onNext(formData)
  }

  const FileUploadCard = ({
    title,
    description,
    icon: Icon,
    state,
    setState,
    type,
    accept = "image/*,application/pdf",
    required = true,
  }: {
    title: string
    description: string
    icon: any
    state: FileUploadState
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>
    type: "registration" | "permit" | "bank" | "rep"
    accept?: string
    required?: boolean
  }) => (
    <Card className="border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {title} {required && <span className="text-red-500">*</span>}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{description}</p>

            {state.file ? (
              <div className="space-y-3">
                {state.preview && (
                  <div className="relative">
                    <img
                      src={state.preview || "/placeholder.svg"}
                      alt="Document preview"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{state.file.name}</span>
                  <div className="flex items-center gap-2">
                    {state.status === "success" && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <Check className="w-3 h-3 mr-1" />
                        Uploaded
                      </Badge>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => removeFile(type, setState)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {state.status === "uploading" && (
                  <div className="space-y-2">
                    <Progress value={state.progress} className="h-2" />
                    <p className="text-xs text-gray-500">Uploading... {state.progress}%</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-1">Drop your file here or click to browse</p>
                <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                <input
                  type="file"
                  accept={accept}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, type, setState)
                  }}
                  className="hidden"
                  id={`${type}-upload`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 bg-transparent"
                  onClick={() => document.getElementById(`${type}-upload`)?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Business Verification</CardTitle>
          <p className="text-center text-gray-600 dark:text-gray-400">
            We need to verify your business to ensure secure transactions
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Security Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Your Business Data is Protected</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  All business documents are encrypted and stored securely. We only use this information for business
                  verification and compliance purposes.
                </p>
              </div>
            </div>
          </div>

          {/* File Uploads */}
          <div className="grid gap-6">
            <FileUploadCard
              title="Business Registration Certificate"
              description="Upload your official business registration or incorporation certificate"
              icon={Building}
              state={businessRegistration}
              setState={setBusinessRegistration}
              type="registration"
            />

            <FileUploadCard
              title="Bank Account Book / Voided Check"
              description="Upload your business bank account book or a voided check"
              icon={CreditCard}
              state={bankAccountBook}
              setState={setBankAccountBook}
              type="bank"
            />

            <FileUploadCard
              title="Authorized Representative ID"
              description="Upload ID document of the person authorized to represent the business"
              icon={User}
              state={authorizedRepId}
              setState={setAuthorizedRepId}
              type="rep"
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Details */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Business Information</CardTitle>
          <p className="text-gray-600 dark:text-gray-400">Additional business details for verification</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="businessId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business ID (TIN/VAT/BRN) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your business tax ID or registration number"
                        className="h-11"
                        onChange={(e) => {
                          field.onChange(e)
                          updateData({ businessId: e.target.value })
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      Tax Identification Number, VAT Number, or Business Registration Number
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hasRetailPermit"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal">I have a mail-order/online retail permit</FormLabel>
                      <p className="text-xs text-gray-500">
                        Check this if your business has a specific permit for online retail operations
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {watchHasRetailPermit && (
                <FileUploadCard
                  title="Mail-Order/Online Retail Permit"
                  description="Upload your mail-order or online retail permit"
                  icon={FileText}
                  state={retailPermit}
                  setState={setRetailPermit}
                  type="permit"
                  required={true}
                />
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-6">
                <Button type="button" variant="outline" onClick={onPrev}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
