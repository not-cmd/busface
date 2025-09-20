
'use client';

import { useState, useEffect, useCallback } from 'react';
import { GuardianRouteLogo } from '@/components/icons';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, MoreHorizontal, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import studentData from '@/lib/students.json';
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
import type { StudentJson as StudentType } from '@/lib/data';

const students: StudentType[] = Object.values(studentData);

export default function StudentsPage() {
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState<Record<string, boolean>>({});

  const checkUnreadMessages = useCallback(() => {
    const newUnread: Record<string, boolean> = {};
    students.forEach(student => {
      const key = `chat_notification_${student.studentId}`;
      const notification = localStorage.getItem(key);
      if (notification === 'unread') {
        newUnread[student.studentId] = true;
      }
    });
    setUnreadMessages(newUnread);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      checkUnreadMessages();

      const handleStorageChange = (event: StorageEvent) => {
          if (event.key?.startsWith('chat_notification_')) {
              checkUnreadMessages();
          }
      };
      
      window.addEventListener('storage', handleStorageChange);

      return () => {
          window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [checkUnreadMessages]);

  const handleRowClick = (studentId: string) => {
    const key = `chat_notification_${studentId}`;
    localStorage.setItem(key, 'read');
    setUnreadMessages(prev => ({...prev, [studentId]: false}));
    router.push(`/dashboard/students/${studentId}`);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <GuardianRouteLogo className="h-6 w-6" />
            <span className="sr-only">GuardianRoute</span>
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
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <GuardianRouteLogo className="h-6 w-6" />
                <span className="sr-only">GuardianRoute</span>
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
          <div className="ml-auto flex-1 sm:flex-initial">
             <AddStudentForm />
          </div>
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
                {students.map((student) => (
                    <TableRow key={student.studentId} onClick={() => handleRowClick(student.studentId)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                             <div className="flex items-center gap-3">
                                <span className="text-primary hover:underline">
                                    {student.studentId}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.grade}</TableCell>
                        <TableCell>{student.busId}</TableCell>
                        <TableCell>
                            <Badge variant={student.status === 'On Route' ? 'default' : student.status === 'Absent' ? 'destructive' : 'secondary'}>
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
                ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}

    