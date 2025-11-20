'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, AlertTriangle, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCameraStream } from '@/hooks/use-camera-stream';
import { useToast } from '@/hooks/use-toast';

interface LiveCCTVProps {
    busId: string;
    ipCamUrl?: string;
}

export function LiveCCTV({ busId, ipCamUrl }: LiveCCTVProps) {
    const { toast } = useToast();
    const defaultIpCamUrl = ipCamUrl || `https://bus-${busId}-camera.local:8080/video`;

    const { videoRef, state, retry } = useCameraStream({
        ipCamUrl: defaultIpCamUrl,
        maxRetries: 3,
        retryDelay: 5000,
        onConnect: () => {
            toast({
                title: 'Camera Connected',
                description: 'Live video feed is now streaming.'
            });
        },
        onDisconnect: () => {
            toast({
                variant: 'destructive',
                title: 'Camera Disconnected',
                description: 'Attempting to reconnect...'
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Camera Error',
                description: error.message
            });
        }
    });

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Video className="h-6 w-6 text-primary" />
                        <CardTitle>Live CCTV Feed</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={state.isConnected ? "default" : "destructive"}>
                            {state.isConnecting ? "Connecting..." : state.isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                        <Badge variant="secondary">
                            {state.isConnected ? "Streaming" : "Offline"}
                        </Badge>
                    </div>
                </div>
                <CardDescription>Real-time video surveillance feed from Bus {busId}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative group">
                    <video
                        ref={videoRef}
                        className="w-full aspect-video rounded-md bg-black"
                        autoPlay
                        muted
                        playsInline
                    />
                    
                    {state.error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
                            <WifiOff className="h-12 w-12 text-red-500 mb-4" />
                            <Alert variant="destructive" className="max-w-sm">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Connection Error</AlertTitle>
                                <AlertDescription>
                                    {state.error.message}. Please check your camera connection and network settings.
                                </AlertDescription>
                            </Alert>
                            <Button onClick={retry} className="mt-4">
                                Try Again
                            </Button>
                        </div>
                    )}

                    {state.isConnecting && !state.error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                            <p className="text-sm text-muted-foreground mt-4">Connecting to camera...</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}