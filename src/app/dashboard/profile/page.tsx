
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlaceHolderImages } from "@/lib/placeholder-images"
import { Camera, Shield, Mail, User, MapPin } from "lucide-react"

export default function ProfilePage() {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'avatar-user');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Profile Management</h1>
        <p className="text-muted-foreground">Manage your personal information and account settings.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-8">
          <Card className="border-border/50 shadow-sm text-center">
            <CardHeader className="relative">
              <div className="absolute top-4 right-4">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <div className="mx-auto h-24 w-24 rounded-full border-4 border-accent p-1">
                <Avatar className="h-full w-full">
                  <AvatarImage src={userAvatar?.imageUrl} />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="mt-4 font-headline">John Doe</CardTitle>
              <CardDescription>Senior Security Personnel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-2">
                <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold border border-accent/20">
                  VERIFIED
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 border-t pt-6">
              <div className="w-full flex items-center gap-3 text-sm text-muted-foreground text-left px-4">
                <Mail className="h-4 w-4" /> <span>john.doe@gov.us</span>
              </div>
              <div className="w-full flex items-center gap-3 text-sm text-muted-foreground text-left px-4">
                <MapPin className="h-4 w-4" /> <span>Washington, D.C.</span>
              </div>
            </CardFooter>
          </Card>

          <Card className="border-border/50 shadow-sm bg-accent text-white">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Security Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-white/50" />
                <div>
                  <p className="text-sm font-bold">NSPS Class-A</p>
                  <p className="text-xs text-white/80">Authorized access enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline">Personal Details</CardTitle>
              <CardDescription>Update your public profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" defaultValue="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" defaultValue="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input id="email" defaultValue="john.doe@gov.us" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Professional Summary</Label>
                <textarea 
                  id="bio" 
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue="Senior security consultant with over 10 years of experience in federal infrastructure protection."
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t pt-6">
              <Button variant="outline">Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90 text-white">Save Changes</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
