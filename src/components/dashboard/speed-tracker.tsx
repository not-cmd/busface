
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, set, serverTimestamp } from 'firebase/database';

interface SpeedTrackerProps {
    busId: string;
}

export function SpeedTracker({ busId }: SpeedTrackerProps) {
    const [speed, setSpeed] = useState<number | null>(null);
    const { toast, dismiss } = useToast();
    const speedToastId = useRef<string | null>(null);

    useEffect(() => {
        let watchId: number;
        if (busId && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            async (position) => {
            const { latitude, longitude } = position.coords;
            const currentSpeed = position.coords.speed ? position.coords.speed * 3.6 : 0; // m/s to km/h
            setSpeed(currentSpeed);
            
            if (currentSpeed > 55 && !speedToastId.current) {
                const { id } = toast({
                    variant: "destructive",
                    title: "High Speed Warning",
                    description: "Please reduce your speed and drive safely.",
                    duration: Infinity, // Stays until dismissed
                });
                speedToastId.current = id;
            } else if (currentSpeed <= 55 && speedToastId.current) {
                dismiss(speedToastId.current);
                speedToastId.current = null;
            }

            try {
                const busLocationRef = ref(db, `busLocations/${busId}`);
                await set(busLocationRef, {
                    latitude,
                    longitude,
                    speed: currentSpeed,
                    timestamp: serverTimestamp(),
                    liveCctvUrl: `https://placehold.co/600x400.png?text=Bus-${busId.split('_')[1]}-Live`
                });
            } catch (error) {
                console.error("Error writing location to RTDB:", error);
            }
            },
            (error) => {
            console.error("Geolocation error:", error);
            toast({
                variant: 'destructive',
                title: 'Location Error',
                description: 'Could not get location. Make sure GPS is enabled.',
            });
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
        }

        return () => {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
        if (speedToastId.current) {
            dismiss(speedToastId.current);
        }
        };
    }, [busId, toast, dismiss]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Gauge className="h-6 w-6 text-primary" />
                    <CardTitle>Speedometer</CardTitle>
                </div>
                <CardDescription>Real-time bus speed.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-32">
                {speed !== null ? (
                    <div className="text-center">
                        <span className="text-6xl font-bold">{speed.toFixed(0)}</span>
                        <span className="text-xl text-muted-foreground ml-2">km/h</span>
                    </div>
                ) : (
                    <p className="text-muted-foreground">Calculating speed...</p>
                )}
            </CardContent>
        </Card>
    );
}
