'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Route, 
  TrendingUp, 
  Fuel, 
  Leaf, 
  Clock, 
  MapPin, 
  AlertTriangle,
  Navigation,
  Zap,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RouteStop {
  stopId: string;
  stopName: string;
  sequence: number;
  eta: string;
  studentsToPickup: number;
  estimatedDelay: number;
}

interface RouteAlert {
  type: 'traffic' | 'delay' | 'capacity' | 'fuel';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

interface AlternativeRoute {
  routeName: string;
  timeSaved: number;
  fuelSaved: number;
  reason: string;
}

interface OptimizedRoute {
  optimizedRoute: RouteStop[];
  totalDistance: number;
  totalTime: number;
  fuelEstimate: number;
  carbonFootprint: number;
  efficiency: {
    routeEfficiency: number;
    fuelEfficiency: number;
    timeEfficiency: number;
  };
  alerts: RouteAlert[];
  alternativeRoutes?: AlternativeRoute[];
}

interface RouteOptimizerProps {
  busId: string;
  busName: string;
}

export function RouteOptimizer({ busId, busName }: RouteOptimizerProps) {
  const [optimizedData, setOptimizedData] = useState<OptimizedRoute | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setError(null);

    try {
      const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId,
          currentLocation: { lat: 19.0760, lng: 72.8777 },
          stops: [
            { id: 'stop1', name: 'Marine Drive', lat: 18.9435, lng: 72.8234, studentsCount: 5, priority: 'high' },
            { id: 'stop2', name: 'Bandra West', lat: 19.0596, lng: 72.8295, studentsCount: 8, priority: 'medium' },
            { id: 'stop3', name: 'Andheri East', lat: 19.1136, lng: 72.8697, studentsCount: 6, priority: 'medium' },
            { id: 'stop4', name: 'Powai', lat: 19.1176, lng: 72.9060, studentsCount: 4, priority: 'low' },
          ],
          trafficConditions: {
            overall: 'moderate',
            incidents: [
              { location: 'Western Express Highway', type: 'Heavy Traffic', delay: 15 },
            ],
          },
          constraints: {
            maxCapacity: 40,
            schoolStartTime: '08:30',
            maxRouteTime: 90,
            fuelEfficiencyTarget: 4.5,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to optimize route');

      const data = await response.json();
      setOptimizedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'traffic': return <Navigation className="h-4 w-4" />;
      case 'delay': return <Clock className="h-4 w-4" />;
      case 'capacity': return <AlertTriangle className="h-4 w-4" />;
      case 'fuel': return <Fuel className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Route className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">AI Route Optimizer</CardTitle>
                <CardDescription className="text-base mt-1">
                  Intelligent routing for {busName} with real-time traffic and sustainability tracking
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={handleOptimize} 
              disabled={isOptimizing}
              size="lg"
              className="h-12 px-6"
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Optimize Route
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {optimizedData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Distance</CardTitle>
                  <MapPin className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{optimizedData.totalDistance.toFixed(1)} km</div>
                <Progress value={optimizedData.efficiency.routeEfficiency} className="mt-3 h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {optimizedData.efficiency.routeEfficiency}% efficient route
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Time</CardTitle>
                  <Clock className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{optimizedData.totalTime} min</div>
                <Progress value={optimizedData.efficiency.timeEfficiency} className="mt-3 h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {optimizedData.efficiency.timeEfficiency}% time efficiency
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fuel Consumption</CardTitle>
                  <Fuel className="h-4 w-4 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{optimizedData.fuelEstimate.toFixed(1)} L</div>
                <p className="text-sm text-muted-foreground mt-3">
                  {optimizedData.efficiency.fuelEfficiency.toFixed(1)} km/L efficiency
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ₹{(optimizedData.fuelEstimate * 95).toFixed(0)} estimated cost
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Carbon Footprint</CardTitle>
                  <Leaf className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{optimizedData.carbonFootprint.toFixed(1)} kg</div>
                <p className="text-sm text-muted-foreground mt-3">
                  CO₂ emissions
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {((1 - optimizedData.carbonFootprint / 50) * 100).toFixed(0)}% below average
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          {optimizedData.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Route Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {optimizedData.alerts.map((alert, idx) => (
                    <Alert key={idx} variant={getSeverityColor(alert.severity) as any}>
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert.type)}
                        <AlertDescription className="flex-1">{alert.message}</AlertDescription>
                        <Badge variant={getSeverityColor(alert.severity) as any}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optimized Route Stops */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Optimized Stop Sequence
              </CardTitle>
              <CardDescription>
                AI-optimized order with traffic-aware ETAs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optimizedData.optimizedRoute.map((stop, idx) => (
                  <div 
                    key={stop.stopId} 
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                      {stop.sequence}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{stop.stopName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {stop.studentsToPickup} students • ETA: {new Date(stop.eta).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {stop.estimatedDelay > 0 && (
                      <Badge variant="destructive">
                        +{stop.estimatedDelay} min delay
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alternative Routes */}
          {optimizedData.alternativeRoutes && optimizedData.alternativeRoutes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Alternative Routes
                </CardTitle>
                <CardDescription>
                  Consider these alternatives for better efficiency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {optimizedData.alternativeRoutes.map((route, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{route.routeName}</h4>
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            -{route.timeSaved} min
                          </Badge>
                          <Badge variant="secondary">
                            <Fuel className="mr-1 h-3 w-3" />
                            -{route.fuelSaved.toFixed(1)}L
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{route.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Efficiency Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Efficiency Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Route Efficiency</span>
                    <span className="text-sm font-bold">{optimizedData.efficiency.routeEfficiency}%</span>
                  </div>
                  <Progress value={optimizedData.efficiency.routeEfficiency} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Time Efficiency</span>
                    <span className="text-sm font-bold">{optimizedData.efficiency.timeEfficiency}%</span>
                  </div>
                  <Progress value={optimizedData.efficiency.timeEfficiency} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Fuel Efficiency</span>
                    <span className="text-sm font-bold">{optimizedData.efficiency.fuelEfficiency.toFixed(1)} km/L</span>
                  </div>
                  <Progress value={(optimizedData.efficiency.fuelEfficiency / 6) * 100} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
