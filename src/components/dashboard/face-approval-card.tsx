
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCheck, EyeOff, Loader2, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
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
    status?: 'processing' | 'pending' | 'failed';
    embeddingCount?: number;
    processingCompleted?: string;
    error?: string;
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
                const loadedPending: PendingRegistration[] = Object.keys(data)
                    .map(key => ({
                        id: key,
                        ...data[key]
                    }))
                    .filter(reg => reg.photos && Array.isArray(reg.photos) && reg.photos.length > 0) // Only include valid registrations
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
                        {pending.map(reg => {
                            // Additional safety check
                            const hasValidPhotos = reg.photos && Array.isArray(reg.photos) && reg.photos.length > 0;
                            if (!hasValidPhotos) return null;
                            
                            const status = reg.status || 'pending';
                            const isProcessing = status === 'processing';
                            const isFailed = status === 'failed';
                            const isPending = status === 'pending';
                            
                            return (
                                <div key={reg.id} className={`flex items-center justify-between gap-4 p-2 rounded-md border bg-background ${
                                    isFailed ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 
                                    isProcessing ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' : 
                                    'border-green-300 bg-green-50 dark:bg-green-950/20'
                                }`}>
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="relative">
                                            <Image
                                                src={reg.photos[0]}
                                                alt={`Pending registration for ${reg.studentName}`}
                                                width={64}
                                                height={64}
                                                className="rounded-md object-cover aspect-square"
                                            />
                                            {isProcessing && (
                                                <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                                                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{reg.studentName}</p>
                                                {isProcessing && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">
                                                        <Clock className="h-3 w-3" />
                                                        Processing
                                                    </span>
                                                )}
                                                {isFailed && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                        <XCircle className="h-3 w-3" />
                                                        Failed
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Ready
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground text-xs">
                                                Submitted {formatDistanceToNow(new Date(reg.timestamp), { addSuffix: true })}
                                            </p>
                                            {isFailed && (
                                                <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {reg.error || 'Failed to generate embeddings'}
                                                </p>
                                            )}
                                            {isPending && reg.embeddingCount !== undefined && (
                                                <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                                                    {reg.embeddingCount} embeddings generated
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleReview(reg, false)}
                                            disabled={isLoading[reg.id] || isProcessing}
                                        >
                                            {isFailed ? 'Delete' : 'Reject'}
                                        </Button>
                                        {!isFailed && (
                                            <Button 
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                onClick={() => handleReview(reg, true)}
                                                disabled={isLoading[reg.id] || isProcessing}
                                            >
                                                {isLoading[reg.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                                            </Button>
                                        )}
                                        {isFailed && (
                                            <Button 
                                                size="sm"
                                                className="bg-orange-600 hover:bg-orange-700"
                                                onClick={() => {
                                                    toast({
                                                        title: "Retry Registration",
                                                        description: "Please ask the user to re-register their face.",
                                                    });
                                                }}
                                                disabled={isLoading[reg.id]}
                                            >
                                                Retry Needed
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
