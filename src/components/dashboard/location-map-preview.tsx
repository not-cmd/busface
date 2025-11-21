'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { MapPin, Loader } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MapComponent = dynamic(() => import('react-map-gl').then(mod => mod.Map), { ssr: false });
const MarkerComponent = dynamic(() => import('react-map-gl').then(mod => mod.Marker), { ssr: false });

interface LocationMapPreviewProps {
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  height?: string;
}

export function LocationMapPreview({ location, height = "200px" }: LocationMapPreviewProps) {
  const [viewState, setViewState] = useState({
    latitude: 19.0760,
    longitude: 72.8777,
    zoom: 12,
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (location) {
      setViewState({
        latitude: location.lat,
        longitude: location.lng,
        zoom: 15,
      });
    }
  }, [location]);

  if (!location) {
    return (
      <Card className="flex items-center justify-center p-6 bg-muted/50" style={{ height }}>
        <div className="text-center space-y-2">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Select an address to preview location on map
          </p>
        </div>
      </Card>
    );
  }

  if (!mapboxToken) {
    return (
      <Card className="flex items-center justify-center p-6 bg-muted/50" style={{ height }}>
        <p className="text-sm text-muted-foreground">Map preview unavailable</p>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden" style={{ height }}>
      <MapComponent
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={mapboxToken}
        attributionControl={false}
        interactive={false}
      >
        {/* Home marker with pulsing animation */}
        <MarkerComponent longitude={location.lng} latitude={location.lat}>
          <div className="relative">
            {/* Pulsing circles */}
            <div className="absolute inset-0 animate-ping bg-blue-500/30 rounded-full scale-150"></div>
            <div className="absolute inset-0 animate-pulse bg-blue-500/20 rounded-full scale-125"></div>
            
            {/* Home pin icon */}
            <div className="relative bg-blue-600 text-white rounded-full p-2.5 shadow-lg border-2 border-white">
              <svg 
                className="h-5 w-5" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </div>
        </MarkerComponent>
      </MapComponent>

      {/* Address overlay badge */}
      <div className="absolute top-2 left-2 right-2">
        <Badge className="bg-background/95 backdrop-blur text-foreground border shadow-lg text-xs py-1 px-2 max-w-full">
          <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-blue-600" />
          <span className="truncate">{location.address.split(',')[0]}</span>
        </Badge>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-2 right-2">
        <Badge variant="secondary" className="bg-background/95 backdrop-blur text-xs">
          Home Location
        </Badge>
      </div>
    </Card>
  );
}
