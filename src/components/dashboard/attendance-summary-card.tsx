
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, ClipboardList, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateAttendanceSummaryAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';
import attendanceData from '@/lib/attendance.json';
import studentData from '@/lib/students.json';
import type { StudentJson, StudentStatus } from '@/lib/data';

type AttendanceData = typeof attendanceData;
const allStudents: StudentJson[] = Object.values(studentData);


export function AttendanceSummaryCard() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateSummary = async () => {
    if (!date) return;
    setIsLoading(true);
    setSummary('');

    const formattedDate = format(date, 'yyyy-MM-dd');
    const staticTodaysAttendance = (attendanceData as AttendanceData)[formattedDate as keyof AttendanceData] || {};
    
    const attendanceRecords = allStudents.map(student => {
      const overrideStatus = localStorage.getItem(`student_status_override_${student.studentId}`) as StudentStatus | null;
      const staticRecord = staticTodaysAttendance[student.studentId as keyof typeof staticTodaysAttendance];
      let finalStatus = 'Absent';

      if (overrideStatus) {
        finalStatus = overrideStatus;
      } else if (staticRecord) {
        finalStatus = staticRecord.status;
      }

      return {
        studentId: student.studentId,
        name: student.name,
        status: finalStatus
      }
    });

    const input = {
      dateRange: format(date, 'PPP'),
      attendanceRecords: JSON.stringify(attendanceRecords),
    };
    
    const result = await generateAttendanceSummaryAction(input);
    setSummary(result.summary);
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle>AI Attendance Summary</CardTitle>
        </div>
        <CardDescription>
          Select a date to generate an AI-powered attendance summary.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
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
          <Button onClick={handleGenerateSummary} disabled={isLoading || !date} className='w-full sm:w-auto'>
            <Sparkles className="mr-2 h-4 w-4" />
            {isLoading ? 'Generating...' : 'Generate Summary'}
          </Button>
        </div>

        <div className="mt-4 rounded-md border bg-muted/50 p-4 min-h-[120px]">
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            ) : (
                <p className="text-sm text-foreground">
                    {summary || 'Your generated summary will appear here.'}
                </p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
