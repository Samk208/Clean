"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  Camera,
  MapPin,
  CreditCard,
  Check,
  X,
  AlertCircle,
} from "lucide-react"
import type { OnboardingData } from "../page"

const influencerKYCSchema = z.object({
  bankAccountHolder: z.string().min(2, "Account holder name is required"),
  bankAccount: z.string().min(8, "Please enter a valid account number or IBAN"),
})

type InfluencerKYCForm = z.infer<typeof influencerKYCSchema>

interface InfluencerKYCStepProps {
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

const documentTypes = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
]

export default function InfluencerKYCStep({ data, updateData, onNext, onPrev }: InfluencerKYCStepProps) {
  const [idDocument, setIdDocument] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })
  const [selfiePhoto, setSelfiePhoto] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })
  const [proofOfAddress, setProofOfAddress] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })
  const [bankStatement, setBankStatement] = useState<FileUploadState>({
    file: null,
    preview: null,
    status: "idle",
    progress: 0,
  })

  const [selectedDocType, setSelectedDocType] = useState("")
  const [showLivenessPrompt, setShowLivenessPrompt] = useState(false)

  const form = useForm<InfluencerKYCForm>({
    resolver: zodResolver(influencerKYCSchema),
    defaultValues: {
      bankAccountHolder: data.bankAccountHolder || "",
      bankAccount: data.bankAccount || "",
    },
  })

  // Simulate progress while awaiting the network upload
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
      type: "id" | "selfie" | "address" | "bank",
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

      // For preview
      const reader = new FileReader()
      reader.onload = async (e) => {
        const preview = e.target?.result as string
        setState({ file, preview, status: "uploading", progress: 0 })
        const stop = startSimulatedProgress(setState)

        // Map UI type to server documentType
        const documentType =
          type === "id"
            ? "government_id"
            : type === "selfie"
              ? "selfie_verification"
              : type === "address"
                ? "proof_of_address"
                : "bank_statement"

        try {
          const form = new FormData()
          form.set("file", file)
          form.set("documentType", documentType)

          const res = await fetch("/api/onboarding/docs", {
            method: "POST",
            body: form,
          })

          const json = await res.json().catch(() => null)
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error || "Upload failed")
          }

          stop()
          setState((prev) => ({ ...prev, status: "success", progress: 100 }))

          // Update parent with the uploaded file meta to guard navigation
          const updateKey =
            type === "id"
              ? "idDocument"
              : type === "selfie"
                ? "selfiePhoto"
                : type === "address"
                  ? "proofOfAddress"
                  : "bankStatement"
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
    type: "id" | "selfie" | "address" | "bank",
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>,
  ) => {
    setState({ file: null, preview: null, status: "idle", progress: 0 })
    const updateKey =
      type === "id"
        ? "idDocument"
        : type === "selfie"
          ? "selfiePhoto"
          : type === "address"
            ? "proofOfAddress"
            : "bankStatement"
    updateData({ [updateKey]: undefined })
  }

  const startSelfieCapture = () => {
    setShowLivenessPrompt(true)
  }

  const onSubmit = (formData: InfluencerKYCForm) => {
    if (!idDocument.file || !selfiePhoto.file || !proofOfAddress.file || !bankStatement.file) {
      toast({
        title: "Missing Documents",
        description: "Please upload all required documents to continue.",
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
    type: "id" | "selfie" | "address" | "bank"
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
                  onClick={() => {
                    if (type === "selfie") {
                      startSelfieCapture()
                    } else {
                      document.getElementById(`${type}-upload`)?.click()
                    }
                  }}
                >
                  {type === "selfie" ? <Camera className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  {type === "selfie" ? "Take Selfie" : "Choose File"}
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
          <CardTitle className="text-2xl font-bold text-center">Identity Verification</CardTitle>
          <p className="text-center text-gray-600 dark:text-gray-400">
            We need to verify your identity to ensure secure transactions
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Security Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Your Privacy is Protected</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  All documents are encrypted and stored securely. We only use this information for identity
                  verification and compliance purposes.
                </p>
              </div>
            </div>
          </div>

          {/* Document Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select ID Document Type *</label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose your ID document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Uploads */}
          <div className="grid gap-6">
            <FileUploadCard
              title="ID Document"
              description="Upload a clear photo of your government-issued ID"
              icon={FileText}
              state={idDocument}
              setState={setIdDocument}
              type="id"
            />

            <FileUploadCard
              title="Selfie Photo"
              description="Take a selfie holding your ID document next to your face"
              icon={Camera}
              state={selfiePhoto}
              setState={setSelfiePhoto}
              type="selfie"
              accept="image/*"
            />

            <FileUploadCard
              title="Proof of Address"
              description="Upload a utility bill or bank statement from the last 3 months"
              icon={MapPin}
              state={proofOfAddress}
              setState={setProofOfAddress}
              type="address"
            />

            <FileUploadCard
              title="Bank Statement"
              description="Upload your bank statement or passbook showing account details"
              icon={CreditCard}
              state={bankStatement}
              setState={setBankStatement}
              type="bank"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank Account Details */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Bank Account Information</CardTitle>
          <p className="text-gray-600 dark:text-gray-400">Provide your bank account details for commission payments</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankAccountHolder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Full name as on bank account"
                          className="h-11"
                          onChange={(e) => {
                            field.onChange(e)
                            updateData({ bankAccountHolder: e.target.value })
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number / IBAN *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Account number or IBAN"
                          className="h-11"
                          onChange={(e) => {
                            field.onChange(e)
                            updateData({ bankAccount: e.target.value })
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

      {/* Liveness Prompt Modal */}
      {showLivenessPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Take Your Selfie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Camera className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                <p className="text-sm text-gray-600 mb-4">
                  Please take a clear selfie while holding your ID document next to your face. Make sure both your face
                  and the ID are clearly visible.
                </p>
                <div className="space-y-2 text-xs text-gray-500">
                  <p>• Ensure good lighting</p>
                  <p>• Look directly at the camera</p>
                  <p>• Hold ID document clearly visible</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setShowLivenessPrompt(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    setShowLivenessPrompt(false)
                    document.getElementById("selfie-upload")?.click()
                  }}
                >
                  Take Photo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
