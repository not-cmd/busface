import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';
import studentData from '@/lib/students.json';
import busData from '@/lib/buses.json';
import parentCredentials from '@/lib/parent-credentials.json';
import staffCredentials from '@/lib/staff-credentials.json';

async function verifyData(path: string, data: any): Promise<boolean> {
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    if (!snapshot.exists()) {
        console.error(`Data at ${path} does not exist after seeding`);
        return false;
    }
    return true;
}

export async function POST() {
    try {
        console.log("Starting data seeding process...");
        
        // Seed students data
        console.log("Seeding students data...");
        await set(ref(db, 'students'), studentData);
        const studentsOk = await verifyData('students', studentData);
        
        // Seed buses data
        console.log("Seeding buses data...");
        await set(ref(db, 'buses'), busData);
        const busesOk = await verifyData('buses', busData);

        // Seed parent credentials
        console.log("Seeding parent credentials...");
        await set(ref(db, 'parentCredentials'), parentCredentials);
        const parentCredsOk = await verifyData('parentCredentials', parentCredentials);
        
        // Seed staff credentials
        console.log("Seeding staff credentials...");
        await set(ref(db, 'staffCredentials'), staffCredentials);
        const staffCredsOk = await verifyData('staffCredentials', staffCredentials);

        const allOk = studentsOk && busesOk && parentCredsOk && staffCredsOk;
        
        return NextResponse.json({ 
            success: allOk,
            verification: {
                students: studentsOk,
                buses: busesOk,
                parentCredentials: parentCredsOk,
                staffCredentials: staffCredsOk
            }
        });
    } catch (error) {
        console.error('Error seeding data:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error',
                location: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}