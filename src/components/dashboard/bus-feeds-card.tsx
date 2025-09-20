
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Video, Loader, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { LiveMapCard } from './live-map-card';
import Image from 'next/image';

interface BusFeedsCardProps {
    busId: string;
}

export function BusFeedsCard({ busId }: BusFeedsCardProps) {
    const [liveCctvUrl, setLiveCctvUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!busId) return;

        setIsLoading(true);
        const busDocRef = ref(db, `busLocations/${busId}`);
        const unsubscribe = onValue(busDocRef, (snapshot) => {
            setIsLoading(false);
            const data = snapshot.val();
            if (data) {
                if (data.liveCctvUrl) {
                    setLiveCctvUrl(data.liveCctvUrl);
                    setError(null);
                } else {
                    setLiveCctvUrl(null);
                    setError("CCTV feed is not available at the moment.");
                }
            } else {
                 setError("Bus is offline. No CCTV data available.");
                 setLiveCctvUrl(null);
            }
        }, (err) => {
            console.error("CCTV snapshot error:", err);
            setError("Could not connect to live CCTV service.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [busId]);
    
    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <LiveMapCard busId={busId} />
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-primary"/>
                        <CardTitle>Live Camera Feed</CardTitle>
                    </div>
                    <CardDescription>Real-time feed from inside the bus.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="aspect-video w-full rounded-md overflow-hidden border bg-black flex items-center justify-center">
                        {isLoading && (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader className="h-8 w-8 animate-spin" />
                                <p>Connecting to CCTV...</p>
                            </div>
                        )}
                        {error && !isLoading && (
                            <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                                <AlertTriangle className="h-8 w-8" />
                                <p className="font-semibold">{error}</p>
                            </div>
                        )}
                        {liveCctvUrl && !isLoading && !error && (
                            <Image src={liveCctvUrl} alt="Live CCTV feed" width={600} height={400} className="object-cover w-full h-full" />
                        )}
                        {!liveCctvUrl && !isLoading && !error && (
                             <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Video className="h-12 w-12" />
                                <p>Waiting for feed...</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
