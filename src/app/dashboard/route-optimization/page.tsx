import { RouteOptimizer } from '@/components/dashboard/route-optimizer';

export default function RouteOptimizationPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Route Optimization</h1>
        <p className="text-muted-foreground">
          AI-powered route planning with real-time traffic analysis, fuel efficiency tracking, and carbon footprint monitoring
        </p>
      </div>
      
      <RouteOptimizer busId="bus_101" busName="Bus-101" />
    </div>
  );
}
