'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Bus, MapPin, AlertTriangle, Play, Square, Bell } from 'lucide-react';
import { ref, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';

interface Student {
  studentId: string;
  name: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface Bus {
  busId: string;
  name: string;
}

export default function BusSimulatorCard() {
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedBus, setSelectedBus] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const { toast } = useToast();

  // Load students and buses on mount
  useState(() => {
    const loadData = async () => {
      try {
        // Load students
        const studentsSnapshot = await get(ref(db, 'students'));
        if (studentsSnapshot.exists()) {
          const studentsData = studentsSnapshot.val();
          const studentsArray = Object.entries(studentsData).map(([id, data]: [string, any]) => ({
            studentId: id,
            name: data.name,
            address: data.address,
            coordinates: data.coordinates,
          }));
          setStudents(studentsArray);
        }

        // Load buses
        const busesSnapshot = await get(ref(db, 'buses'));
        if (busesSnapshot.exists()) {
          const busesData = busesSnapshot.val();
          const busesArray = Object.entries(busesData).map(([id, data]: [string, any]) => ({
            busId: id,
            name: data.name || data.busName || id,
          }));
          setBuses(busesArray);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  });

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const simulateProximityAlert = async () => {
    if (!selectedStudent || !selectedBus) {
      toast({
        title: 'Selection Required',
        description: 'Please select both a student and a bus.',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulating(true);

    try {
      // Find student coordinates
      const student = students.find(s => s.studentId === selectedStudent);
      
      // Use student coordinates or default to Mumbai location
      let targetLat: number;
      let targetLng: number;
      
      if (student?.coordinates) {
        targetLat = student.coordinates.latitude;
        targetLng = student.coordinates.longitude;
      } else {
        // Default coordinates (Mumbai area) - will save to student record
        targetLat = 19.0760 + (Math.random() * 0.05);
        targetLng = 72.8777 + (Math.random() * 0.05);
        
        // Save default coordinates to Firebase
        await set(ref(db, `students/${selectedStudent}/coordinates`), {
          latitude: targetLat,
          longitude: targetLng,
        });
        
        toast({
          title: 'ℹ️ Using Default Location',
          description: 'Student coordinates not found. Using Mumbai area as default.',
        });
      }

      // Start bus 5km away (north-east direction)
      const startLat = targetLat + 0.045; // ~5km north
      const startLng = targetLng + 0.045; // ~5km east

      const studentName = student?.name || 'Student';
      
      console.log('Simulation started:', {
        studentId: selectedStudent,
        studentName,
        busId: selectedBus,
        targetLat,
        targetLng
      });

      toast({
        title: '🚌 Simulation Started',
        description: `Moving bus towards ${studentName}'s location...`,
      });

      // Update bus location incrementally
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const currentLat = startLat + (targetLat - startLat) * progress;
        const currentLng = startLng + (targetLng - startLng) * progress;
        const distance = calculateDistance(currentLat, currentLng, targetLat, targetLng);

        await set(ref(db, `buses/${selectedBus}/currentLocation`), {
          latitude: currentLat,
          longitude: currentLng,
          timestamp: Date.now(),
          speed: 24, // km/h
          heading: 0,
        });

        console.log(`📍 Bus location updated: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)} (${distance.toFixed(2)}km away)`);

        // Show progress
        if (i % 5 === 0) {
          toast({
            title: `📍 Bus Location Updated`,
            description: `Distance: ${distance.toFixed(2)} km from ${studentName}`,
          });
        }

        // Wait 1 second between updates
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Stop if we've triggered the proximity alert (2km threshold)
        if (distance <= 2.0 && i < steps - 1) {
          toast({
            title: '🔔 Proximity Alert Triggered!',
            description: `Bus is within 2km of ${studentName}. Check the alerts section!`,
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        }
      }

      toast({
        title: '✅ Simulation Complete',
        description: 'Check the Bus Proximity Alerts section above!',
      });
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: 'Simulation Error',
        description: 'Failed to simulate bus location.',
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const simulateMissedBusAlert = async () => {
    if (!selectedStudent || !selectedBus) {
      toast({
        title: 'Selection Required',
        description: 'Please select both a student and a bus.',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulating(true);

    try {
      // Find student coordinates
      const student = students.find(s => s.studentId === selectedStudent);
      
      // Use student coordinates or default to Mumbai location
      let targetLat: number;
      let targetLng: number;
      
      if (student?.coordinates) {
        targetLat = student.coordinates.latitude;
        targetLng = student.coordinates.longitude;
      } else {
        // Default coordinates (Mumbai area) - will save to student record
        targetLat = 19.0760 + (Math.random() * 0.05);
        targetLng = 72.8777 + (Math.random() * 0.05);
        
        // Save default coordinates to Firebase
        await set(ref(db, `students/${selectedStudent}/coordinates`), {
          latitude: targetLat,
          longitude: targetLng,
        });
        
        toast({
          title: 'ℹ️ Using Default Location',
          description: 'Student coordinates not found. Using Mumbai area as default.',
        });
      }

      const studentName = student?.name || 'Student';

      toast({
        title: '🚌 Missed Bus Simulation Started',
        description: `Simulating bus arrival and departure at ${studentName}'s stop...`,
      });

      // Phase 1: Approach the stop (3km to 200m)
      toast({
        title: '📍 Phase 1',
        description: 'Bus approaching stop...',
      });
      
      const approachLat = targetLat + 0.027; // ~3km away
      const approachLng = targetLng + 0.027;
      
      const approachSteps = 10;
      for (let i = 0; i <= approachSteps; i++) {
        const progress = i / approachSteps;
        const currentLat = approachLat + (targetLat - approachLat) * progress;
        const currentLng = approachLng + (targetLng - approachLng) * progress;

        await set(ref(db, `buses/${selectedBus}/currentLocation`), {
          latitude: currentLat,
          longitude: currentLng,
          timestamp: Date.now(),
          speed: 24,
          heading: 0,
        });

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Phase 2: Stop at the location (within 300m)
      toast({
        title: '🛑 Phase 2',
        description: 'Bus stopped at location for 2+ minutes...',
      });

      const stopLat = targetLat + 0.002; // ~220m away
      const stopLng = targetLng + 0.002;

      await set(ref(db, `buses/${selectedBus}/currentLocation`), {
        latitude: stopLat,
        longitude: stopLng,
        timestamp: Date.now(),
        speed: 0,
        heading: 0,
      });

      // Wait 2.5 minutes (simulated with 5 seconds)
      await new Promise(resolve => setTimeout(resolve, 5000));

      toast({
        title: '⏰ Bus Waiting',
        description: 'Bus has been stopped for 2+ minutes...',
      });

      // Phase 3: Leave the stop
      toast({
        title: '🚌 Phase 3',
        description: 'Bus leaving stop...',
      });

      const leaveLat = targetLat - 0.027; // Move away
      const leaveLng = targetLng - 0.027;

      const leaveSteps = 5;
      for (let i = 0; i <= leaveSteps; i++) {
        const progress = i / leaveSteps;
        const currentLat = stopLat + (leaveLat - stopLat) * progress;
        const currentLng = stopLng + (leaveLng - stopLng) * progress;

        await set(ref(db, `buses/${selectedBus}/currentLocation`), {
          latitude: currentLat,
          longitude: currentLng,
          timestamp: Date.now(),
          speed: 24,
          heading: 180,
        });

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: '✅ Missed Bus Alert Triggered!',
        description: `Bus left without ${studentName}. Check the alerts section!`,
      });

      toast({
        title: '💡 Next Step',
        description: 'Check the Missed Bus Alerts section for parent response options!',
      });
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: 'Simulation Error',
        description: 'Failed to simulate missed bus scenario.',
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    toast({
      title: 'Simulation Stopped',
      description: 'Bus simulation has been stopped.',
    });
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-primary" />
            <CardTitle>Bus Location Simulator (Demo)</CardTitle>
          </div>
          {isSimulating && (
            <div className="flex items-center gap-2 text-sm text-orange-500 animate-pulse">
              <Play className="h-4 w-4" />
              <span>Simulating...</span>
            </div>
          )}
        </div>
        <CardDescription>
          Simulate bus movements to test proximity and missed bus alerts. Select a student and bus, then run a simulation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Student Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Student</label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={isSimulating}>
              <SelectTrigger>
                <SelectValue placeholder="Choose student..." />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.studentId} value={student.studentId}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bus Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Bus</label>
            <Select value={selectedBus} onValueChange={setSelectedBus} disabled={isSimulating}>
              <SelectTrigger>
                <SelectValue placeholder="Choose bus..." />
              </SelectTrigger>
              <SelectContent>
                {buses.map((bus) => (
                  <SelectItem key={bus.busId} value={bus.busId}>
                    {bus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Proximity Alert Simulation */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Proximity Alert</label>
            <Button
              onClick={simulateProximityAlert}
              disabled={isSimulating || !selectedStudent || !selectedBus}
              className="w-full"
              variant="default"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Bus Approaching
            </Button>
          </div>

          {/* Missed Bus Simulation */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Missed Bus Alert</label>
            <Button
              onClick={simulateMissedBusAlert}
              disabled={isSimulating || !selectedStudent || !selectedBus}
              className="w-full"
              variant="destructive"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Bus Missed
            </Button>
          </div>

          {/* Quick Test - Trigger Alert Directly */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Direct Alert Test</label>
            <Button
              onClick={async () => {
                if (!selectedStudent || !selectedBus) {
                  toast({
                    title: 'Selection Required',
                    description: 'Please select a student and bus first',
                    variant: 'destructive'
                  });
                  return;
                }
                
                const student = students.find(s => s.studentId === selectedStudent);
                if (!student) return;
                
                try {
                  // Create proximity alert directly
                  const alertKey = `${selectedStudent}-${selectedBus}`;
                  const now = Date.now();
                  
                  const alertData = {
                    studentId: selectedStudent,
                    studentName: student.name,
                    busId: selectedBus,
                    distance: 1.5, // Simulated 1.5km
                    timestamp: now,
                    notified: true,
                  };

                  await set(ref(db, `proximityAlerts/${alertKey}`), alertData);
                  
                  console.log('✅ Proximity alert created in Firebase:', alertKey, alertData);
                  
                  // Verify it was written
                  const verifyRef = ref(db, `proximityAlerts/${alertKey}`);
                  const verifySnapshot = await get(verifyRef);
                  if (verifySnapshot.exists()) {
                    console.log('✅ Verified alert exists in Firebase:', verifySnapshot.val());
                  } else {
                    console.error('❌ Alert was NOT saved to Firebase!');
                  }
                  
                  // Send browser notification
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🚌 Your bus is nearby!', {
                      body: `${student.name}, your bus (${selectedBus}) is approximately 1500 meters away. Please be ready!`,
                      icon: '/images/Bus.png',
                      tag: alertKey,
                    });
                  }
                  
                  toast({
                    title: '✅ Alert Triggered!',
                    description: `Proximity alert created for ${student.name}. Check parent dashboard!`,
                  });
                } catch (error) {
                  console.error('Error creating alert:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to create alert',
                    variant: 'destructive'
                  });
                }
              }}
              disabled={!selectedStudent || !selectedBus}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Bell className="h-4 w-4 mr-2" />
              Trigger Alert Now
            </Button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Bus className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">How it works:</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-300 list-disc list-inside">
                <li>
                  <strong>Bus Approaching:</strong> Simulates bus moving from 5km away to the student's location. 
                  Triggers proximity alert when within 2km (~5 minutes).
                </li>
                <li>
                  <strong>Bus Missed:</strong> Simulates bus arriving at stop, waiting 2+ minutes, then leaving. 
                  Triggers missed bus alert if student not detected on board.
                </li>
                <li>
                  Watch for browser notifications and check the alert sections above!
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Stop Button */}
        {isSimulating && (
          <div className="mt-4">
            <Button onClick={stopSimulation} variant="outline" className="w-full">
              <Square className="h-4 w-4 mr-2" />
              Stop Simulation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
