
'use client';

import { useState, useEffect, useMemo } from "react";
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Loader, AlertTriangle, Bus, User, Home } from "lucide-react"
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
                mapStyle="mapbox://styles/mapbox/streets-v12"
                mapboxAccessToken={mapboxToken}
                attributionControl={false}
            >
                {/* Navigation Controls */}
                <NavigationControl position="top-right" style={{marginTop: 10, marginRight: 10}} />
                
                {/* Fullscreen Control */}
                <FullscreenControl position="top-right" style={{marginTop: 100, marginRight: 10}} />
                
                {/* Geolocate Control */}
                <GeolocateControl 
                    position="top-right" 
                    style={{marginTop: 145, marginRight: 10}}
                    trackUserLocation={true}
                    showUserHeading={true}
                />
                
                {/* Bus Markers with enhanced styling */}
                {busLocations.map(loc => (
                    <Marker key={loc.id} longitude={loc.longitude} latitude={loc.latitude}>
                        <div className="relative group cursor-pointer">
                            {/* Pulsing animation circle */}
                            <div className="absolute inset-0 animate-ping rounded-full scale-150" style={{ backgroundColor: `${busColors[loc.id] || '#000000'}33` }}></div>
                            {/* Bus icon with shadow */}
                            <div className="relative rounded-full p-2 shadow-lg transform transition-transform group-hover:scale-110" style={{ backgroundColor: busColors[loc.id] || '#000000', color: 'white' }}>
                                <Bus className="h-6 w-6" />
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                Bus {loc.id.split('_')[1]}
                            </div>
                        </div>
                    </Marker>
                ))}
                
                {/* Student Location Markers */}
                {!isSingleBusView && studentLocations.map(student => (
                    student.latitude && student.longitude ? (
                        <Marker key={student.studentId} longitude={student.longitude} latitude={student.latitude}>
                            <div className="group cursor-pointer">
                                <Home className="h-5 w-5 drop-shadow-md transition-transform group-hover:scale-110" style={{ color: busColors[student.busId] || '#71717a' }}/>
                                {/* Tooltip on hover */}
                                <div className="absolute top-full mt-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 left-1/2 transform -translate-x-1/2">
                                    {student.name}
                                </div>
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
    <Card className="shadow-sm">
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Live Bus Tracking</CardTitle>
                        <CardDescription className="text-sm mt-1">
                            Real-time location of {busName}
                        </CardDescription>
                    </div>
                </div>
                <Badge variant={busLocations.length > 0 ? 'default' : 'secondary'} className="px-3 py-1">
                    <span className={`relative flex h-2 w-2 mr-2 ${busLocations.length > 0 ? '' : 'hidden'}`}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </span>
                    {isLoading ? 'Connecting...' : busLocations.length > 0 ? 'Live' : 'Offline'}
                </Badge>
            </div>
        </CardHeader>
        <CardContent>
            <div className="aspect-video w-full rounded-lg overflow-hidden border-2 bg-muted flex items-center justify-center shadow-inner">
                {renderContent()}
            </div>
            {busLocations.length > 0 && (
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        <span>Active Bus</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span>{busLocations.length} {busLocations.length === 1 ? 'Bus' : 'Buses'} Tracked</span>
                    </div>
                    {!isSingleBusView && studentLocations.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Home className="h-3 w-3" />
                            <span>{studentLocations.filter(s => s.latitude && s.longitude).length} Student Homes</span>
                        </div>
                    )}
                </div>
            )}
             {!isSingleBusView && busLocations.length > 0 && (
                <div className="mt-4 p-3 border rounded-lg">
                    <h4 className="text-sm font-semibold mb-2 text-center">Bus Legend</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs">
                        {Object.entries(busColors).map(([busId, color]) => (
                            <div key={busId} className="flex items-center gap-1.5">
                                <Bus className="h-4 w-4" style={{ color }} />
                                <span className="font-medium">{`Bus ${busId.split('_')[1]}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </CardContent>
    </Card>
  )
}
