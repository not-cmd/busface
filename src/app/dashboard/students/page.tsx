
'use client';

import { useState, useEffect, useCallback } from 'react';
import { GuardianTrackLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, MoreHorizontal, MessageSquare, Star, Search } from 'lucide-react';
import Link from 'next/link';
import initialStudentData from '@/lib/students.json';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { AddStudentForm } from '@/components/dashboard/add-student-form';
import { EditStudentForm } from '@/components/dashboard/edit-student-form';
import type { StudentJson as StudentType, StudentStatus } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';


export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    // Listener for chat notifications
    const chatColRef = ref(db, 'chats');
    const unsubscribeChats = onValue(chatColRef, (snapshot) => {
        const newUnread: Record<string, boolean> = {};
        const chatsData = snapshot.val();
        if (chatsData) {
            Object.keys(chatsData).forEach(studentId => {
                if (chatsData[studentId].unreadByAdmin) {
                    newUnread[studentId] = true;
                }
            });
        }
        setUnreadMessages(newUnread);
    });
    
    const studentsRef = ref(db, 'students');
    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      const studentList: StudentType[] = data ? Object.values(data) : Object.values(initialStudentData);
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const attendanceRef = ref(db, `attendance/${today}`);
      onValue(attendanceRef, (attSnapshot) => {
        const attendanceData = attSnapshot.val() || {};
        const updatedStudents = studentList.map(student => {
          const newStatus = attendanceData[student.studentId]?.status;
          const staticStudent = Object.values(initialStudentData).find(s => s.studentId === student.studentId);
          return { ...student, status: newStatus || staticStudent?.status || 'Unknown' };
        });
        setStudents(updatedStudents);
        setIsLoading(false);
      }, { onlyOnce: true }); // We can make this only once if we set up a combined listener elsewhere
    });


    return () => {
      unsubscribeChats();
      unsubscribeStudents();
    };
  }, []);

  const handleRowClick = (studentId: string) => {
    // Mark as read locally immediately for better UX
    setUnreadMessages(prev => ({...prev, [studentId]: false}));
    
    router.push(`/dashboard/students/${studentId}`);
  };

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

  const sortedAndFilteredStudents = students
    .filter(student => {
        const term = searchTerm.toLowerCase();
        return (
            student.name.toLowerCase().includes(term) ||
            student.studentId.toLowerCase().includes(term)
        );
    })
    .sort((a, b) => {
        const aUnread = unreadMessages[a.studentId];
        const bUnread = unreadMessages[b.studentId];
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        return 0;
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
            className="text-foreground transition-colors hover:text-foreground"
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
                className="text-muted-foreground hover:text-foreground"
              >
                Buses
              </Link>
              <Link
                href="/dashboard/students"
                className="hover:text-foreground"
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
          <div className="relative ml-auto flex-1 sm:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name or ID..."
                  className="w-full rounded-lg bg-background pl-8 sm:w-[200px] md:w-[200px] lg:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <AddStudentForm />
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <Card>
        <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>
                Manage your students and view their details. Click a row to see more.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Bus ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                    <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                    </TableRow>
                  ))
                ) : (
                  sortedAndFilteredStudents.map((student) => (
                      <TableRow key={student.studentId} onClick={() => handleRowClick(student.studentId)} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                              <span className="text-primary hover:underline">
                                  {student.studentId}
                              </span>
                          </TableCell>
                          <TableCell>
                              <div className="flex items-center gap-2">
                                  {student.name}
                                  {student.specialAttention && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                              </div>
                          </TableCell>
                          <TableCell>{student.grade}</TableCell>
                          <TableCell>{student.busId}</TableCell>
                          <TableCell>
                              <Badge variant={getStatusVariant(student.status)}>
                                  {student.status}
                              </Badge>
                          </TableCell>
                          <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                  {unreadMessages[student.studentId] && (
                                      <div className="relative" title="New Message">
                                          <MessageSquare className="h-5 w-5 text-primary" />
                                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                          </span>
                                      </div>
                                  )}
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                          <MoreHorizontal className="h-4 w-4" />
                                          <span className="sr-only">Toggle menu</span>
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                          <EditStudentForm student={student}>
                                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
                                          </EditStudentForm>
                                          <DropdownMenuItem>Delete</DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          </TableCell>
                      </TableRow>
                  ))
                )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
