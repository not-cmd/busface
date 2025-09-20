
'use client';

import { useState, useEffect } from "react";
import Map, { Marker, NavigationControl } from 'react-map-gl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Loader, AlertTriangle, Bus } from "lucide-react"
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

interface LiveMapCardProps {
    busId?: string;
}

interface BusLocation {
    id: string;
    latitude: number;
    longitude: number;
    liveCctvUrl?: string;
}

export function LiveMapCard({ busId }: LiveMapCardProps) {
  const [locations, setLocations] = useState<BusLocation[]>([]);
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
    if (locations.length > 0) {
        return (
            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                style={{width: '100%', height: '100%'}}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={mapboxToken}
            >
                <NavigationControl position="top-right" />
                {locations.map(loc => (
                    <Marker key={loc.id} longitude={loc.longitude} latitude={loc.latitude}>
                        <div className="text-primary transform -translate-x-1/2 -translate-y-1/2">
                            <Bus className="h-8 w-8" />
                        </div>
                    </Marker>
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
                <Badge variant={locations.length > 0 ? 'default' : 'secondary'}>
                    <span className={`relative flex h-2 w-2 mr-2 ${locations.length > 0 ? '' : 'hidden'}`}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    {isLoading ? 'Connecting...' : locations.length > 0 ? 'Live' : 'Offline'}
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
      </CardContent>
    </Card>
  )
}
