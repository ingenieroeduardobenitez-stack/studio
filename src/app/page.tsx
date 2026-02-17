
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, Users, BarChart3, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LandingPage() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-image');

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center justify-center gap-2" href="/">
          <div className="bg-primary p-1.5 rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-headline font-bold tracking-tight text-primary">Confir NSPS</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-accent transition-colors" href="/login">
            Login
          </Link>
          <Link className="text-sm font-medium hover:text-accent transition-colors" href="/register">
            Register
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-primary text-white overflow-hidden relative">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Secure National Security Registration
                  </h1>
                  <p className="max-w-[600px] text-primary-foreground/80 md:text-xl font-body">
                    Automated NSPS status confirmation for personnel. Streamlined, secure, and reliable.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white border-none shadow-lg">
                    <Link href="/register">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-primary transition-all">
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-accent to-primary rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <Image
                  alt="Hero"
                  className="relative mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center shadow-2xl"
                  height={400}
                  src={heroImage?.imageUrl || "https://picsum.photos/seed/nsps/600/400"}
                  width={600}
                  data-ai-hint="government building"
                />
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-headline font-bold tracking-tighter md:text-4xl/tight">
                  Why Choose Confir NSPS?
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed font-body">
                  Our system leverages advanced AI to provide instant status confirmation for security clearance roles.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-xl bg-white shadow-sm border border-border/50 transition-all hover:shadow-md">
                <div className="p-3 bg-primary/10 rounded-full">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Instant Verification</h3>
                <p className="text-muted-foreground font-body text-sm">
                  Our AI engine analyzes your credentials in seconds to provide preliminary confirmation.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-xl bg-white shadow-sm border border-border/50 transition-all hover:shadow-md">
                <div className="p-3 bg-accent/10 rounded-full">
                  <Users className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-headline font-bold">User Centric</h3>
                <p className="text-muted-foreground font-body text-sm">
                  Designed for ease of use with a modern interface that guides you through every step.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-xl bg-white shadow-sm border border-border/50 transition-all hover:shadow-md">
                <div className="p-3 bg-primary/10 rounded-full">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Admin Controls</h3>
                <p className="text-muted-foreground font-body text-sm">
                  Robust dashboard for administrators to manage registrations and review system performance.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-white">
        <p className="text-xs text-muted-foreground font-body">© 2024 Confir NSPS Inc. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4 font-body" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4 font-body" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
