
import type { LucideIcon } from "lucide-react";
import { Users, Bus as BusIcon, Route, ShieldCheck, AlertTriangle, Siren, PersonStanding, CheckCircle, XCircle, Edit, Car, Gauge } from 'lucide-react';
import { db } from './firebase';
import { ref, onValue } from 'firebase/database';
import { format } from 'date-fns';

// Define a more specific type for student JSON data.
export interface StudentJson {
    id?: string; // Made optional since data uses studentId as primary identifier
    studentId: string;
    name: string;
    age: number;
    grade: string;
    section: string;
    school: string;
    profilePhotos: string[];
    busId: string;
    address: string;
    latitude?: number;
    longitude?: number;
    pickupTime?: string; // Added since it exists in the JSON
    status: string;
    specialAttention: boolean;
    parentId: string;
    specialInstructions: string;
}

export type Bus = {
    busId: string;
    name: string;
    driver: {
        name: string;
        experience: string;
        contact: string;
        photoUrl: string;
        rcUrl: string;
        safetyScore: {
            daily: number;
            average: number;
        };
    };
    registrationNumber: string;
    capacity: number;
    studentsOnBoard: number;
    status: string;
};


export interface StatCardData {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
}

export const overviewStats: StatCardData[] = [
  {
    title: 'Total Students',
    value: '1,254',
    change: '+2.5% from last month',
    icon: Users,
  },
  {
    title: 'Buses on Route',
    value: '18',
    change: 'All buses operational',
    icon: BusIcon,
  },
  {
    title: 'Routes Completed',
    value: '36/36',
    change: '100% completion today',
    icon: Route,
  },
  {
    title: 'Safety Score',
    value: '98.5%',
    change: '+0.2% from yesterday',
    icon: ShieldCheck,
  },
];

export interface Alert {
    id: string;
    type: 'Emergency' | 'Geofence' | 'Info' | 'Override' | 'Speeding';
    title: string;
    time: string;
    icon: LucideIcon;
    color: string;
}

export const alerts: Alert[] = [
    {
        id: '1',
        type: 'Emergency',
        title: 'Panic button activated on Bus-07',
        time: '2 mins ago',
        icon: Siren,
        color: 'text-destructive',
    },
    {
        id: '6',
        type: 'Speeding',
        title: 'Bus-01 exceeded 65 km/h. Safety score impacted.',
        time: '3 mins ago',
        icon: Gauge,
        color: 'text-destructive',
    },
    {
        id: '2',
        type: 'Geofence',
        title: 'Bus-04 deviated from route near Oak St.',
        time: '5 mins ago',
        icon: AlertTriangle,
        color: 'text-yellow-500',
    },
    {
        id: '5',
        type: 'Override',
        title: 'Attendance for Dev overridden to "Present"',
        time: '8 mins ago',
        icon: Edit,
        color: 'text-orange-500',
    },
    {
        id: '3',
        type: 'Info',
        title: 'Bus-11 reports minor traffic delay',
        time: '15 mins ago',
        icon: BusIcon,
        color: 'text-blue-500',
    },
    {
        id: '4',
        type: 'Geofence',
        title: 'Bus-02 made an unauthorized stop',
        time: '28 mins ago',
        icon: AlertTriangle,
        color: 'text-yellow-500',
    },
];

export type StudentStatus = 'On Board' | 'Not Boarded' | 'Absent Today' | 'Manually Dropped' | 'Confirmed Absent' | 'Present' | 'Absent';


// This is the data structure for the Parent Dashboard, which is dynamically generated.
export interface Student extends StudentJson {}

export interface Message {
    id: number;
    sender: 'Parent' | 'Admin' | 'bot';
    text: string;
    timestamp?: string;
}

export const mockMessages: Message[] = [];
