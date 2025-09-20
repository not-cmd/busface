import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from 'lucide-react';
import { Users, Bus as BusIcon, Route, ShieldCheck } from 'lucide-react';
import studentData from '@/lib/students.json';
import busData from '@/lib/buses.json';

interface StatCardData {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
}

function StatCard({ data }: { data: StatCardData }) {
    const { title, value, change, icon: Icon } = data
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{change}</p>
            </CardContent>
        </Card>
    )
}

export function OverviewStats() {
  const totalStudents = Object.keys(studentData).length;
  const busesOnRoute = Object.values(busData).filter(bus => bus.status === 'On Route').length;
  const totalBuses = Object.keys(busData).length;

  const overviewStats: StatCardData[] = [
    {
        title: 'Total Students',
        value: totalStudents.toString(),
        change: 'Across all buses',
        icon: Users,
    },
    {
        title: 'Buses on Route',
        value: `${busesOnRoute}/${totalBuses}`,
        change: 'Currently active buses',
        icon: BusIcon,
    },
    {
        title: 'Routes Completed',
        value: '0/36',
        change: 'Morning routes in progress',
        icon: Route,
    },
    {
        title: 'Avg. Safety Score',
        value: '99.2',
        change: 'Daily fleet average',
        icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat) => (
            <StatCard key={stat.title} data={stat} />
        ))}
    </div>
  )
}
