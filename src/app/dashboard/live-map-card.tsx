
'use client';

import { useState, useEffect, useMemo } from "react";
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Loader, AlertTriangle, Bus, User, Dot } from "lucide-react"
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import type { StudentJson as StudentType } from "@/lib/data";

interface LiveMapCardProps {
    busId?: string;
}

interface BusLocation {
    id: string;
    latitude: number;
    longitude: number;
    liveCctvUrl?: string;
}

interface StudentLocation {
    studentId: string;
    latitude?: number;
    longitude?: number;
    name: string;
    busId: string;
}

const busColors: Record<string, string> = {
    'bus_01': '#3b82f6', // blue-500
    'bus_02': '#10b981', // emerald-500
    'bus_03': '#f97316', // orange-500
    'bus_04': '#8b5cf6', // violet-500
    'bus_05': '#ec4899', // pink-500
};

export function LiveMapCard({ busId }: LiveMapCardProps) {
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [studentLocations, setStudentLocations] = useState<StudentLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewState, setViewState] = useState({
    latitude: 19.0760, // Default to Mumbai
    longitude: 72.8777,
    zoom: 10
  });

  const isSingleBusView = !!busId;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    setIsLoading(true);
    let unsubscribeBuses: () => void;
    let unsubscribeStudents: (() => void) | null = null;
    const busPath = isSingleBusView ? `busLocations/${busId}` : 'busLocations';
    const busDbRef = ref(db, busPath);
    
    unsubscribeBuses = onValue(busDbRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            const fetchedLocations: BusLocation[] = isSingleBusView
                ? [{ id: busId, ...data }]
                : Object.keys(data).map(key => ({ id: key, ...data[key] }));
            
            setBusLocations(fetchedLocations);

            if (fetchedLocations.length > 0) {
                const firstLoc = fetchedLocations[0];
                setViewState(prev => ({ ...prev, latitude: firstLoc.latitude, longitude: firstLoc.longitude, zoom: isSingleBusView ? 14 : 11 }));
            }

            setError(null);
        } else {
            setError(isSingleBusView ? "Bus is currently offline." : "No buses are currently online.");
            setBusLocations([]);
        }
    }, (err) => {
        console.error("RTDB snapshot error (buses):", err);
        setError("Could not connect to live tracking service.");
    });
    
    if (!isSingleBusView) {
        const studentDbRef = ref(db, 'students');
        unsubscribeStudents = onValue(studentDbRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const fetchedStudents: StudentLocation[] = Object.values(data);
                setStudentLocations(fetchedStudents);
            }
        });
    }

    // Set loading to false only after the initial bus data fetch is attempted
    const timer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
        unsubscribeBuses();
        if (unsubscribeStudents) unsubscribeStudents();
        clearTimeout(timer);
    }
  }, [busId, isSingleBusView]);
  
  const busName = useMemo(() => isSingleBusView ? `Bus-${busId.split('_')[1]}` : 'Fleet-wide', [isSingleBusView, busId]);

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader className="h-8 w-8 animate-spin" />
                <p>Accessing live feed...</p>
            </div>
        );
    }
    if (error) {
        return (
             <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                <AlertTriangle className="h-8 w-8" />
                <p className="font-semibold">Could not load map</p>
                <p className="text-sm">{error}</p>
            </div>
        );
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
    if (busLocations.length > 0) {
        return (
            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                style={{width: '100%', height: '100%'}}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={mapboxToken}
            >
                <NavigationControl position="top-right" />
                {busLocations.map(loc => (
                    <Marker key={loc.id} longitude={loc.longitude} latitude={loc.latitude}>
                        <div className="transform -translate-x-1/2 -translate-y-1/2" title={`Bus ${loc.id.split('_')[1]}`}>
                            <Bus className="h-8 w-8" style={{ color: busColors[loc.id] || '#000000', filter: 'drop-shadow(0 0 3px black)' }} />
                        </div>
                    </Marker>
                ))}
                {!isSingleBusView && studentLocations.map(student => (
                    student.latitude && student.longitude ? (
                        <Marker key={student.studentId} longitude={student.longitude} latitude={student.latitude}>
                            <div title={student.name}>
                                 <User className="h-4 w-4" style={{ color: busColors[student.busId] || '#71717a' }}/>
                            </div>
                        </Marker>
                    ) : null
                ))}
            </Map>
        );
    }
    return (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <MapPin className="h-8 w-8" />
            <p>No location data available.</p>
        </div>
    );
  }

  return (
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle>Live Bus Tracking</CardTitle>
                </div>
                <Badge variant={busLocations.length > 0 ? 'default' : 'secondary'}>
                    <span className={`relative flex h-2 w-2 mr-2 ${busLocations.length > 0 ? '' : 'hidden'}`}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    {isLoading ? 'Connecting...' : busLocations.length > 0 ? 'Live' : 'Offline'}
                </Badge>
            </div>
            <CardDescription>
                Real-time location of {busName}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="aspect-video w-full rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                {renderContent()}
            </div>
             {!isSingleBusView && (
                <div className="mt-4 p-2 border rounded-lg">
                    <h4 className="text-sm font-semibold mb-2 text-center">Legend</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs">
                        {Object.entries(busColors).map(([busId, color]) => (
                            <div key={busId} className="flex items-center gap-1.5">
                                <Bus className="h-4 w-4" style={{ color }} />
                                <span>{`Bus ${busId.split('_')[1]}`}</span>
                                <User className="h-4 w-4" style={{ color }} />
                                <span>{`Student Stops`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </CardContent>
    </Card>
  )
}
