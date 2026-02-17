
import { RegistrationForm } from "@/components/registration-form"

export default function RegistrationPage() {
  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-headline font-bold text-primary">NSPS Registration</h1>
        <p className="text-muted-foreground">Complete the following form to apply for NSPS status confirmation. Our AI system will evaluate your inputs in real-time.</p>
      </div>
      <RegistrationForm />
    </div>
  )
}
