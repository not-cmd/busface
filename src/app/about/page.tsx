
import { GuardianTrackLogo } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Map, Bot, Bell } from 'lucide-react';
import Link from 'next/link';

const features = [
    {
        icon: <Map className="h-8 w-8 text-primary" />,
        title: "Live Bus Tracking",
        description: "Parents get a real-time map view of the bus's location, with an accurate ETA for peace of mind."
    },
    {
        icon: <ShieldCheck className="h-8 w-8 text-accent" />,
        title: "AI-Powered Safety",
        description: "We use AI to monitor driving patterns, generate safety scores, and detect faces for automated attendance."
    },
    {
        icon: <Bell className="h-8 w-8 text-yellow-500" />,
        title: "Instant Alerts",
        description: "Receive immediate notifications for geofence breaches, student status changes, and emergencies."
    },
    {
        icon: <Bot className="h-8 w-8 text-blue-500" />,
        title: "Seamless Communication",
        description: "An integrated messaging system and chatbot connect parents, admins, and bus staff instantly."
    }
]

export default function AboutPage() {
  return (
    <div className="bg-muted/40 min-h-screen">
       <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
            <Link href="/login" className="flex items-center gap-2 mr-4">
                <GuardianTrackLogo className="h-8 w-8" />
                <span className="font-bold text-xl">GuardianRoute</span>
            </Link>
        </div>
       </header>
        <main className="container py-12">
            <section className="text-center mb-16">
                 <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">Your Child's Safety is Our Priority</h1>
                 <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
                    GuardianRoute is a comprehensive school bus safety and tracking platform designed to provide peace of mind to parents and enhance operational efficiency for schools.
                 </p>
            </section>

            <section>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-center text-3xl">Our Mission & Technology</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-2xl font-semibold text-primary">Our Mission</h3>
                                <p className="text-muted-foreground">
                                    Our mission is to create a safer and more transparent school transportation experience for everyone involved. We believe that technology can bridge the communication gap between schools and parents, ensuring that every child's journey is monitored and secure. By leveraging AI and real-time data, we aim to prevent incidents before they happen and provide immediate, actionable insights.
                                </p>
                                <p className="text-muted-foreground">
                                    From live tracking and geofencing to automated attendance and driver safety analytics, every feature is built with the well-being of students at its core. GuardianRoute is more than just a tracking app; it's a complete safety ecosystem for the next generation.
                                </p>
                            </div>
                             <div className="space-y-4">
                                <h3 className="text-2xl font-semibold text-primary">Key Features</h3>
                                <ul className="space-y-6">
                                    {features.map((feature, index) => (
                                         <li key={index} className="flex items-start gap-4">
                                            <div className="p-2 bg-muted rounded-full">
                                                {feature.icon}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-lg">{feature.title}</h4>
                                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground">
            GuardianRoute © {new Date().getFullYear()}
        </footer>
    </div>
  )
}
