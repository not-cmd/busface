import { RouteOptimizer } from '@/components/dashboard/route-optimizer';
import { TrafficMonitor } from '@/components/dashboard/traffic-monitor';
import { SustainabilityDashboard } from '@/components/dashboard/sustainability-dashboard';

export default function RouteOptimizationPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Route Optimization</h1>
        <p className="text-muted-foreground">
          AI-powered route planning with real-time traffic analysis, fuel efficiency tracking, and carbon footprint monitoring
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RouteOptimizer busId="bus_101" busName="Bus-101" />
        </div>
        <div className="space-y-6">
          <TrafficMonitor busId="bus_101" />
          <SustainabilityDashboard />
        </div>
      </div>
    </div>
  );
}
