
'use client';

import React, { useState, useEffect } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Home, Loader, AlertTriangle, Bus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { StudentJson as StudentType } from '@/lib/data';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

interface RouteMapCardProps {
  busId: string;
  students: StudentType[];
}

interface BusLocation {
  latitude: number;
  longitude: number;
}

function RouteMapCardComponent({ busId, students }: RouteMapCardProps) {
  const [location, setLocation] = useState<BusLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewState, setViewState] = useState({
    latitude: 19.0760, // Default to Mumbai
    longitude: 72.8777,
    zoom: 10
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!busId) return;

    setIsLoading(true);
    const busLocationRef = ref(db, `busLocations/${busId}`);

    const unsubscribe = onValue(busLocationRef, (snapshot) => {
      setIsLoading(false);
      const data = snapshot.val();
      if (data) {
        setLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setViewState(prev => ({...prev, latitude: data.latitude, longitude: data.longitude, zoom: 12}));
        setError(null);
      } else {
        setError('Bus is currently offline. No location data available.');
        setLocation(null);
      }
    }, (err) => {
      console.error('RTDB snapshot error:', err);
      setError('Could not connect to live tracking service.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [busId]);


  const renderMap = () => {
    if (isLoading) {
        return <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
    }
    if (error) {
        return (
             <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                <AlertTriangle className="h-8 w-8" />
                <p className="font-semibold">{error}</p>
            </div>
        )
    }
    if (!mapboxToken || mapboxToken.includes("YOUR_MAPBOX_ACCESS_TOKEN")) {
         return (
            <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                <AlertTriangle className="h-8 w-8" />
                <p className="font-semibold">Mapbox Token Missing</p>
                <p className="text-sm">Please add your Mapbox access token to the `.env.local` file.</p>
            </div>
        )
    }
    if (location) {
        return (
            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                style={{width: '100%', height: '100%'}}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={mapboxToken}
            >
                 <NavigationControl position="top-right" />
                 <Marker longitude={location.longitude} latitude={location.latitude}>
                    <div className="text-primary transform -translate-x-1/2 -translate-y-1/2">
                        <Bus className="h-8 w-8 drop-shadow-lg" />
                    </div>
                </Marker>
                {students.map((student, index) => (
                    student.latitude && student.longitude ? (
                        <Marker key={student.studentId} longitude={student.longitude} latitude={student.latitude}>
                            <div className="transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                <Badge className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center mb-1 z-10">{index + 1}</Badge>
                                <Home className="h-6 w-6 text-blue-800 drop-shadow-md" />
                            </div>
                        </Marker>
                    ) : null
                ))}
            </Map>
        )
    }
    return <p className="text-muted-foreground">No location data.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapIcon className="h-6 w-6 text-primary" />
          <CardTitle>Route Overview</CardTitle>
        </div>
        <CardDescription>Live route and student stops.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="aspect-video w-full rounded-md overflow-hidden border bg-muted flex items-center justify-center mb-4">
          {renderMap()}
        </div>
        <h4 className="font-semibold mb-2 text-sm">Student Stops:</h4>
        <ScrollArea className="h-[150px] w-full rounded-md border p-2">
            <ul className="space-y-3">
                {students.map((student, index) => (
                    <li key={student.studentId} className="flex items-start gap-3 text-xs">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground font-bold text-xs">{index + 1}</span>
                        <div className="flex-1">
                            <p className="font-semibold">{student.name}</p>
                            <p className="text-muted-foreground">{student.address}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export const RouteMapCard = React.memo(RouteMapCardComponent);
