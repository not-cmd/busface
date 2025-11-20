'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Wifi, WifiOff, Clock } from 'lucide-react';
import { subscribeLiveFeed, getLatestFrame, isBroadcasting, type LiveFeedFrame } from '@/lib/live-stream-manager';
import { format } from 'date-fns';

interface LiveStreamViewerProps {
  busId: string;
  busName?: string;
  showStats?: boolean;
}

export function LiveStreamViewer({ busId, busName, showStats = true }: LiveStreamViewerProps) {
  const [currentFrame, setCurrentFrame] = useState<LiveFeedFrame | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let checkInterval: NodeJS.Timeout;

    const init = async () => {
      try {
        // Check if bus is broadcasting
        const broadcasting = await isBroadcasting(busId);
        setIsLive(broadcasting);

        if (broadcasting) {
          // Get latest frame first
          const latestFrame = await getLatestFrame(busId);
          if (latestFrame) {
            setCurrentFrame(latestFrame);
            setLastUpdate(new Date(latestFrame.timestamp));
          }

          // Subscribe to live updates
          unsubscribe = subscribeLiveFeed(busId, (frame) => {
            setCurrentFrame(frame);
            setLastUpdate(new Date(frame.timestamp));
            setIsLive(true);
            setError(null);
          });
        } else {
          setError('Bus is not currently broadcasting');
        }

        setLoading(false);
      } catch (err) {
        console.error('Error initializing live stream:', err);
        setError('Failed to load live stream');
        setLoading(false);
      }
    };

    init();

    // Periodically check broadcast status
    checkInterval = setInterval(async () => {
      const broadcasting = await isBroadcasting(busId);
      setIsLive(broadcasting);
      
      if (!broadcasting && isLive) {
        setError('Stream ended');
      } else if (broadcasting && !isLive) {
        // Stream started, reinitialize
        init();
      }
    }, 5000); // Check every 5 seconds

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(checkInterval);
    };
  }, [busId]);

  // Calculate time since last update
  const timeSinceUpdate = lastUpdate 
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive ? (
              <Video className="h-5 w-5 text-green-600" />
            ) : (
              <VideoOff className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>Live Feed</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <Badge variant="default" className="bg-green-600">
                  LIVE
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">Offline</Badge>
              </>
            )}
          </div>
        </div>
        <CardDescription>
          {busName ? `Bus ${busName}` : `Bus ID: ${busId}`}
          {showStats && lastUpdate && (
            <span className="ml-2 text-xs">
              • Updated {timeSinceUpdate}s ago
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video rounded-md overflow-hidden bg-black/5">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <VideoOff className="h-12 w-12 mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {currentFrame && !loading && (
            <>
              <img
                src={currentFrame.url}
                alt="Live feed"
                className="w-full h-full object-cover"
                onError={() => setError('Failed to load frame')}
              />
              
              {/* Live indicator overlay */}
              {isLive && (
                <div className="absolute top-2 left-2 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-md text-sm font-semibold">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  LIVE
                </div>
              )}

              {/* Quality indicator */}
              {showStats && currentFrame.quality && (
                <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                  {currentFrame.quality.toUpperCase()}
                </div>
              )}

              {/* Timestamp overlay */}
              {showStats && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 text-white px-2 py-1 rounded text-xs">
                  <Clock className="h-3 w-3" />
                  {format(new Date(currentFrame.timestamp), 'HH:mm:ss')}
                </div>
              )}

              {/* Staleness warning */}
              {timeSinceUpdate && timeSinceUpdate > 10 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="bg-yellow-600/90 text-white px-4 py-2 rounded-md text-sm">
                    Stream may be delayed
                  </div>
                </div>
              )}
            </>
          )}

          {!currentFrame && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Video className="h-12 w-12 mb-2" />
              <p className="text-sm">Waiting for stream...</p>
            </div>
          )}
        </div>

        {/* Additional stats */}
        {showStats && isLive && currentFrame && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">Quality</p>
              <p className="text-sm font-semibold capitalize">{currentFrame.quality}</p>
            </div>
            <div className="p-2 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">Latency</p>
              <p className="text-sm font-semibold">{timeSinceUpdate}s</p>
            </div>
            <div className="p-2 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-semibold text-green-600">Active</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
