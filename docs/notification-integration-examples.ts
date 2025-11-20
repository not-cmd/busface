// Example: How to integrate notifications with face recognition system
// Add this to your facial recognition component

import { createNotification } from '@/lib/notification-manager';

// Example 1: Student Boarding Notification
async function handleStudentBoarded(studentData: any, busData: any) {
  // Get parent user ID (you'll need to fetch this from your students database)
  const parentId = studentData.parentId || 'parent-123';
  
  await createNotification(
    parentId,
    'student_boarded',
    'Student Boarded Bus',
    `${studentData.name} has boarded ${busData.name}`,
    'high',
    {
      studentId: studentData.id,
      studentName: studentData.name,
      busId: busData.id,
      busName: busData.name,
      timestamp: Date.now(),
      location: busData.currentLocation,
    },
    `/dashboard/attendance`
  );
}

// Example 2: Student Exit Notification
async function handleStudentExited(studentData: any, busData: any) {
  const parentId = studentData.parentId || 'parent-123';
  
  await createNotification(
    parentId,
    'student_exited',
    'Student Exited Bus',
    `${studentData.name} has exited ${busData.name}`,
    'high',
    {
      studentId: studentData.id,
      studentName: studentData.name,
      busId: busData.id,
      busName: busData.name,
      timestamp: Date.now(),
      location: busData.currentLocation,
    },
    `/dashboard/attendance`
  );
}

// Example 3: Intruder Alert
async function handleIntruderDetected(busData: any, faceData: any) {
  // Notify both admin and bus staff
  const adminId = 'admin-001';
  const staffId = busData.staffId;
  
  const metadata = {
    busId: busData.id,
    busName: busData.name,
    timestamp: Date.now(),
    confidence: faceData.confidence,
    imageUrl: faceData.imageUrl,
  };
  
  // Notify admin
  await createNotification(
    adminId,
    'intruder_alert',
    '⚠️ Intruder Detected',
    `Unrecognized person detected on ${busData.name}`,
    'critical',
    metadata,
    `/dashboard/buses/${busData.id}/live-feed`
  );
  
  // Notify bus staff
  await createNotification(
    staffId,
    'intruder_alert',
    '⚠️ Intruder Detected',
    `Unrecognized person detected on ${busData.name}`,
    'critical',
    metadata,
    `/dashboard/buses/${busData.id}/live-feed`
  );
}

// Example 4: Emergency Alert
async function triggerEmergencyAlert(busData: any, emergencyType: string) {
  // Get all parents of students on this bus
  const studentIds = busData.studentIds || [];
  const parentIds = await getParentIdsForStudents(studentIds);
  
  // Also notify admin and staff
  const allUserIds = [...parentIds, 'admin-001', busData.staffId];
  
  const metadata = {
    busId: busData.id,
    busName: busData.name,
    emergencyType,
    timestamp: Date.now(),
    location: busData.currentLocation,
  };
  
  // Send notification to everyone
  const notificationPromises = allUserIds.map(userId =>
    createNotification(
      userId,
      'emergency',
      '🚨 EMERGENCY ALERT',
      `Emergency on ${busData.name}: ${emergencyType}`,
      'critical',
      metadata,
      `/dashboard/buses/${busData.id}/emergency`
    )
  );
  
  await Promise.all(notificationPromises);
}

// Example 5: ETA Update
async function notifyETAChange(busData: any, newETA: number) {
  // Get all parents of students on this bus
  const studentIds = busData.studentIds || [];
  const parentIds = await getParentIdsForStudents(studentIds);
  
  const metadata = {
    busId: busData.id,
    busName: busData.name,
    eta: newETA,
    timestamp: Date.now(),
  };
  
  const notificationPromises = parentIds.map(parentId =>
    createNotification(
      parentId,
      'eta_update',
      'Arrival Time Updated',
      `${busData.name} will arrive in approximately ${newETA} minutes`,
      'low',
      metadata,
      `/dashboard/parent`
    )
  );
  
  await Promise.all(notificationPromises);
}

// Example 6: Bus Delay Alert
async function notifyBusDelay(busData: any, delayMinutes: number) {
  const studentIds = busData.studentIds || [];
  const parentIds = await getParentIdsForStudents(studentIds);
  
  const metadata = {
    busId: busData.id,
    busName: busData.name,
    delayMinutes,
    timestamp: Date.now(),
  };
  
  const notificationPromises = parentIds.map(parentId =>
    createNotification(
      parentId,
      'bus_delay',
      'Bus Delayed',
      `${busData.name} is running ${delayMinutes} minutes late`,
      'medium',
      metadata,
      `/dashboard/parent`
    )
  );
  
  await Promise.all(notificationPromises);
}

// Helper function to get parent IDs
async function getParentIdsForStudents(studentIds: string[]): Promise<string[]> {
  // This is a placeholder - implement based on your database structure
  // Example using Firebase:
  /*
  import { ref, get } from 'firebase/database';
  import { db } from '@/lib/firebase';
  
  const parentIds = new Set<string>();
  
  for (const studentId of studentIds) {
    const studentRef = ref(db, `students/${studentId}`);
    const snapshot = await get(studentRef);
    
    if (snapshot.exists()) {
      const student = snapshot.val();
      if (student.parentId) {
        parentIds.add(student.parentId);
      }
    }
  }
  
  return Array.from(parentIds);
  */
  
  return ['parent-123']; // Placeholder
}

// Integration Example: Update your facial recognition feed
export function IntegrationExample() {
  /*
  // In your facial recognition component:
  
  const handleRecognitionEvent = async (event: RecognitionEvent) => {
    if (event.type === 'boarding') {
      // Student recognized and boarding
      await handleStudentBoarded(event.student, event.bus);
      
      // Also log to attendance
      await logAttendance(event.student.id, event.bus.id, 'boarded');
    }
    else if (event.type === 'exiting') {
      // Student recognized and exiting
      await handleStudentExited(event.student, event.bus);
      
      // Also log to attendance
      await logAttendance(event.student.id, event.bus.id, 'exited');
    }
    else if (event.type === 'unknown') {
      // Unknown face detected
      await handleIntruderDetected(event.bus, event.faceData);
      
      // Log to security logs
      await logSecurityEvent(event.bus.id, 'intruder', event.faceData);
    }
  };
  
  // In your bus tracking component:
  
  const handleETACalculation = async (busId: string, eta: number) => {
    const busData = await getBusData(busId);
    
    // Check if ETA has changed significantly (e.g., more than 5 minutes)
    if (Math.abs(eta - busData.previousETA) > 5) {
      await notifyETAChange(busData, eta);
    }
  };
  
  // In your emergency button handler:
  
  const handleEmergencyButton = async (busId: string, emergencyType: string) => {
    const busData = await getBusData(busId);
    await triggerEmergencyAlert(busData, emergencyType);
    
    // Also trigger other emergency protocols
    await alertAuthorities(busData);
    await recordEmergencyEvent(busId, emergencyType);
  };
  */
}

export {
  handleStudentBoarded,
  handleStudentExited,
  handleIntruderDetected,
  triggerEmergencyAlert,
  notifyETAChange,
  notifyBusDelay,
  getParentIdsForStudents,
};
