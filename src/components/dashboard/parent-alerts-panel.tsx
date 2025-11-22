'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { handleMissedBusResponseAction } from '@/app/actions';
import { Bell, BusIcon, Clock, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

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

interface ParentAlertsPanelProps {
  parentId: string;
  studentIds: string[];
}

export default function ParentAlertsPanel({ parentId, studentIds }: ParentAlertsPanelProps) {
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [missedBusAlerts, setMissedBusAlerts] = useState<MissedBusAlert[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const { toast } = useToast();

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen for proximity alerts for this parent's students
  useEffect(() => {
    console.log('👂 Parent panel listening for alerts. StudentIds:', studentIds, 'ParentId:', parentId);
    
    const proximityAlertsRef = ref(db, 'proximityAlerts');
    const unsubscribe = onValue(proximityAlertsRef, (snapshot) => {
      console.log('📡 Proximity alerts update received');
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📦 Raw proximity alerts data:', data);
        
        const alerts = Object.entries(data)
          .map(([id, alert]: [string, any]) => ({
            id,
            ...alert,
          }))
          .filter((alert) => studentIds.includes(alert.studentId)) as ProximityAlert[];

        console.log('🎯 Filtered alerts for this parent:', alerts);

        // Sort by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp - a.timestamp);

        // Only show alerts from last 30 minutes
        const recentAlerts = alerts.filter(
          (alert) => Date.now() - alert.timestamp < 1800000
        );

        console.log('⏰ Recent alerts (last 30 mins):', recentAlerts);
        setProximityAlerts(recentAlerts);

        // Show browser notification for new alerts
        recentAlerts.forEach((alert) => {
          console.log('🔔 Checking alert for notification:', alert);
          if (
            alert.notified &&
            Date.now() - alert.timestamp < 60000 &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            console.log('📣 Sending browser notification for:', alert.studentName);
            new Notification('🚌 Bus Nearby!', {
              body: `${alert.studentName}'s bus (${alert.busId}) is approximately ${Math.round(alert.distance * 1000)} meters away. Please be ready!`,
              icon: '/images/Bus.png',
              badge: '/images/Bus.png',
              tag: alert.id,
              requireInteraction: true,
            });
          }
        });
      } else {
        console.log('❌ No proximity alerts in Firebase');
        setProximityAlerts([]);
      }
    });

    return () => unsubscribe();
  }, [studentIds]);

  // Listen for missed bus alerts for this parent
  useEffect(() => {
    const missedAlertsRef = ref(db, 'missedBusAlerts');
    const unsubscribe = onValue(missedAlertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const alerts = Object.entries(data)
          .map(([id, alert]: [string, any]) => ({
            id,
            ...alert,
          }))
          .filter((alert) => alert.parentId === parentId) as MissedBusAlert[];

        // Sort by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp - a.timestamp);

        // Only show today's alerts
        const today = new Date().toDateString();
        const todayAlerts = alerts.filter(
          (alert) => new Date(alert.timestamp).toDateString() === today
        );

        setMissedBusAlerts(todayAlerts);

        // Show browser notification for new alerts without response
        todayAlerts.forEach((alert) => {
          if (
            !alert.parentResponse &&
            Date.now() - alert.timestamp < 300000 &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('⚠️ Student Not Found on Bus', {
              body: `We could not locate ${alert.studentName} on ${alert.busName}. Please respond with your arrangements.`,
              icon: '/images/Bus.png',
              badge: '/images/Bus.png',
              tag: alert.id,
              requireInteraction: true,
            });
          }
        });
      } else {
        setMissedBusAlerts([]);
      }
    });

    return () => unsubscribe();
  }, [parentId]);

  const handleResponse = async (
    alertId: string,
    studentId: string,
    response: 'personally_drop' | 'absent_today'
  ) => {
    setResponding(alertId);
    try {
      const result = await handleMissedBusResponseAction(alertId, studentId, response);
      
      if (result.success) {
        toast({
          title: 'Response Recorded',
          description:
            response === 'personally_drop'
              ? 'We have noted that you will drop your child personally.'
              : 'We have marked your child as absent for today.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to record response. Please try again.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setResponding(null);
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

  const pendingMissedAlerts = missedBusAlerts.filter((alert) => !alert.parentResponse);
  const respondedMissedAlerts = missedBusAlerts.filter((alert) => alert.parentResponse);

  return (
    <div className="space-y-4">
      {/* Debug Info */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded border">
        Monitoring: {studentIds.join(', ')} | Proximity Alerts: {proximityAlerts.length} | Missed Bus: {missedBusAlerts.length}
      </div>

      {/* Proximity Alerts */}
      {proximityAlerts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Bell className="h-5 w-5 text-blue-600" />
              Bus Nearby!
            </CardTitle>
            <CardDescription className="text-blue-700">
              Your child&apos;s bus is approaching
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proximityAlerts.map((alert) => (
                <Alert key={alert.id} className="border-blue-300 bg-white">
                  <BusIcon className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-900">
                    {alert.studentName}&apos;s Bus is Nearby
                  </AlertTitle>
                  <AlertDescription className="text-blue-700">
                    <p className="mb-2">
                      The bus is approximately{' '}
                      <strong>{Math.round(alert.distance * 1000)} meters</strong> away.
                      Please ensure your child is ready!
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimestamp(alert.timestamp)}</span>
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

      {/* Pending Missed Bus Alerts */}
      {pendingMissedAlerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Action Required
            </CardTitle>
            <CardDescription className="text-orange-700">
              Please respond to the following alert(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingMissedAlerts.map((alert) => (
                <Alert key={alert.id} className="border-orange-300 bg-white">
                  <XCircle className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-900">
                    {alert.studentName} Not Found on Bus
                  </AlertTitle>
                  <AlertDescription className="text-orange-700">
                    <div className="space-y-3">
                      <p className="text-sm">
                        We were unable to locate {alert.studentName} on {alert.busName}{' '}
                        during the scheduled pickup. The bus has departed from the
                        designated stop.
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(alert.timestamp)}</span>
                        </div>
                        <Badge variant="outline" className="bg-orange-100">
                          {alert.busName}
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-2 mt-3">
                        <p className="text-sm font-medium">
                          Please select one of the following options:
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={responding === alert.id}
                            onClick={() =>
                              handleResponse(alert.id, alert.studentId, 'personally_drop')
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            I will drop personally
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={responding === alert.id}
                            onClick={() =>
                              handleResponse(alert.id, alert.studentId, 'absent_today')
                            }
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Absent today
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Responded Missed Bus Alerts */}
      {respondedMissedAlerts.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Responded Alerts
            </CardTitle>
            <CardDescription className="text-green-700">
              Your responses have been recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {respondedMissedAlerts.map((alert) => (
                <Alert key={alert.id} className="border-green-300 bg-white">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-900">
                    {alert.studentName} - {alert.busName}
                  </AlertTitle>
                  <AlertDescription className="text-green-700">
                    <div className="space-y-2">
                      <Badge className="bg-green-600">
                        {alert.parentResponse === 'personally_drop'
                          ? 'Parent dropping personally'
                          : 'Student absent today'}
                      </Badge>
                      <p className="text-xs">
                        Responded {formatTimestamp(alert.responseTimestamp || alert.timestamp)}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {proximityAlerts.length === 0 &&
        pendingMissedAlerts.length === 0 &&
        respondedMissedAlerts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No alerts at the moment</p>
              <p className="text-sm text-gray-400 mt-2">
                You&apos;ll be notified when your child&apos;s bus is nearby
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
