
'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { StudentStatus } from "@/lib/data";
import { Bus, Hand, AlertTriangle } from "lucide-react";

interface MissedBusAlertProps {
    studentName: string;
    onStatusUpdate: (status: StudentStatus) => void;
}

export function MissedBusAlert({ studentName, onStatusUpdate }: MissedBusAlertProps) {
    return (
        <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800">
            <AlertTriangle className="h-4 w-4 !text-yellow-800" />
            <AlertTitle>
                {studentName} has not boarded the bus.
            </AlertTitle>
            <AlertDescription>
                <p className="mb-4">Please let us know if your child will be attending school today.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white" 
                        onClick={() => onStatusUpdate('Manually Dropped')}
                    >
                        <Hand className="mr-2 h-4 w-4"/> I'll Drop Them Manually
                    </Button>
                     <Button 
                        className="w-full bg-red-500 hover:bg-red-600 text-white" 
                        onClick={() => onStatusUpdate('Confirmed Absent')}
                    >
                        <Bus className="mr-2 h-4 w-4"/> Won't Attend Today
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    )
}
