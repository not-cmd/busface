
'use client';

import { useState, useEffect } from 'react';
import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Calendar as CalendarIcon, Check, X, Clock } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import studentData from '@/lib/students.json';
import attendanceData from '@/lib/attendance.json';
import type { StudentJson as StudentType, StudentStatus } from '@/lib/data';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AttendanceData = typeof attendanceData;
const allStudents: StudentType[] = Object.values(studentData);

interface DailyAttendanceRecord {
  status: StudentStatus | 'Present' | 'Absent';
  entry: string | null;
  exit: string | null;
}

export default function AttendancePage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [todaysAttendance, setTodaysAttendance] = useState<Record<string, DailyAttendanceRecord>>({});
  
  useEffect(() => {
    if (!date) return;

    const formattedDate = format(date, 'yyyy-MM-dd');
    const attendanceRef = ref(db, `attendance/${formattedDate}`);

    const unsubscribe = onValue(attendanceRef, (snapshot) => {
        const liveData = snapshot.val() || {};
        const staticTodaysAttendance = (attendanceData as AttendanceData)[formattedDate as keyof AttendanceData] || {};
        const combinedAttendance: Record<string, DailyAttendanceRecord> = {};

        allStudents.forEach(student => {
            const liveRecord = liveData[student.studentId];
            const staticRecord = staticTodaysAttendance[student.studentId as keyof typeof staticTodaysAttendance];

            if (liveRecord) {
                combinedAttendance[student.studentId] = {
                    status: liveRecord.status as StudentStatus | 'Present' | 'Absent',
                    entry: liveRecord.entry || staticRecord?.entry || 'N/A',
                    exit: liveRecord.exit || staticRecord?.exit || 'N/A'
                };
            } else if (staticRecord) {
                combinedAttendance[student.studentId] = {
                    status: staticRecord.status as StudentStatus | 'Present' | 'Absent',
                    entry: staticRecord.entry,
                    exit: staticRecord.exit
                };
            } else {
                combinedAttendance[student.studentId] = { status: 'Absent', entry: null, exit: null };
            }
        });
        setTodaysAttendance(combinedAttendance);
    });

    return () => unsubscribe();

  }, [date]);

  const presentStatuses: (StudentStatus | 'Present' | 'Absent')[] = ['Present', 'On Board', 'Manually Dropped'];
  const absentStatuses: (StudentStatus | 'Present' | 'Absent')[] = ['Absent', 'Confirmed Absent', 'Not Boarded'];

  const presentStudents = allStudents.filter(student => {
    const status = todaysAttendance[student.studentId]?.status;
    return status && presentStatuses.includes(status);
  });

  const absentStudents = allStudents.filter(student => {
    const status = todaysAttendance[student.studentId]?.status;
    return !status || absentStatuses.includes(status);
  });


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
            className="text-foreground transition-colors hover:text-foreground"
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
                className="hover:text-foreground"
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
                href="/dashboard/route-optimization"
                className="text-muted-foreground hover:text-foreground"
              >
                Route Optimizer
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
             <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={'outline'}
                    className={cn(
                    'w-full sm:w-[280px] justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    disabled={(date) => date > new Date() || date < new Date("2024-07-01")}
                />
                </PopoverContent>
            </Popover>
          </div>
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
            <CardDescription>View present and absent students for the selected date.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="present">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="present">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  Present ({presentStudents.length})
                </TabsTrigger>
                <TabsTrigger value="absent">
                  <X className="mr-2 h-4 w-4 text-red-500" />
                  Absent ({absentStudents.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="present" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Present Students</CardTitle>
                    <CardDescription>Students who boarded the bus today.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ul className="space-y-4">
                          {presentStudents.map(student => {
                              const attendanceRecord = todaysAttendance[student.studentId];
                              return (
                                  <li key={student.studentId} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                      <div>
                                          <p className="font-semibold">{student.name}</p>
                                          <p className="text-sm text-muted-foreground">{student.studentId}</p>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                          <div className="flex items-center gap-1">
                                              <Clock className="h-4 w-4 text-green-500" />
                                              <span>In: {attendanceRecord?.entry || 'N/A'}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                              <Clock className="h-4 w-4 text-orange-500" />
                                              <span>Out: {attendanceRecord?.exit || 'N/A'}</span>
                                          </div>
                                      </div>
                                  </li>
                              )
                          })}
                      </ul>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="absent" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Absent Students</CardTitle>
                    <CardDescription>Students who did not board the bus today.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ul className="space-y-2">
                          {absentStudents.map(student => (
                              <li key={student.studentId} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                  <div>
                                      <p className="font-semibold">{student.name}</p>
                                      <p className="text-sm text-muted-foreground">{student.studentId}</p>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
