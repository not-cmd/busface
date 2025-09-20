
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CheckCircle2, Clock, FileDown, XCircle } from 'lucide-react';
import attendanceData from '@/lib/attendance.json';
import type { StudentStatus } from '@/lib/data';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

interface ParentAttendanceCardProps {
    studentId: string;
}

type AttendanceData = typeof attendanceData;
type DailyRecord = { status: 'Present' | 'Absent' | StudentStatus, entry: string | null, exit: string | null };

export function ParentAttendanceCard({ studentId }: ParentAttendanceCardProps) {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [studentAttendance, setStudentAttendance] = useState<Record<string, DailyRecord>>({});

    useEffect(() => {
        const attendanceRef = ref(db, `attendance`);
        
        const unsubscribe = onValue(attendanceRef, (snapshot) => {
            const allAttendance = snapshot.val() || {};
            const history: Record<string, DailyRecord> = {};
            
            // First, populate with historical static data
             Object.entries(attendanceData).forEach(([date, records]) => {
                const studentRecord = (records as any)[studentId];
                if (studentRecord) {
                    history[date] = studentRecord;
                }
            });

            // Then, overwrite with live data from RTDB
            Object.entries(allAttendance).forEach(([date, records]) => {
                const studentRecord = (records as any)[studentId];
                if (studentRecord) {
                    history[date] = { ...history[date], ...studentRecord };
                }
            });

            setStudentAttendance(history);
        });

        return () => unsubscribe();
    }, [studentId]);


    const presentStatuses: (StudentStatus | 'Present' | 'Absent')[] = ['Present', 'On Board', 'Manually Dropped'];
    const absentStatuses: (StudentStatus | 'Present' | 'Absent')[] = ['Absent', 'Confirmed Absent', 'Not Boarded'];

    const presentDays = Object.keys(studentAttendance)
        .filter(date => {
            const record = studentAttendance[date];
            return record && presentStatuses.includes(record.status);
        })
        .map(date => new Date(date));

    const absentDays = Object.keys(studentAttendance)
        .filter(date => {
            const record = studentAttendance[date];
            return record && absentStatuses.includes(record.status);
        })
        .map(date => new Date(date));


    const selectedDay = date ? format(date, 'yyyy-MM-dd') : null;
    const selectedDayAttendance = selectedDay ? studentAttendance[selectedDay] : null;

    const isPresent = selectedDayAttendance && presentStatuses.includes(selectedDayAttendance.status);
    const isAbsent = selectedDayAttendance && absentStatuses.includes(selectedDayAttendance.status);


    return (
        <div className="mt-4 grid gap-4">
            <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md border w-full sm:w-auto"
                        modifiers={{
                            present: presentDays,
                            absent: absentDays,
                        }}
                        modifiersStyles={{
                            present: {
                                color: 'white',
                                backgroundColor: 'hsl(var(--primary))',
                            },
                            absent: {
                                color: 'white',
                                backgroundColor: 'hsl(var(--destructive))',
                            }
                        }}
                        disabled={(date) => date > new Date() || date < new Date("2024-07-01")}
                    />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Log for {date ? format(date, "PPP") : "..."}</CardTitle>
                        <CardDescription>Entry and exit timestamps from the bus.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center min-h-[200px] space-y-4">
                        {selectedDayAttendance ? (
                            isPresent ? (
                                <>
                                    <div className="flex items-center gap-2 text-lg text-green-600">
                                        <CheckCircle2 className="h-6 w-6" />
                                        <span className="font-semibold">{selectedDayAttendance.status}</span>
                                    </div>
                                    <div className="w-full space-y-2 text-center">
                                        <p className="flex items-center justify-center gap-2"><Clock className="h-4 w-4"/> Entry Time: <strong>{selectedDayAttendance.entry || 'N/A'}</strong></p>
                                        <p className="flex items-center justify-center gap-2"><Clock className="h-4 w-4"/> Exit Time: <strong>{selectedDayAttendance.exit || 'N/A'}</strong></p>
                                    </div>
                                </>
                            ) : isAbsent ? (
                                <div className="flex items-center gap-2 text-lg text-red-600">
                                    <XCircle className="h-6 w-6" />
                                    <span className="font-semibold">{selectedDayAttendance.status}</span>
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No attendance record for this day.</p>
                            )
                        ) : (
                            <p className="text-muted-foreground">No attendance record for this day.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
             <div className="mt-4 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed rounded-lg">
                <FileDown className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="text-lg font-semibold mb-1">Download Full Report</h3>
                <p className="text-muted-foreground text-sm mb-3">Download the complete attendance report in Excel format.</p>
                <button className="text-primary underline text-sm font-medium">Download Report</button>
            </div>
        </div>
    );
}
