
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCheck, EyeOff, Loader2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { reviewFaceRegistrationAction } from '@/app/actions';

interface PendingRegistration {
    id: string; // The unique key from Firebase push
    studentId: string;
    studentName: string;
    photos: string[]; // These will be Data URIs
    timestamp: string;
}

export function FaceApprovalCard() {
    const [pending, setPending] = useState<PendingRegistration[]>([]);
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    useEffect(() => {
        const pendingRef = ref(db, 'pendingFaceRegistrations');
        
        const unsubscribe = onValue(pendingRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedPending: PendingRegistration[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setPending(loadedPending);
            } else {
                setPending([]);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleReview = async (registration: PendingRegistration, isApproved: boolean) => {
        const { id, studentId, studentName, photos } = registration;
        setIsLoading(prev => ({ ...prev, [id]: true }));
        const result = await reviewFaceRegistrationAction(id, studentId, studentName, photos, isApproved);
        setIsLoading(prev => ({ ...prev, [id]: false }));

        if (result.success) {
            toast({
                title: `Registration ${isApproved ? 'Approved' : 'Rejected'}`,
                description: `The face registration for ${studentName} has been processed.`,
            });
        } else {
             toast({
                variant: "destructive",
                title: "Action Failed",
                description: result.error || "An unknown error occurred.",
            });
        }
    }

    if (pending.length === 0) {
        return null;
    }

    return (
        <Card className="border-destructive/50 bg-destructive/10 animate-pulse">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-destructive">Face Registration Approvals</CardTitle>
                </div>
                <CardDescription className="text-destructive/80">Review and approve new face registrations for AI attendance.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full">
                    <div className="space-y-4">
                        {pending.map(reg => (
                            <div key={reg.id} className="flex items-center justify-between gap-4 p-2 rounded-md border bg-background">
                                <div className="flex items-center gap-4">
                                    <Image
                                        src={reg.photos[0]}
                                        alt={`Pending registration for ${reg.studentName}`}
                                        width={64}
                                        height={64}
                                        className="rounded-md object-cover aspect-square"
                                    />
                                    <div className="text-sm">
                                        <p className="font-semibold">{reg.studentName}</p>
                                        <p className="text-muted-foreground text-xs">
                                            Submitted {formatDistanceToNow(new Date(reg.timestamp), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReview(reg, false)}
                                        disabled={isLoading[reg.id]}
                                    >
                                        Reject
                                    </Button>
                                    <Button 
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => handleReview(reg, true)}
                                        disabled={isLoading[reg.id]}
                                    >
                                        {isLoading[reg.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
