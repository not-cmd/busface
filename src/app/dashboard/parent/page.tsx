
'use client';

import { useState, useEffect } from 'react';
import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Menu, User, Star, AlertTriangle, CheckCircle, XCircle, PersonStanding, Car, Camera, ScanFace } from 'lucide-react';
import Link from 'next/link';
import type { StudentJson as Student, StudentStatus, Bus as BusType } from '@/lib/data';
import studentJson from '@/lib/students.json';
import Image from 'next/image';
import { LiveMapCard } from '@/app/dashboard/live-map-card';
import { BusInfoCard } from '@/components/dashboard/bus-info-card';
import { ChatbotCard } from '@/components/dashboard/chatbot-card';
import { ParentAttendanceCard } from '@/components/dashboard/parent-attendance-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MissedBusAlert } from '@/components/dashboard/missed-bus-alert';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { StudentIdCard } from '@/components/dashboard/student-id-card';
import { format } from 'date-fns';
import { FaceRegistration } from '@/components/dashboard/face-registration';
import { LoadingScreen } from '@/components/ui/loading-screen';
import ParentAlertsPanel from '@/components/dashboard/parent-alerts-panel';


export default function ParentDashboard() {
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [greeting, setGreeting] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [bus, setBus] = useState<BusType | null>(null);
  const [showMissedBusAlert, setShowMissedBusAlert] = useState(false);
  const [latestSnapshotUrl, setLatestSnapshotUrl] = useState<string | null>(null);


  const handleStatusUpdate = async (newStatus: StudentStatus, currentStudent: Student | null) => {
    if (!currentStudent) return;
    setShowMissedBusAlert(false); // Hide alert once an action is taken
    
    // Set item in RTDB
    const today = format(new Date(), 'yyyy-MM-dd');
    const attendanceRef = ref(db, `attendance/${today}/${currentStudent.studentId}`);
    try {
        await set(attendanceRef, {
            status: newStatus,
            source: 'ParentOverride'
        });
    } catch(error) {
        console.error("Error updating status:", error);
    }
  };


  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting('Good Morning');
    } else if (hours < 18) {
      setGreeting('Good Afternoon');
    } else {
      setGreeting('Good Evening');
    }

    const loggedInParentId = localStorage.getItem('loggedInParentId');

    const fetchStudentData = async () => {
        if (!loggedInParentId) {
            setLoading(false);
            return;
        }
        setLoadingMessage('Fetching student profile...');
        setLoadingProgress(20);

        const studentsRef = ref(db, 'students');
        
        try {
            const snapshot = await get(studentsRef);
            let allStudentsData: Record<string, Student>;

            if (snapshot.exists()) {
                allStudentsData = snapshot.val();
            } else {
                console.warn("RTDB is empty at /students. Using static student.json as a fallback.");
                allStudentsData = studentJson as Record<string, Student>;
            }

            const allStudentsArray = Object.values(allStudentsData);
            const currentStudent = allStudentsArray.find(s => s.parentId === loggedInParentId);
            
            if (currentStudent) {
                setStudent(currentStudent);
                setLoadingProgress(50);
                
                // Now fetch everything else
                setLoadingMessage('Connecting to bus feed...');
                const busRef = ref(db, `buses/${currentStudent.busId}`);
                onValue(busRef, (busSnapshot) => {
                    setBus(busSnapshot.val());
                });

                setLoadingMessage('Checking attendance...');
                const today = format(new Date(), 'yyyy-MM-dd');
                const statusRef = ref(db, `attendance/${today}/${currentStudent.studentId}`);
                onValue(statusRef, (statusSnapshot) => {
                    const liveAttendance = statusSnapshot.val();
                    if (liveAttendance) {
                        setStudent(prev => prev ? { ...prev, status: liveAttendance.status } : null);
                    }
                });
                setLoadingProgress(75);

                setLoadingMessage('Looking for alerts...');
                const alertRef = ref(db, `alerts/missedBus/${currentStudent.studentId}`);
                onValue(alertRef, (alertSnapshot) => {
                    if (alertSnapshot.exists() && alertSnapshot.val() === true) {
                        setShowMissedBusAlert(true);
                    } else {
                        setShowMissedBusAlert(false);
                    }
                });

                setLoadingMessage('Getting recent snapshots...');
                const studentEventRef = ref(db, `studentEvents/${currentStudent.studentId}`);
                onValue(studentEventRef, (eventSnapshot) => {
                    const data = eventSnapshot.val();
                    if (data && data.latestSnapshotUrl) {
                        setLatestSnapshotUrl(data.latestSnapshotUrl);
                    }
                });

                setLoadingProgress(100);
                setTimeout(() => setLoading(false), 500);

            } else {
                console.error("No student found for this parent.");
                setLoadingMessage('Could not find student data for the logged in parent.');
                setLoading(false);
            }

        } catch (error) {
            console.error("Error fetching student data:", error);
            setLoadingMessage('Error loading data.');
            setLoading(false);
        }
    };

    fetchStudentData();

  }, []);

  if (loading) {
    return <LoadingScreen message={loadingMessage} progress={loadingProgress} />;
  }


  if (!student || !bus) {
    return (
        <div className="flex items-center justify-center h-screen p-4 text-center">
            <Card className="p-8">
                <CardTitle className="text-destructive">Loading Error</CardTitle>
                <CardDescription className="mt-2">
                    Could not load student or bus data. The database might be empty or there could be a configuration issue. Please try logging out and back in, or contact an administrator.
                </CardDescription>
                <Link href="/login">
                  <Button variant="outline" className="mt-4">Back to Login</Button>
                </Link>
            </Card>
        </div>
    );
  }

  const getStatusInfo = (status: StudentStatus) => {
      switch (status) {
        case 'Present':
        case 'On Board':
            return {
                Icon: CheckCircle,
                textColor: 'text-green-800',
                cardColor: 'bg-green-100 border-green-200',
                mutedTextColor: 'text-green-700/80'
            };
        case 'Manually Dropped':
            return {
                Icon: Car,
                textColor: 'text-blue-800',
                cardColor: 'bg-blue-100 border-blue-200',
                mutedTextColor: 'text-blue-700/80'
            };
        case 'Absent':
        case 'Confirmed Absent':
             return {
                Icon: XCircle,
                textColor: 'text-red-800',
                cardColor: 'bg-red-100 border-red-200',
                mutedTextColor: 'text-red-700/80'
            };
        default:
            return {
                Icon: PersonStanding,
                textColor: 'text-gray-800',
                cardColor: 'bg-gray-100 border-gray-200',
                mutedTextColor: 'text-gray-700/80'
            };
    }
  }
  
  const statusInfo = getStatusInfo(student.status as StudentStatus);
  const StatusIcon = statusInfo.Icon;

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="#"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <GuardianTrackLogo className="h-6 w-6" />
            <span className="sr-only">GuardianTrack</span>
          </Link>
          <Link
            href="#"
            className="text-foreground transition-colors hover:text-foreground"
          >
            Parent Dashboard
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
                href="/dashboard/parent"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <GuardianTrackLogo className="h-6 w-6" />
                <span className="sr-only">GuardianTrack</span>
              </Link>
              <Link href="/dashboard/parent" className="hover:text-foreground">
                Parent Dashboard
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
            <h1 className="text-3xl font-bold flex items-center gap-3">
                {`${greeting}, Parent of ${student.name}`}
            </h1>
            <p className="text-muted-foreground">Here is the latest update on your child.</p>
        </div>

        {/* New Proximity and Missed Bus Alerts */}
        <ParentAlertsPanel 
          parentId={student.parentId} 
          studentIds={[student.studentId]} 
        />
        
        {showMissedBusAlert && <MissedBusAlert studentName={student.name} onStatusUpdate={(status) => handleStatusUpdate(status, student)} />}

        {student.specialAttention && student.specialInstructions && (
            <Alert variant="destructive" className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                <AlertTriangle className="h-4 w-4 !text-yellow-800" />
                <AlertTitle className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" /> Special Instructions for {student.name}
                </AlertTitle>
                <AlertDescription>
                    {student.specialInstructions}
                </AlertDescription>
            </Alert>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col gap-4">
                <Card className={cn("transition-colors", statusInfo.cardColor)}>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <StatusIcon className={cn("h-6 w-6", statusInfo.textColor)} />
                        <CardTitle className={cn(statusInfo.textColor)}>Current Status</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className={cn(statusInfo.textColor)}>
                    <p className="text-2xl font-bold">{student.status}</p>
                    <p className={cn("text-sm", statusInfo.mutedTextColor)}>Bus: {bus.name}</p>
                    <p className={cn("text-sm", statusInfo.mutedTextColor)}>ETA: 12 minutes</p>
                </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-primary" />
                            <CardTitle>Recent Snapshot</CardTitle>
                        </div>
                        <CardDescription>The latest photo of your child from the bus.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="aspect-video w-full rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                            {latestSnapshotUrl ? (
                                <Image src={latestSnapshotUrl} alt={`Snapshot of ${student.name}`} width={600} height={400} className="object-cover w-full h-full" />
                            ) : (
                                <div className="text-muted-foreground flex flex-col items-center gap-2 p-4 text-center">
                                    <User className="h-8 w-8" />
                                    <span>Waiting for first recognition snapshot...</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                 <StudentIdCard student={student} />
            </div>

            <div className="lg:col-span-2 flex flex-col gap-8">
                <LiveMapCard busId={student.busId} />
                <BusInfoCard bus={bus} />
            </div>
        </div>
        
        <div className="mt-8">
             <Card>
                <CardHeader>
                <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <CardTitle>Child Information</CardTitle>
                </div>
                <CardDescription>View reports and chat with us.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="report">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="report">Attendance Report</TabsTrigger>
                            <TabsTrigger value="chat">Chat</TabsTrigger>
                            <TabsTrigger value="face">
                                <ScanFace className="mr-2 h-4 w-4" />
                                Face Registration
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="report">
                            <ParentAttendanceCard studentId={student.studentId}/>
                        </TabsContent>
                        <TabsContent value="chat">
                            <ChatbotCard student={{
                               ...student,
                               busName: bus.name,
                               eta: '12 minutes'
                            }}/>
                        </TabsContent>
                        <TabsContent value="face">
                            <FaceRegistration studentId={student.studentId} studentName={student.name} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
