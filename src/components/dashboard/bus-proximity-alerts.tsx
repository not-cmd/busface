'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, get, set, push, update } from 'firebase/database';
import { calculateDistance } from '@/lib/route-utils';
import { Bell, BusIcon, Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BusLocation {
  busId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  status: string;
}

interface StudentLocation {
  studentId: string;
  name: string;
  busId: string;
  parentId: string;
  latitude?: number;
  longitude?: number;
  homeLocation?: {
    lat: number;
    lng: number;
  };
  pickupTime?: string;
  status: string;
}

interface ProximityAlert {
  id: string;
  studentId: string;
  studentName: string;
  busId: string;
  distance: number;
  timestamp: number;
  notified: boolean;
}

interface MissedBusAlert {
  id: string;
  studentId: string;
  studentName: string;
  busId: string;
  busName: string;
  parentId: string;
  timestamp: number;
  parentResponse?: 'personally_drop' | 'absent_today' | null;
  responseTimestamp?: number;
}

const PROXIMITY_THRESHOLD_KM = 2.0; // 5 minutes at average speed ~24 km/h
const CHECK_INTERVAL_MS = 15000; // Check every 15 seconds
const ALERT_COOLDOWN_MS = 300000; // Don't alert same student within 5 minutes
const STOP_WAIT_TIME_MS = 120000; // Wait 2 minutes after arriving at stop

export default function BusProximityAlerts() {
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [missedBusAlerts, setMissedBusAlerts] = useState<MissedBusAlert[]>([]);
  const lastAlertTime = useRef<Record<string, number>>({});
  const stopArrivalTimes = useRef<Record<string, number>>({});
  const previousLocations = useRef<Record<string, { lat: number; lng: number }>>({});

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (title: string, body: string, tag?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/images/Bus.png',
        badge: '/images/Bus.png',
        tag: tag || `notification-${Date.now()}`,
        requireInteraction: true,
      });
    }
  };

  const checkProximityAndMissedBuses = async () => {
    try {
      // Get all buses
      const busesRef = ref(db, 'buses');
      const busesSnapshot = await get(busesRef);
      if (!busesSnapshot.exists()) {
        console.log('No buses found in Firebase');
        return;
      }

      const buses = busesSnapshot.val();
      console.log('Checking buses:', Object.keys(buses).length);

      // Get all students
      const studentsRef = ref(db, 'students');
      const studentsSnapshot = await get(studentsRef);
      if (!studentsSnapshot.exists()) {
        console.log('No students found in Firebase');
        return;
      }

      const students = studentsSnapshot.val();
      console.log('Checking students:', Object.keys(students).length);

      const now = Date.now();

      for (const [busKey, bus] of Object.entries(buses) as [string, any][]) {
        const busLocation: BusLocation = {
          busId: bus.busId || busKey,
          latitude: bus.currentLocation?.latitude || 0,
          longitude: bus.currentLocation?.longitude || 0,
          timestamp: bus.currentLocation?.timestamp || now,
          status: bus.status || 'Unknown',
        };

        // Skip if bus doesn't have valid location
        if (!busLocation.latitude || !busLocation.longitude) {
          console.log(`⚠️ Bus ${busLocation.busId} has no valid location`);
          continue;
        }

        console.log(`🚌 Checking bus ${busLocation.busId} at ${busLocation.latitude.toFixed(4)}, ${busLocation.longitude.toFixed(4)}`);

        // Detect if bus has stopped (not moved significantly)
        const prevLocation = previousLocations.current[busLocation.busId];
        if (prevLocation) {
          const distanceMoved = calculateDistance(
            { lat: prevLocation.lat, lng: prevLocation.lng },
            { lat: busLocation.latitude, lng: busLocation.longitude }
          );

          // If bus moved less than 50 meters, consider it stopped
          if (distanceMoved < 0.05) {
            if (!stopArrivalTimes.current[busLocation.busId]) {
              stopArrivalTimes.current[busLocation.busId] = now;
            }
          } else {
            // Bus is moving, clear stop time
            delete stopArrivalTimes.current[busLocation.busId];
          }
        }

        previousLocations.current[busLocation.busId] = {
          lat: busLocation.latitude,
          lng: busLocation.longitude,
        };

        // Get students assigned to this bus
        const busStudents = Object.entries(students)
          .filter(([_, student]: [string, any]) => student.busId === busLocation.busId)
          .map(([studentKey, student]: [string, any]) => ({
            studentId: student.studentId || studentKey,
            name: student.name,
            busId: student.busId,
            parentId: student.parentId,
            latitude: student.latitude,
            longitude: student.longitude,
            homeLocation: student.homeLocation,
            pickupTime: student.pickupTime,
            status: student.status,
          })) as StudentLocation[];

        console.log(`👥 Found ${busStudents.length} students assigned to bus ${busLocation.busId}`);

        for (const student of busStudents) {
          // Get student location (prefer homeLocation, fallback to lat/lng)
          const studentLat = student.homeLocation?.lat || student.latitude;
          const studentLng = student.homeLocation?.lng || student.longitude;

          if (!studentLat || !studentLng) continue;

          // Skip if student is already on board
          if (student.status === 'On Board' || student.status === 'Present') continue;

          // Calculate distance between bus and student
          const distance = calculateDistance(
            { lat: busLocation.latitude, lng: busLocation.longitude },
            { lat: studentLat, lng: studentLng }
          );

          console.log(`Distance check: ${student.name} (${student.studentId}) <-> Bus ${busLocation.busId}: ${distance.toFixed(2)}km`);

          // PROXIMITY ALERT: Bus is within threshold
          if (distance <= PROXIMITY_THRESHOLD_KM) {
            const alertKey = `${student.studentId}-${busLocation.busId}`;
            const lastAlert = lastAlertTime.current[alertKey] || 0;

            // Check cooldown
            if (now - lastAlert > ALERT_COOLDOWN_MS) {
              console.log(`🔔 CREATING PROXIMITY ALERT for ${student.name}:`, {
                distance: `${distance.toFixed(2)}km`,
                busId: busLocation.busId,
                studentId: student.studentId,
                parentId: student.parentId,
                alertKey
              });

              // Create proximity alert
              const proximityAlertRef = ref(db, `proximityAlerts/${alertKey}`);
              const alertData: Omit<ProximityAlert, 'id'> = {
                studentId: student.studentId,
                studentName: student.name,
                busId: busLocation.busId,
                distance: Math.round(distance * 100) / 100,
                timestamp: now,
                notified: true,
              };

              await set(proximityAlertRef, alertData);
              console.log('✅ Proximity alert saved to Firebase:', alertKey);

              // Send notification
              showNotification(
                '🚌 Your bus is nearby!',
                `${student.name}, your bus (${busLocation.busId}) is approximately ${Math.round(distance * 1000)} meters away. Please be ready!`,
                alertKey
              );

              lastAlertTime.current[alertKey] = now;
            } else {
              console.log(`⏰ Cooldown active for ${student.name}, skipping alert (last: ${Math.round((now - lastAlert) / 1000)}s ago)`);
            }
          }

          // MISSED BUS ALERT: Bus stopped at/near location and is now leaving without student
          const stopTime = stopArrivalTimes.current[busLocation.busId];
          if (stopTime && now - stopTime >= STOP_WAIT_TIME_MS) {
            // Bus has been stopped for 2+ minutes near this location
            if (distance <= 0.3) { // Within 300 meters
              // Check if student is on board via face recognition
              const attendanceRef = ref(db, `attendance/${busLocation.busId}/${student.studentId}`);
              const attendanceSnapshot = await get(attendanceRef);
              
              const isOnBoard = attendanceSnapshot.exists() && 
                               attendanceSnapshot.val().status === 'Present';

              if (!isOnBoard) {
                // Student missed the bus
                const missedAlertKey = `missed-${student.studentId}-${busLocation.busId}-${new Date().toDateString()}`;
                const existingAlertRef = ref(db, `missedBusAlerts/${missedAlertKey}`);
                const existingAlert = await get(existingAlertRef);

                // Only create alert once per day
                if (!existingAlert.exists()) {
                  const busName = (Object.values(buses).find((b: any) => b.busId === busLocation.busId) as any)?.name || busLocation.busId;

                  const missedAlertData: Omit<MissedBusAlert, 'id'> = {
                    studentId: student.studentId,
                    studentName: student.name,
                    busId: busLocation.busId,
                    busName: busName,
                    parentId: student.parentId,
                    timestamp: now,
                    parentResponse: null,
                  };

                  await set(existingAlertRef, missedAlertData);

                  // Send notification to parent
                  showNotification(
                    '⚠️ Missed Bus Alert',
                    `We could not locate ${student.name} on ${busName}. Please respond with your arrangements.`,
                    missedAlertKey
                  );

                  // Update student status
                  const studentRef = ref(db, `students/${student.studentId}`);
                  await update(studentRef, {
                    status: 'Not Boarded',
                    lastUpdated: now,
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking proximity and missed buses:', error);
    }
  };

  // Listen for proximity alerts
  useEffect(() => {
    const proximityAlertsRef = ref(db, 'proximityAlerts');
    const unsubscribe = onValue(proximityAlertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const alerts = Object.entries(data).map(([id, alert]: [string, any]) => ({
          id,
          ...alert,
        })) as ProximityAlert[];

        // Sort by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp - a.timestamp);

        // Only show alerts from last 30 minutes
        const recentAlerts = alerts.filter(
          (alert) => Date.now() - alert.timestamp < 1800000
        );

        setProximityAlerts(recentAlerts);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for missed bus alerts
  useEffect(() => {
    const missedAlertsRef = ref(db, 'missedBusAlerts');
    const unsubscribe = onValue(missedAlertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const alerts = Object.entries(data).map(([id, alert]: [string, any]) => ({
          id,
          ...alert,
        })) as MissedBusAlert[];

        // Sort by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp - a.timestamp);

        // Only show today's alerts
        const today = new Date().toDateString();
        const todayAlerts = alerts.filter(
          (alert) => new Date(alert.timestamp).toDateString() === today
        );

        setMissedBusAlerts(todayAlerts);
      }
    });

    return () => unsubscribe();
  }, []);

  // Start proximity checking
  useEffect(() => {
    // Initial check
    checkProximityAndMissedBuses();

    // Set up interval
    const interval = setInterval(checkProximityAndMissedBuses, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const handleParentResponse = async (
    alertId: string,
    response: 'personally_drop' | 'absent_today'
  ) => {
    try {
      const alertRef = ref(db, `missedBusAlerts/${alertId}`);
      await update(alertRef, {
        parentResponse: response,
        responseTimestamp: Date.now(),
      });

      // Update student status
      const alert = missedBusAlerts.find((a) => a.id === alertId);
      if (alert) {
        const studentRef = ref(db, `students/${alert.studentId}`);
        await update(studentRef, {
          status: response === 'personally_drop' ? 'Manually Dropped' : 'Absent Today',
          lastUpdated: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error recording parent response:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Proximity Alerts */}
      {proximityAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Bus Proximity Alerts
            </CardTitle>
            <CardDescription>
              Students whose buses are nearby
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proximityAlerts.map((alert) => (
                <Alert key={alert.id} className="border-blue-200 bg-blue-50">
                  <BusIcon className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-900">
                    {alert.studentName} - Bus Nearby
                  </AlertTitle>
                  <AlertDescription className="text-blue-700">
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="text-sm">
                          {Math.round(alert.distance * 1000)}m away
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-sm">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                      <Badge variant="outline" className="bg-blue-100">
                        {alert.busId}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missed Bus Alerts */}
      {missedBusAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-orange-500" />
              Missed Bus Alerts
            </CardTitle>
            <CardDescription>
              Students who were not detected on their scheduled bus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {missedBusAlerts.map((alert) => (
                <Alert
                  key={alert.id}
                  className={
                    alert.parentResponse
                      ? 'border-green-200 bg-green-50'
                      : 'border-orange-200 bg-orange-50'
                  }
                >
                  <XCircle
                    className={`h-4 w-4 ${
                      alert.parentResponse ? 'text-green-600' : 'text-orange-600'
                    }`}
                  />
                  <AlertTitle
                    className={
                      alert.parentResponse ? 'text-green-900' : 'text-orange-900'
                    }
                  >
                    {alert.studentName} - Not Found on Bus
                  </AlertTitle>
                  <AlertDescription
                    className={
                      alert.parentResponse ? 'text-green-700' : 'text-orange-700'
                    }
                  >
                    <div className="space-y-3">
                      <p className="text-sm">
                        We were unable to locate {alert.studentName} on {alert.busName}{' '}
                        during pickup. The bus has departed from the designated stop.
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(alert.timestamp)}</span>
                        </div>
                        <Badge variant="outline" className="bg-white/50">
                          {alert.busName}
                        </Badge>
                      </div>

                      {!alert.parentResponse ? (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() =>
                              handleParentResponse(alert.id, 'personally_drop')
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            I will drop personally
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() =>
                              handleParentResponse(alert.id, 'absent_today')
                            }
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Absent today
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Badge className="bg-green-600">
                            Response recorded:{' '}
                            {alert.parentResponse === 'personally_drop'
                              ? 'Parent will drop personally'
                              : 'Student absent today'}
                          </Badge>
                          <p className="text-xs mt-1 text-green-600">
                            Responded {formatTimestamp(alert.responseTimestamp || alert.timestamp)}
                          </p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {proximityAlerts.length === 0 && missedBusAlerts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No active alerts at the moment</p>
            <p className="text-sm text-gray-400 mt-2">
              System is monitoring bus locations and student attendance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
