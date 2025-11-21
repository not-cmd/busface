'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Navigation, Clock, TrendingUp, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TrafficIncident {
  location: string;
  type: string;
  delay: number;
  severity: 'low' | 'medium' | 'high';
}

export function TrafficMonitor({ busId }: { busId: string }) {
  const [trafficStatus, setTrafficStatus] = useState<'light' | 'moderate' | 'heavy' | 'severe'>('light');
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    // Simulate real-time traffic monitoring
    const interval = setInterval(() => {
      // In production, this would fetch from Google Maps Traffic API or similar
      const mockTrafficStates: Array<'light' | 'moderate' | 'heavy' | 'severe'> = ['light', 'moderate', 'heavy'];
      const randomStatus = mockTrafficStates[Math.floor(Math.random() * mockTrafficStates.length)];
      setTrafficStatus(randomStatus);

      // Simulate random incidents
      if (Math.random() > 0.7) {
        const mockIncidents: TrafficIncident[] = [
          {
            location: 'Western Express Highway',
            type: 'Heavy Traffic',
            delay: Math.floor(Math.random() * 20) + 5,
            severity: 'medium',
          },
          {
            location: 'Bandra-Worli Sea Link',
            type: 'Accident',
            delay: Math.floor(Math.random() * 30) + 10,
            severity: 'high',
          },
        ];
        setIncidents([mockIncidents[Math.floor(Math.random() * mockIncidents.length)]]);
      } else {
        setIncidents([]);
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (trafficStatus) {
      case 'light': return 'bg-green-500';
      case 'moderate': return 'bg-yellow-500';
      case 'heavy': return 'bg-orange-500';
      case 'severe': return 'bg-red-500';
    }
  };

  const getStatusBadgeVariant = () => {
    switch (trafficStatus) {
      case 'light': return 'secondary';
      case 'moderate': return 'default';
      case 'heavy': return 'default';
      case 'severe': return 'destructive';
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Live Traffic Monitor</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Real-time traffic conditions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Traffic Status */}
          <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
            <div className={`w-4 h-4 rounded-full ${getStatusColor()} animate-pulse`} />
            <div className="flex-1">
              <h4 className="font-semibold capitalize">{trafficStatus} Traffic</h4>
              <p className="text-sm text-muted-foreground">Current conditions on route</p>
            </div>
            <Badge variant={getSeverityVariant(trafficStatus) as any} className="text-sm px-3">
              <Activity className="mr-1 h-3 w-3" />
              {trafficStatus === 'light' ? 'Normal Flow' : trafficStatus === 'moderate' ? 'Slow Moving' : trafficStatus === 'heavy' ? 'Congested' : 'Severe Delays'}
            </Badge>
          </div>

          {/* Traffic Incidents */}
          {incidents.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Active Incidents
              </h4>
              {incidents.map((incident, idx) => (
                <Alert key={idx} variant={getSeverityVariant(incident.severity) as any}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{incident.type}</div>
                      <AlertDescription className="text-sm">
                        {incident.location}
                      </AlertDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        +{incident.delay} min
                      </Badge>
                      <Badge variant={getSeverityVariant(incident.severity) as any}>
                        {incident.severity}
                      </Badge>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>No incidents reported on route</span>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground mb-1">Avg Speed</div>
              <div className="text-xl font-bold">
                {trafficStatus === 'light' ? '35' : trafficStatus === 'moderate' ? '25' : trafficStatus === 'heavy' ? '15' : '8'} km/h
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground mb-1">Est. Delay</div>
              <div className="text-xl font-bold">
                {incidents.reduce((sum, inc) => sum + inc.delay, 0) || 0} min
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
