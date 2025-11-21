/**
 * Bus Location Simulator
 * 
 * This script simulates bus GPS locations for testing proximity alerts.
 * Run this in the browser console or as a test script to populate bus locations.
 */

import { db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';

interface BusLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number;
  heading: number;
}

// Sample bus locations in Mumbai (matching student coordinates)
const BUS_LOCATIONS: Record<string, BusLocation> = {
  bus_01: {
    latitude: 19.0176, // Near student addresses
    longitude: 72.8478,
    timestamp: Date.now(),
    speed: 25,
    heading: 45,
  },
  bus_02: {
    latitude: 19.0213,
    longitude: 72.8424,
    timestamp: Date.now(),
    speed: 30,
    heading: 90,
  },
  bus_03: {
    latitude: 19.0195,
    longitude: 72.8455,
    timestamp: Date.now(),
    speed: 20,
    heading: 180,
  },
  bus_04: {
    latitude: 19.026,
    longitude: 72.8444,
    timestamp: Date.now(),
    speed: 28,
    heading: 270,
  },
  bus_05: {
    latitude: 19.028,
    longitude: 72.849,
    timestamp: Date.now(),
    speed: 22,
    heading: 135,
  },
};

/**
 * Update bus locations in Firebase
 */
export async function updateBusLocations() {
  try {
    for (const [busId, location] of Object.entries(BUS_LOCATIONS)) {
      const busLocationRef = ref(db, `buses/${busId}/currentLocation`);
      await set(busLocationRef, location);
      console.log(`✅ Updated location for ${busId}`);
    }
    console.log('🎉 All bus locations updated successfully!');
  } catch (error) {
    console.error('❌ Error updating bus locations:', error);
  }
}

/**
 * Simulate bus movement toward a student
 * Useful for testing proximity alerts
 */
export async function simulateBusApproach(
  busId: string,
  targetLat: number,
  targetLng: number,
  steps: number = 10
) {
  try {
    const busLocationRef = ref(db, `buses/${busId}/currentLocation`);
    const currentLocation = BUS_LOCATIONS[busId];
    
    if (!currentLocation) {
      console.error(`Bus ${busId} not found`);
      return;
    }

    const latStep = (targetLat - currentLocation.latitude) / steps;
    const lngStep = (targetLng - currentLocation.longitude) / steps;

    for (let i = 0; i <= steps; i++) {
      const newLocation: BusLocation = {
        latitude: currentLocation.latitude + latStep * i,
        longitude: currentLocation.longitude + lngStep * i,
        timestamp: Date.now(),
        speed: 25,
        heading: 45,
      };

      await set(busLocationRef, newLocation);
      console.log(
        `📍 Step ${i + 1}/${steps + 1}: Bus at (${newLocation.latitude.toFixed(
          4
        )}, ${newLocation.longitude.toFixed(4)})`
      );

      // Wait 5 seconds between updates
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.log(`🏁 Bus ${busId} reached target location!`);
  } catch (error) {
    console.error('❌ Error simulating bus movement:', error);
  }
}

/**
 * Simulate bus stopping at a location
 */
export async function simulateBusStop(busId: string, durationMinutes: number = 2) {
  try {
    const busLocationRef = ref(db, `buses/${busId}/currentLocation`);
    const currentLocation = BUS_LOCATIONS[busId];

    if (!currentLocation) {
      console.error(`Bus ${busId} not found`);
      return;
    }

    const stopLocation: BusLocation = {
      ...currentLocation,
      speed: 0, // Stopped
      timestamp: Date.now(),
    };

    await set(busLocationRef, stopLocation);
    console.log(`🛑 Bus ${busId} stopped for ${durationMinutes} minutes`);

    // Keep updating timestamp while stopped
    const interval = setInterval(async () => {
      stopLocation.timestamp = Date.now();
      await set(busLocationRef, stopLocation);
    }, 10000); // Update every 10 seconds

    // Wait for the specified duration
    await new Promise((resolve) =>
      setTimeout(resolve, durationMinutes * 60 * 1000)
    );

    clearInterval(interval);

    // Resume movement
    const movingLocation: BusLocation = {
      ...stopLocation,
      speed: 25,
      timestamp: Date.now(),
    };

    await set(busLocationRef, movingLocation);
    console.log(`🚌 Bus ${busId} resumed movement`);
  } catch (error) {
    console.error('❌ Error simulating bus stop:', error);
  }
}

/**
 * Test proximity alert for a specific student
 */
export async function testProximityAlert(
  studentName: string = 'Sarah Johnson',
  busId: string = 'bus_01'
) {
  console.log(`🧪 Testing proximity alert for ${studentName} on ${busId}`);
  
  // Student coordinates (from students.json)
  const studentCoords = {
    lat: 19.0176,
    lng: 72.8478,
  };

  // Move bus close to student (within 2km)
  await simulateBusApproach(busId, studentCoords.lat + 0.015, studentCoords.lng + 0.015, 5);
  
  console.log('✅ Test complete! Check for proximity alert.');
}

/**
 * Test missed bus alert
 */
export async function testMissedBusAlert(
  studentName: string = 'Sarah Johnson',
  busId: string = 'bus_01'
) {
  console.log(`🧪 Testing missed bus alert for ${studentName} on ${busId}`);
  
  // Student coordinates
  const studentCoords = {
    lat: 19.0176,
    lng: 72.8478,
  };

  // Step 1: Move bus to student location
  console.log('📍 Moving bus to student location...');
  await simulateBusApproach(busId, studentCoords.lat, studentCoords.lng, 3);

  // Step 2: Stop bus for 2+ minutes
  console.log('🛑 Stopping bus for 2 minutes...');
  await simulateBusStop(busId, 2);

  // Step 3: Move bus away
  console.log('🚌 Moving bus away from student location...');
  await simulateBusApproach(busId, studentCoords.lat + 0.02, studentCoords.lng + 0.02, 3);

  console.log('✅ Test complete! Check for missed bus alert.');
  console.log('ℹ️ Note: Student must NOT be in attendance records for alert to trigger.');
}

// For browser console usage
if (typeof window !== 'undefined') {
  (window as any).busLocationSimulator = {
    updateBusLocations,
    simulateBusApproach,
    simulateBusStop,
    testProximityAlert,
    testMissedBusAlert,
  };
  
  console.log('🚌 Bus Location Simulator loaded!');
  console.log('Available commands:');
  console.log('  - busLocationSimulator.updateBusLocations()');
  console.log('  - busLocationSimulator.testProximityAlert()');
  console.log('  - busLocationSimulator.testMissedBusAlert()');
}
