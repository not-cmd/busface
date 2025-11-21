
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Home, Loader, AlertTriangle, Bus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { StudentJson as StudentType } from '@/lib/data';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

// Dynamically import the Map components with no SSR
const MapComponent = dynamic(() => import('react-map-gl').then(mod => mod.Map || mod.default), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader className="h-8 w-8 animate-spin" /></div>
});

const MarkerComponent = dynamic(() => import('react-map-gl').then(mod => mod.Marker), { 
  ssr: false 
});

const NavigationControlComponent = dynamic(() => import('react-map-gl').then(mod => mod.NavigationControl), { 
  ssr: false 
});

const FullscreenControlComponent = dynamic(() => import('react-map-gl').then(mod => mod.FullscreenControl), { 
  ssr: false 
});

const GeolocateControlComponent = dynamic(() => import('react-map-gl').then(mod => mod.GeolocateControl), { 
  ssr: false 
});

interface RouteMapCardProps {
  busId: string;
  students: StudentType[];
}

interface BusLocation {
  latitude: number;
  longitude: number;
}

// Browser compatibility check
const isBrowserSupported = () => {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check for WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    // Check for other required features
    const hasWebGL = !!gl;
    const hasWorker = typeof Worker !== 'undefined';
    const hasArrayBuffer = typeof ArrayBuffer !== 'undefined';
    
    return hasWebGL && hasWorker && hasArrayBuffer;
  } catch (e) {
    return false;
  }
};

function RouteMapCardComponent({ busId, students }: RouteMapCardProps) {
  const [location, setLocation] = useState<BusLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [viewState, setViewState] = useState({
    latitude: 19.0760, // Default to Mumbai
    longitude: 72.8777,
    zoom: 10
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    // Check browser compatibility on client side
    setBrowserSupported(isBrowserSupported());
  }, []);

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
    if (!browserSupported) {
        return (
            <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                <AlertTriangle className="h-8 w-8" />
                <p className="font-semibold">Browser Not Supported</p>
                <p className="text-sm">Your browser doesn't support the required features for map rendering. Please try using a modern browser like Chrome, Firefox, or Safari.</p>
            </div>
        )
    }
    if (location) {
        return (
            <MapComponent
                {...viewState}
                onMove={(evt: any) => setViewState(evt.viewState)}
                style={{width: '100%', height: '100%'}}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                mapboxAccessToken={mapboxToken}
                attributionControl={false}
            >
                {/* Navigation Controls */}
                <NavigationControlComponent position="top-right" style={{marginTop: 10, marginRight: 10}} />
                
                {/* Fullscreen Control */}
                <FullscreenControlComponent position="top-right" style={{marginTop: 100, marginRight: 10}} />
                
                {/* Geolocate Control - Show user's location */}
                <GeolocateControlComponent 
                    position="top-right" 
                    style={{marginTop: 145, marginRight: 10}}
                    trackUserLocation={true}
                    showUserHeading={true}
                />
                
                {/* Bus Marker with enhanced styling */}
                 <MarkerComponent longitude={location.longitude} latitude={location.latitude}>
                    <div className="relative group cursor-pointer">
                        {/* Pulsing animation circle */}
                        <div className="absolute inset-0 animate-ping bg-primary/30 rounded-full scale-150"></div>
                        {/* Bus icon with shadow */}
                        <div className="relative bg-primary text-primary-foreground rounded-full p-2 shadow-lg transform transition-transform group-hover:scale-110">
                            <Bus className="h-6 w-6" />
                        </div>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Bus Location
                        </div>
                    </div>
                </MarkerComponent>
                
                {/* Student Home Markers */}
                {students.map((student, index) => (
                    student.latitude && student.longitude ? (
                        <MarkerComponent key={student.studentId} longitude={student.longitude} latitude={student.latitude}>
                            <div className="transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer">
                                <Badge className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center mb-1 z-10 shadow-md">{index + 1}</Badge>
                                <Home className="h-6 w-6 text-blue-800 drop-shadow-md transition-transform group-hover:scale-110" />
                                {/* Tooltip on hover */}
                                <div className="absolute top-full mt-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                                    {student.name}
                                </div>
                            </div>
                        </MarkerComponent>
                    ) : null
                ))}
            </MapComponent>
        )
    }
    return <p className="text-muted-foreground">No location data.</p>;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MapIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Route Overview</CardTitle>
            <CardDescription className="text-sm mt-1">Live route and student stops</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video w-full rounded-lg overflow-hidden border-2 bg-muted flex items-center justify-center mb-4 shadow-inner">
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
