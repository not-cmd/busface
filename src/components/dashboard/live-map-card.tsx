
'use client';

import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Loader, AlertTriangle, Bus } from "lucide-react"
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

// Dynamically import the Map component with no SSR
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

interface LiveMapCardProps {
    busId?: string;
}

interface BusLocation {
    id: string;
    latitude: number;
    longitude: number;
    liveCctvUrl?: string;
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

export function LiveMapCard({ busId }: LiveMapCardProps) {
  const [locations, setLocations] = useState<BusLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [viewState, setViewState] = useState({
    latitude: 19.0760, // Default to Mumbai
    longitude: 72.8777,
    zoom: 10
  });

  const isSingleBusView = !!busId;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    // Check browser compatibility on client side
    setBrowserSupported(isBrowserSupported());
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let unsubscribe: () => void;
    const path = isSingleBusView ? `busLocations/${busId}` : 'busLocations';
    const dbRef = ref(db, path);
    
    unsubscribe = onValue(dbRef, (snapshot) => {
        setIsLoading(false);
        const data = snapshot.val();
        
        if (data) {
            const fetchedLocations: BusLocation[] = isSingleBusView
                ? [{ id: busId, ...data }]
                : Object.keys(data).map(key => ({ id: key, ...data[key] }));
            
            setLocations(fetchedLocations);

            if (fetchedLocations.length > 0) {
                const firstLoc = fetchedLocations[0];
                setViewState(prev => ({ ...prev, latitude: firstLoc.latitude, longitude: firstLoc.longitude, zoom: isSingleBusView ? 14 : 11 }));
            }

            setError(null);
        } else {
            setError(isSingleBusView ? "Bus is currently offline." : "No buses are currently online.");
            setLocations([]);
        }
    }, (err) => {
        console.error("RTDB snapshot error:", err);
        setError("Could not connect to live tracking service.");
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [busId, isSingleBusView]);
  
  const busName = isSingleBusView ? `Bus-${busId.split('_')[1]}` : 'Fleet-wide';

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
    if (!browserSupported) {
        return (
            <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                <AlertTriangle className="h-8 w-8" />
                <p className="font-semibold">Browser Not Supported</p>
                <p className="text-sm">Your browser doesn't support the required features for map rendering. Please try using a modern browser like Chrome, Firefox, or Safari.</p>
            </div>
        )
    }
    if (locations.length > 0) {
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
                
                {/* Bus Markers with enhanced styling */}
                {locations.map(loc => (
                    <MarkerComponent key={loc.id} longitude={loc.longitude} latitude={loc.latitude}>
                        <div className="relative group cursor-pointer">
                            {/* Pulsing animation circle */}
                            <div className="absolute inset-0 animate-ping bg-primary/30 rounded-full scale-150"></div>
                            {/* Bus icon with shadow */}
                            <div className="relative bg-primary text-primary-foreground rounded-full p-2 shadow-lg transform transition-transform group-hover:scale-110">
                                <Bus className="h-6 w-6" />
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                Bus {loc.id.split('_')[1]}
                            </div>
                        </div>
                    </MarkerComponent>
                ))}
            </MapComponent>
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
                <Badge variant={locations.length > 0 ? 'default' : 'secondary'} className="px-3 py-1">
                    <span className={`relative flex h-2 w-2 mr-2 ${locations.length > 0 ? '' : 'hidden'}`}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </span>
                    {isLoading ? 'Connecting...' : locations.length > 0 ? 'Live' : 'Offline'}
                </Badge>
            </div>
        </CardHeader>
      <CardContent>
        <div className="aspect-video w-full rounded-lg overflow-hidden border-2 bg-muted flex items-center justify-center shadow-inner">
            {renderContent()}
        </div>
        {locations.length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span>Active Bus</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span>{locations.length} {locations.length === 1 ? 'Bus' : 'Buses'} Tracked</span>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  )
}
