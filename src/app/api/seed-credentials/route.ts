import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import parentCredentials from '@/lib/parent-credentials.json';
import staffCredentials from '@/lib/staff-credentials.json';

export async function POST() {
    try {
        // Seed parent credentials
        await set(ref(db, 'parentCredentials'), parentCredentials);
        
        // Seed staff credentials
        await set(ref(db, 'staffCredentials'), staffCredentials);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error seeding credentials:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}