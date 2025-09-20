
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, EyeOff } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

interface IntruderAlert {
    id: string;
    snapshotUrl: string; // This will be a Data URI
    timestamp: string;
    busId: string;
}

export function IntruderAlertsCard() {
    const [alerts, setAlerts] = useState<IntruderAlert[]>([]);

    useEffect(() => {
        const alertsRef = ref(db, 'intruderAlerts');
        const recentAlertsQuery = query(alertsRef, orderByChild('timestamp'), limitToLast(10));
        
        const unsubscribe = onValue(recentAlertsQuery, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedAlerts: IntruderAlert[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setAlerts(loadedAlerts);
            } else {
                setAlerts([]);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                    <CardTitle>Intruder Alerts</CardTitle>
                </div>
                <CardDescription>Snapshots of unrecognized individuals.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full">
                    {alerts.length > 0 ? (
                        <div className="space-y-4">
                            {alerts.map(alert => (
                                <div key={alert.id} className="flex items-center gap-4 p-2 rounded-md border border-destructive/20 bg-destructive/5">
                                    <Image
                                        src={alert.snapshotUrl}
                                        alt={`Intruder snapshot from ${alert.busId}`}
                                        width={64}
                                        height={64}
                                        className="rounded-md object-cover aspect-square"
                                    />
                                    <div className="text-sm">
                                        <p className="font-semibold text-destructive">Unrecognized Person</p>
                                        <p className="text-muted-foreground">
                                            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                                        </p>
                                        <Badge variant="destructive" className="mt-1">{alert.busId.replace('_', '-')}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <EyeOff className="h-8 w-8 mb-2" />
                            <p className="text-sm">No intruder alerts.</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
