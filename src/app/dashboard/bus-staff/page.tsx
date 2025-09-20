
'use client';

import { useState, useEffect, useMemo } from 'react';
import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Users, UserCheck, UserX, Home, Clock, LogOut, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import busData from '@/lib/buses.json';
import type { StudentJson as StudentType, StudentStatus } from '@/lib/data';
import { SpeedTracker } from '@/components/dashboard/speed-tracker';
import { LiveFeed } from '@/components/dashboard/live-feed';
import { RouteMapCard } from '@/components/dashboard/route-map-card';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update } from 'firebase/database';

type AttendanceStatus = 'Present' | 'Absent' | 'Pending' | StudentStatus;
interface AttendanceRecord {
    status: AttendanceStatus;
    entry: string | null;
    exit: string | null;
}

export default function BusStaffDashboard() {
  const [greeting, setGreeting] = useState('');
  const [staffName, setStaffName] = useState('');
  const [busId, setBusId] = useState<string | null>(null);
  const [studentsForBus, setStudentsForBus] = useState<StudentType[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceRecord>>({});
  const { toast } = useToast();
  const [onBoardCount, setOnBoardCount] = useState(0);

  const getAttendanceRef = (studentId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return ref(db, `attendance/${today}/${studentId}`);
  };

  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) setGreeting('Good Morning');
    else if (hours < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    const loggedInStaffId = localStorage.getItem('loggedInStaffId');
    const loggedInBusId = localStorage.getItem('loggedInStaffBusId');
    
    if (loggedInStaffId && loggedInBusId) {
        setStaffName(loggedInStaffId);
        setBusId(loggedInBusId);

        const studentsRef = ref(db, 'students');
        const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
            const allStudentsData = snapshot.val() || {};
            const allStudents: StudentType[] = Object.values(allStudentsData);
            const filteredStudents = allStudents.filter(s => s.busId === loggedInBusId);
            setStudentsForBus(filteredStudents);

            const today = format(new Date(), 'yyyy-MM-dd');
            const attendanceRef = ref(db, `attendance/${today}`);
            const unsubscribeAttendance = onValue(attendanceRef, (attSnapshot) => {
                const data = attSnapshot.val() || {};
                const initialRecords: Record<string, AttendanceRecord> = {};
                filteredStudents.forEach(s => {
                    initialRecords[s.studentId] = data[s.studentId] || { status: 'Pending', entry: null, exit: null };
                });
                setStudentAttendance(initialRecords);
                const presentCount = Object.values(initialRecords).filter(record => record.status === 'On Board').length;
                setOnBoardCount(presentCount);
            });

            return () => unsubscribeAttendance();
        });
        
        return () => unsubscribeStudents();
    }
  }, []);

  const studentsOnBus = useMemo(() => studentsForBus, [studentsForBus]);

  const handleManualAttendance = async (studentId: string, studentName: string, action: 'board' | 'exit' | 'mark_absent') => {
    const attendanceRef = getAttendanceRef(studentId);
    
    try {
        let payload: Partial<AttendanceRecord> & { source: string } = { source: 'BusStaffOverride' };

        if (action === 'board') {
            payload = {
                ...payload,
                status: 'On Board',
                entry: format(new Date(), 'hh:mm a'),
            };
        } else if (action === 'exit') {
            payload = {
                ...payload,
                status: 'Present',
                exit: format(new Date(), 'hh:mm a'),
            }
        } else if (action === 'mark_absent') {
            payload = {
                ...payload,
                status: 'Absent',
            };
            const alertRef = ref(db, `alerts/missedBus/${studentId}`);
            await set(alertRef, true);
        }
        
        await update(attendanceRef, payload);

        toast({
            title: "Attendance Updated",
            description: `${studentName}'s status has been updated.`,
        });

    } catch (error) {
        console.error("Error updating attendance:", error);
        toast({
            variant: 'destructive',
            title: "Update Failed",
            description: "Could not update attendance. Please check your connection."
        });
    }
  };

  if (!busId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading staff data... If this persists, please log out and log back in.</p>
      </div>
    );
  }

  const currentBus = busData[busId as keyof typeof busData];

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold md:text-base">
            <GuardianTrackLogo className="h-6 w-6" />
            <span className="sr-only">GuardianTrack</span>
          </Link>
          <Link href="#" className="text-foreground transition-colors hover:text-foreground">
            Bus Staff Dashboard
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-6 text-lg font-medium">
              <Link href="#" className="flex items-center gap-2 text-lg font-semibold">
                <GuardianTrackLogo className="h-6 w-6" />
                <span className="sr-only">GuardianTrack</span>
              </Link>
              <Link href="#" className="hover:text-foreground">
                Bus Staff Dashboard
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="ml-auto flex-1 sm:flex-initial"></div>
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">{`${greeting}, ${staffName}`}</h1>
          <p className="text-muted-foreground">Live feed and attendance for bus {currentBus.name}.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           <SpeedTracker busId={busId} />
           <LiveFeed busId={busId} studentsOnBus={studentsOnBus} />
           <RouteMapCard busId={busId} students={studentsOnBus} />
        </div>
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Students on this Bus</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="font-semibold">{onBoardCount} / {currentBus.capacity}</span>
                    </div>
                </div>
                <CardDescription>Manual attendance override for {currentBus.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {studentsOnBus.map(student => {
                    const attendance = studentAttendance[student.studentId] || { status: 'Pending', entry: null, exit: null };
                    const status = attendance.status;

                    const isPending = status === 'Pending';
                    const isOnBoard = status === 'On Board';
                    const isComplete = status === 'Present' || status === 'Absent' || status === 'Confirmed Absent' || status === 'Not Boarded';

                    return (
                        <div 
                            key={student.studentId} 
                            className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 rounded-md bg-muted/50 transition-colors", 
                                {
                                    'bg-green-100/50 border-l-4 border-green-500': isOnBoard,
                                    'bg-blue-100/50 border-l-4 border-blue-500': status === 'Present',
                                    'bg-red-100/50 border-l-4 border-red-500': status === 'Absent' || status === 'Confirmed Absent' || status === 'Not Boarded',
                                }
                            )}
                        >
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <Image src={student.profilePhotos[0]} alt={student.name} width={40} height={40} className="rounded-full border" />
                                <div className="flex-1">
                                    <p className="font-semibold">{student.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Home className="h-3 w-3" />
                                        <span>{student.address}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5" title="Entry Time">
                                        <Clock className="h-3 w-3 text-green-600" />
                                        <span>{attendance.entry || '--:--'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Exit Time">
                                        <LogOut className="h-3 w-3 text-red-600" />
                                        <span>{attendance.exit || '--:--'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {isPending && (
                                        <>
                                            <Button size="icon" variant="outline" className="h-8 w-8 bg-green-100 hover:bg-green-200" onClick={() => handleManualAttendance(student.studentId, student.name, 'board')} title="Mark Present">
                                                <UserCheck className="h-4 w-4 text-green-700" />
                                            </Button>
                                            <Button size="icon" variant="outline" className="h-8 w-8 bg-red-100 hover:bg-red-200" onClick={() => handleManualAttendance(student.studentId, student.name, 'mark_absent')} title="Mark Absent">
                                                <UserX className="h-4 w-4 text-red-700" />
                                            </Button>
                                        </>
                                    )}
                                    {isOnBoard && (
                                        <>
                                            <Button size="sm" variant="outline" className="h-8 bg-white" disabled>On Bus</Button>
                                            <Button size="icon" variant="outline" className="h-8 w-8 bg-orange-100 hover:bg-orange-200" onClick={() => handleManualAttendance(student.studentId, student.name, 'exit')} title="Mark Exited">
                                                <LogOut className="h-4 w-4 text-orange-700" />
                                            </Button>
                                        </>
                                    )}
                                    {isComplete && (
                                        <Button size="sm" variant="outline" className="h-8 bg-white" disabled>
                                            <CheckCircle className="mr-2 h-4 w-4 text-gray-500" />
                                            Done
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </CardContent>
            </Card>
      </main>
    </div>
  );
}
