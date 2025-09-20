
'use client';

import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ArrowLeft, User, Phone, Bus, Route, MessageSquare, Video, MapPin, Camera, Edit, Star, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, notFound } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { StudentJson as StudentType } from '@/lib/data';
import type { Bus as BusType, StudentStatus } from '@/lib/data';
import studentData from '@/lib/students.json';
import busData from '@/lib/buses.json';
import { Badge } from '@/components/ui/badge';
import { LiveMapCard } from '@/app/dashboard/live-map-card';
import { MessagingCard } from '@/components/dashboard/messaging-card';
import { BusInfoCard } from '@/components/dashboard/bus-info-card';
import { EditStudentForm } from '@/components/dashboard/edit-student-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { format } from 'date-fns';


// Helper to get student data. In a real app, this would be an API call.
const getStudentById = (id: string): StudentType | undefined => {
  const students = studentData as Record<string, StudentType>;
  return Object.values(students).find(s => s.studentId === id);
};

const getBusById = (id: string): BusType | undefined => {
  const buses = busData as Record<string, BusType>;
  return buses[id];
}

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;
  
  const [student, setStudent] = useState<StudentType | undefined>(undefined);

  const [liveCctvUrl, setLiveCctvUrl] = useState<string | null>(null);
  
  const bus = student?.busId ? getBusById(student.busId) : null;

  useEffect(() => {
    if (studentId) {
      const studentRef = ref(db, `students/${studentId}`);
      onValue(studentRef, (snapshot) => {
        if (snapshot.exists()) {
          setStudent(snapshot.val());
        } else {
          // Fallback to static data if not in RTDB
          const staticStudent = getStudentById(studentId);
          setStudent(staticStudent);
        }
      });
    }
  }, [studentId]);


  useEffect(() => {
    if (!bus?.busId) return;

    const busDocRef = ref(db, `busLocations/${bus.busId}`);
    const unsubscribe = onValue(busDocRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.liveCctvUrl) {
            setLiveCctvUrl(data.liveCctvUrl);
        }
    });

    return () => unsubscribe();
  }, [bus?.busId]);


  useEffect(() => {
    if (!studentId) return;
    
    // Listener for student status changes from RTDB
    const today = format(new Date(), 'yyyy-MM-dd');
    const attendanceRef = ref(db, `attendance/${today}/${studentId}`);
    const unsubscribeAttendance = onValue(attendanceRef, (snapshot) => {
      const attendanceData = snapshot.val();
      if (attendanceData && attendanceData.status) {
        setStudent(prevStudent => prevStudent ? { ...prevStudent, status: attendanceData.status } : undefined);
      } else {
         setStudent(prevStudent => {
          if (!prevStudent) return undefined;
          const originalStudent = getStudentById(studentId);
          return {...prevStudent, status: originalStudent?.status || 'Not Boarded'};
        });
      }
    });

    return () => {
      unsubscribeAttendance();
    };
  }, [studentId]);


  if (!student) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading student data...</p>
      </div>
    );
  }
  
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
        case 'On Board':
        case 'Present':
        case 'Manually Dropped': return 'default';
        case 'Confirmed Absent':
        case 'Absent': return 'destructive';
        default: return 'secondary';
    }
  };

  const profilePhotoUrl = student.profilePhotos[0];
  const isExternalUrl = profilePhotoUrl.startsWith('http');


  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/dashboard/students"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Students</span>
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
              <Link href="/dashboard/students" className="text-muted-foreground hover:text-foreground">
                Students
              </Link>
               <Link href="/dashboard/buses" className="text-muted-foreground hover:text-foreground">
                Buses
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <h1 className="flex-1 text-xl font-semibold">Student Details</h1>
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Image
                    src={profilePhotoUrl}
                    alt={student.name}
                    width={80}
                    height={80}
                    className="rounded-full border"
                    data-ai-hint="child smiling"
                    unoptimized={!isExternalUrl}
                    />
                    <div>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            {student.name}
                            {student.specialAttention && <Star className="h-5 w-5 text-yellow-500 fill-yellow-400" />}
                        </CardTitle>
                        <CardDescription>{student.studentId}</CardDescription>
                    </div>
                </div>
                 <EditStudentForm student={student}>
                    <Button variant="outline" size="icon">
                        <Edit className="h-4 w-4" />
                    </Button>
                </EditStudentForm>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div><strong>Grade:</strong> {student.grade}, Section {student.section}</div>
                 <div><strong>School:</strong> {student.school}</div>
                 <div><strong>Address:</strong> {student.address}</div>
                 <div><strong>Status:</strong> <Badge variant={getStatusVariant(student.status)}>{student.status}</Badge></div>

                 {student.specialAttention && student.specialInstructions && (
                    <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                        <AlertTriangle className="h-4 w-4 !text-yellow-800" />
                        <AlertTitle>Special Instructions</AlertTitle>
                        <AlertDescription>
                           {student.specialInstructions}
                        </AlertDescription>
                    </Alert>
                 )}
              </CardContent>
            </Card>
            {bus && <BusInfoCard bus={bus} />}
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-primary"/>Live Tracking</CardTitle>
                    <CardDescription>View live bus location and camera feed.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full" defaultValue="map">
                        <AccordionItem value="map">
                            <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4"/> Live Map
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <LiveMapCard busId={bus?.busId} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="camera">
                            <AccordionTrigger>
                                 <div className="flex items-center gap-2">
                                    <Camera className="h-4 w-4"/> Live Camera
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="aspect-video w-full rounded-md overflow-hidden border bg-black flex items-center justify-center mt-2">
                                   {liveCctvUrl ? (
                                        <Image src={liveCctvUrl} alt="Live CCTV feed" width={600} height={400} className="object-cover w-full h-full" />
                                    ) : (
                                        <Video className="h-12 w-12 text-muted-foreground" />
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
            <MessagingCard studentId={student.studentId} />
          </div>
        </div>
      </main>
    </div>
  );
}
