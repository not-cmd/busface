
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import type { StudentJson as StudentType, StudentStatus } from '@/lib/data';
import { SpeedTracker } from '@/components/dashboard/speed-tracker';
import { FacialRecognitionFeed } from '@/components/dashboard/facial-recognition-feed';
import { LiveCCTV } from '@/components/dashboard/live-cctv';
import { RouteMapCard } from '@/components/dashboard/route-map-card';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { 
  listenToSessionChanges, 
  updateSessionActivity, 
  removeSession,
  cleanupStaleSessions 
} from '@/lib/session-manager';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type AttendanceStatus = 'Present' | 'Absent' | 'Pending' | StudentStatus;
interface AttendanceRecord {
    status: AttendanceStatus;
    entry: string | null;
    exit: string | null;
}

export default function BusStaffDashboard() {
  const router = useRouter();
  const [greeting, setGreeting] = useState('');
  const [staffName, setStaffName] = useState('');
  const [busId, setBusId] = useState<string | null>(null);
  const [studentsForBus, setStudentsForBus] = useState<StudentType[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceRecord>>({});
  const { toast } = useToast();
  const [onBoardCount, setOnBoardCount] = useState(0);
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [isPrimarySession, setIsPrimarySession] = useState(true);
  const [currentBus, setCurrentBus] = useState<any>(null);

  const getAttendanceRef = useCallback((studentId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return ref(db, `attendance/${today}/${studentId}`);
  }, []);

  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) setGreeting('Good Morning');
    else if (hours < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    const loggedInStaffId = localStorage.getItem('loggedInStaffId');
    const loggedInBusId = localStorage.getItem('loggedInStaffBusId');
    const sessionId = localStorage.getItem('staffSessionId');
    const isPrimary = localStorage.getItem('isPrimarySession') === 'true';
    
    if (!loggedInStaffId || !loggedInBusId || !sessionId) {
        router.push('/login');
        return;
    }

    setStaffName(loggedInStaffId);
    setBusId(loggedInBusId);
    setIsPrimarySession(isPrimary);

    // Load bus data from Firebase
    const busRef = ref(db, `buses/${loggedInBusId}`);
    const unsubscribeBus = onValue(busRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentBus(snapshot.val());
      }
    });

    // Clean up stale sessions on mount
    cleanupStaleSessions(loggedInBusId);

    // Listen for session takeover
    const unsubscribeSession = listenToSessionChanges(
      loggedInBusId,
      sessionId,
      () => {
        setSessionTakenOver(true);
        toast({
          variant: 'destructive',
          title: 'Session Taken Over',
          description: 'You have been logged out from another device.',
        });
        
        // Clear local storage and redirect after 3 seconds
        setTimeout(() => {
          localStorage.removeItem('loggedInStaffId');
          localStorage.removeItem('loggedInStaffBusId');
          localStorage.removeItem('staffSessionId');
          localStorage.removeItem('isPrimarySession');
          router.push('/login');
        }, 3000);
      }
    );

    // Update session activity every 20 seconds (more frequent to prevent timeout)
    // Only update when page is visible to reduce Firebase calls
    let activityInterval: NodeJS.Timeout | null = null;
    
    const updateActivity = () => {
      if (!sessionTakenOver && !document.hidden) {
        updateSessionActivity(loggedInBusId, sessionId);
      }
    };
    
    // Start interval
    activityInterval = setInterval(updateActivity, 20000);
    
    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden && !sessionTakenOver) {
        // Page became visible, update immediately
        updateSessionActivity(loggedInBusId, sessionId);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let unsubscribeAttendance: (() => void) | null = null;
    
    const studentsRef = ref(db, 'students');
    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
        const allStudentsData = snapshot.val() || {};
        const allStudents: StudentType[] = Object.values(allStudentsData);
        const filteredStudents = allStudents.filter(s => s.busId === loggedInBusId);
        setStudentsForBus(filteredStudents);

        // Clean up previous attendance listener
        if (unsubscribeAttendance) {
            unsubscribeAttendance();
            unsubscribeAttendance = null;
        }

        // Set up new attendance listener only if we have students
        if (filteredStudents.length > 0) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const attendanceRef = ref(db, `attendance/${today}`);
            unsubscribeAttendance = onValue(attendanceRef, (attSnapshot) => {
                const data = attSnapshot.val() || {};
                const initialRecords: Record<string, AttendanceRecord> = {};
                let presentCount = 0;
                
                filteredStudents.forEach(s => {
                    const record = data[s.studentId] || { status: 'Pending', entry: null, exit: null };
                    initialRecords[s.studentId] = record;
                    if (record.status === 'On Board') {
                        presentCount++;
                    }
                });
                
                setStudentAttendance(initialRecords);
                setOnBoardCount(presentCount);
            });
        }
    });
    
    return () => {
        unsubscribeStudents();
        if (unsubscribeAttendance) {
            unsubscribeAttendance();
        }
        unsubscribeSession();
        if (activityInterval) {
            clearInterval(activityInterval);
        }
        unsubscribeBus();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        
        // DON'T remove session on cleanup in development
        // Only remove on explicit logout or when navigating away
        // The session will be cleaned up by stale session cleanup
    };
  }, [router, toast]); // Only depend on router and toast

  const studentsOnBus = useMemo(() => studentsForBus, [studentsForBus]);

  const handleManualAttendance = useCallback(async (studentId: string, studentName: string, action: 'board' | 'exit' | 'mark_absent') => {
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
  }, [toast, getAttendanceRef]);

  if (!busId || !currentBus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading staff data... If this persists, please log out and log back in.</p>
      </div>
    );
  }

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
              <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold">
                <GuardianTrackLogo className="h-6 w-6" />
                <span className="sr-only">GuardianTrack</span>
              </Link>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/dashboard/buses" className="text-muted-foreground hover:text-foreground">
                Buses
              </Link>
              <Link href="/dashboard/students" className="text-muted-foreground hover:text-foreground">
                Students
              </Link>
              <Link href="/dashboard/attendance" className="text-muted-foreground hover:text-foreground">
                Attendance
              </Link>
              <Link href="/dashboard/bus-staff" className="hover:text-foreground">
                Bus Staff
              </Link>
              <Link href="/dashboard/route-optimization" className="text-muted-foreground hover:text-foreground">
                Route Optimizer
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                Settings
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
        {/* Session Status Alerts */}
        {sessionTakenOver && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Session Taken Over</AlertTitle>
            <AlertDescription>
              Your session has been taken over by another device. Redirecting to login...
            </AlertDescription>
          </Alert>
        )}
        
        {!isPrimarySession && !sessionTakenOver && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Read-Only Mode</AlertTitle>
            <AlertDescription>
              You are in read-only mode. Camera access is controlled by another device. You can still view data and manually update attendance.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4">
          <h1 className="text-3xl font-bold">{`${greeting}, ${staffName}`}</h1>
          <p className="text-muted-foreground">Live feed and attendance for bus {currentBus.name}.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           <SpeedTracker busId={busId} />
           <FacialRecognitionFeed busId={busId} studentsOnBus={studentsOnBus} isPrimarySession={isPrimarySession} />
           <LiveCCTV busId={busId} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
           <RouteMapCard busId={busId} students={studentsOnBus} />
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
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border shadow-sm">
                                    <span className="text-lg font-bold text-white">
                                        {student.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
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
        </div>
      </main>
    </div>
  );
}
