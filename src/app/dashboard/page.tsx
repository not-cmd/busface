
import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { OverviewStats } from '@/components/dashboard/overview-stats';
import { LiveMapCard } from './live-map-card';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { EmergencyCard } from '@/components/dashboard/emergency-card';
import { AttendanceSummaryCard } from '@/components/dashboard/attendance-summary-card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { IntruderAlertsCard } from '@/components/dashboard/intruder-alerts-card';
import { FaceApprovalCard } from '@/components/dashboard/face-approval-card';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default function Dashboard() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <GuardianTrackLogo className="h-6 w-6" />
            <span className="sr-only">GuardianTrack</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/buses"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Buses
          </Link>
          <Link
            href="/dashboard/students"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Students
          </Link>
          <Link
            href="/dashboard/attendance"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Attendance
          </Link>
           <Link
            href="/dashboard/bus-staff"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Bus Staff
          </Link>
          <Link
            href="#"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Settings
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <GuardianTrackLogo className="h-6 w-6" />
                <span className="sr-only">GuardianTrack</span>
              </Link>
              <Link href="/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
              <Link
                href="/dashboard/buses"
                className="text-muted-foreground hover:text-foreground"
              >
                Buses
              </Link>
              <Link
                href="/dashboard/students"
                className="text-muted-foreground hover:text-foreground"
              >
                Students
              </Link>
              <Link
                href="/dashboard/attendance"
                className="text-muted-foreground hover:text-foreground"
              >
                Attendance
              </Link>
                <Link
                href="/dashboard/bus-staff"
                className="text-muted-foreground hover:text-foreground"
              >
                Bus Staff
              </Link>
              <Link
                href="#"
                className="text-muted-foreground hover:text-foreground"
              >
                Settings
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="ml-auto flex-1 sm:flex-initial">
            {/* Can add a search bar here if needed */}
          </div>
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Breadcrumbs />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
            <div className="lg:col-span-3">
                <OverviewStats />
            </div>
            <div className="lg:col-span-2 grid auto-rows-max items-start gap-4 md:gap-8">
               <LiveMapCard />
               <FaceApprovalCard />
               <AttendanceSummaryCard />
            </div>
             <div className="grid auto-rows-max items-start gap-4 md:gap-8">
                <EmergencyCard />
                <AlertsCard />
                <IntruderAlertsCard />
            </div>
        </div>
      </main>
    </div>
  );
}
