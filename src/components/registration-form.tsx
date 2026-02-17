
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ChevronRight, 
  ChevronLeft,
  FileText,
  ShieldCheck,
  Building2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { confirmNspsStatus, ConfirmNspsStatusOutput } from "@/ai/flows/confirm-nsps-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const formSchema = z.object({
  applicantName: z.string().min(2, "Name must be at least 2 characters"),
  citizenship: z.string().min(2, "Please provide your citizenship"),
  educationLevel: z.string().min(1, "Select your education level"),
  employmentStatus: z.string().min(1, "Select your employment status"),
  declarationText: z.string().min(50, "Please provide a more detailed declaration (min 50 chars)"),
})

type FormValues = z.infer<typeof formSchema>

export function RegistrationForm() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConfirmNspsStatusOutput | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicantName: "",
      citizenship: "",
      educationLevel: "",
      employmentStatus: "",
      declarationText: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const response = await confirmNspsStatus(values)
      setResult(response)
      setStep(3)
    } catch (error) {
      console.error("Confirmation failed", error)
    } finally {
      setLoading(false)
    }
  }

  const nextStep = async () => {
    const fields = step === 1 
      ? ['applicantName', 'citizenship', 'educationLevel', 'employmentStatus'] 
      : ['declarationText']
    
    const isValid = await form.trigger(fields as any)
    if (isValid) setStep(step + 1)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-4">
        {[
          { icon: Building2, label: "Identity" },
          { icon: FileText, label: "Declaration" },
          { icon: ShieldCheck, label: "Verification" }
        ].map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-2 group flex-1">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
              step > i + 1 ? "bg-accent border-accent text-white" : 
              step === i + 1 ? "bg-primary border-primary text-white shadow-lg" : 
              "border-muted text-muted-foreground"
            )}>
              <s.icon className="h-5 w-5" />
            </div>
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider",
              step === i + 1 ? "text-primary" : "text-muted-foreground"
            )}>{s.label}</span>
            {i < 2 && (
              <div className="absolute w-full h-0.5 bg-muted top-5 left-1/2 -z-10 group-last:hidden" />
            )}
          </div>
        ))}
      </div>

      <Card className="border-border/50 shadow-xl bg-white overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardHeader className="bg-secondary/30 pb-8 border-b">
              <CardTitle className="text-2xl font-headline text-primary">
                {step === 1 ? "Basic Information" : step === 2 ? "Self Declaration" : "Confirmation Results"}
              </CardTitle>
              <CardDescription>
                {step === 1 ? "Provide your current professional and educational details." : 
                 step === 2 ? "Declare your eligibility and security relevance." : 
                 "System evaluation of your NSPS status."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              {step === 1 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="applicantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Legal Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="citizenship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Citizenship</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. United States" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="educationLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Education Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="High School">High School</SelectItem>
                            <SelectItem value="Bachelor's Degree">Bachelor's Degree</SelectItem>
                            <SelectItem value="Master's Degree">Master's Degree</SelectItem>
                            <SelectItem value="PhD / Doctorate">PhD / Doctorate</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Government Employee">Government Employee</SelectItem>
                            <SelectItem value="Private Sector">Private Sector</SelectItem>
                            <SelectItem value="Unemployed">Unemployed</SelectItem>
                            <SelectItem value="Student">Student</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === 2 && (
                <FormField
                  control={form.control}
                  name="declarationText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Eligibility Declaration</FormLabel>
                      <FormDescription>
                        Explain why you are eligible for NSPS status and describe your background in relation to national security requirements.
                      </FormDescription>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide a detailed statement..." 
                          className="min-h-[200px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {step === 3 && result && (
                <div className="space-y-6">
                  {result.isNspsConfirmed ? (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <AlertTitle className="text-green-800 font-bold">NSPS Status Confirmed</AlertTitle>
                      <AlertDescription className="text-green-700">
                        The automated system has successfully validated your preliminary NSPS status.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle>Action Required</AlertTitle>
                      <AlertDescription>
                        Your NSPS status could not be automatically confirmed with the current information.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="bg-secondary/30 rounded-lg p-6 space-y-4">
                    <div>
                      <h4 className="font-bold text-sm uppercase text-muted-foreground mb-1">Confirmation Reason</h4>
                      <p className="text-sm leading-relaxed">{result.confirmationReason}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm uppercase text-muted-foreground mb-1">Next Steps</h4>
                      <p className="text-sm leading-relaxed font-medium">{result.nextSteps}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 pb-8 bg-secondary/10">
              {step < 3 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    disabled={step === 1 || loading}
                    className="font-body"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  {step === 2 ? (
                    <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 min-w-[140px]">
                      {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <>Verify Now <CheckCircle2 className="ml-2 h-4 w-4" /></>}
                    </Button>
                  ) : (
                    <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                      Continue <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                <Button asChild className="w-full bg-primary hover:bg-primary/90">
                  <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
