
'use client';

import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Sparkles } from 'lucide-react';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
import busData from '@/lib/buses.json';
import { BusInfoCard } from '@/components/dashboard/bus-info-card';
import type { Bus } from '@/lib/data';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion"
import { AddBusForm } from '@/components/dashboard/add-bus-form';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateSafetyScoreAction } from '@/app/actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BusFeedsCard } from '@/components/dashboard/bus-feeds-card';
  
const initialBuses: Bus[] = Object.values(busData);

export default function BusesPage() {
  const [buses, setBuses] = useState<Bus[]>(initialBuses);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const handleGenerateScore = async (bus: Bus) => {
    setIsLoading(prev => ({...prev, [bus.busId]: true}));
    try {
        const result = await generateSafetyScoreAction({
            driverName: bus.driver.name,
            drivingEvents: JSON.stringify([
                { event: 'Speeding > 65km/h', timestamp: '08:32 AM', impact: -2 },
                { event: 'Harsh Braking', timestamp: '09:15 AM', impact: -1 },
            ])
        });

        // Update the UI with the new score
        setBuses(prevBuses => prevBuses.map(b => {
            if (b.busId === bus.busId) {
                return {
                    ...b,
                    driver: {
                        ...b.driver,
                        safetyScore: {
                            ...b.driver.safetyScore,
                            daily: result.dailyScore
                        }
                    }
                }
            }
            return b;
        }));

        toast({
            title: `Score Generated for ${bus.driver.name}`,
            description: result.summary,
        });

    } catch (error) {
        console.error("Error generating safety score:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not generate safety score.",
        });
    } finally {
        setIsLoading(prev => ({...prev, [bus.busId]: false}));
    }
  };

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
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/buses"
            className="text-foreground transition-colors hover:text-foreground"
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
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link
                href="/dashboard/buses"
                className="hover:text-foreground"
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
             <AddBusForm />
          </div>
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <Card>
        <CardHeader>
            <CardTitle>Buses</CardTitle>
            <CardDescription>
                Manage your buses, view their details, and assess driver safety scores.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full">
                {buses.map((bus, index) => (
                    <AccordionItem value={`bus-${index}`} key={bus.busId}>
                         <div className="flex items-center w-full pr-4 py-4">
                            <AccordionTrigger className="flex-1 hover:no-underline">
                                <div className="flex flex-col items-start text-left">
                                    <span className="font-medium text-lg">{bus.name}</span>
                                    <span className="text-sm text-muted-foreground">{bus.driver.name}</span>
                                </div>
                            </AccordionTrigger>
                            <div className="flex items-center gap-4 ml-4">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <div className="flex items-center gap-4 cursor-help">
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Daily Score</p>
                                                    <p className="font-bold text-lg">{bus.driver.safetyScore.daily}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Avg. Score</p>
                                                    <p className="font-bold text-lg">{bus.driver.safetyScore.average}</p>
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Safety scores are out of 100.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGenerateScore(bus)}
                                    disabled={isLoading[bus.busId]}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {isLoading[bus.busId] ? "Generating..." : "Gen AI Score"}
                                </Button>
                                <Badge variant={bus.status === 'On Route' ? 'default' : bus.status === 'Idle' ? 'secondary' : 'destructive'}>
                                    {bus.status}
                                </Badge>
                                <span className="text-sm">{bus.studentsOnBoard}/{bus.capacity}</span>
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost" className="hover:bg-muted">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                    <DropdownMenuItem>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <AccordionContent>
                           <div className="flex flex-col md:flex-row gap-4">
                             <BusInfoCard bus={bus} />
                             <BusFeedsCard busId={bus.busId} />
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
