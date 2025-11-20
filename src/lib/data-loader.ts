// Dynamic data loader to avoid large bundle sizes
// Use this instead of importing JSON files directly in client components

import { ref, get } from 'firebase/database';
import { db } from './firebase';

/**
 * Load bus data from Firebase
 * Use this instead of: import busData from '@/lib/buses.json'
 */
export async function getBusData(busId?: string) {
  try {
    if (busId) {
      const busRef = ref(db, `buses/${busId}`);
      const snapshot = await get(busRef);
      return snapshot.exists() ? snapshot.val() : null;
    } else {
      const busesRef = ref(db, 'buses');
      const snapshot = await get(busesRef);
      return snapshot.exists() ? snapshot.val() : {};
    }
  } catch (error) {
    console.error('Error loading bus data:', error);
    return busId ? null : {};
  }
}

/**
 * Load student data from Firebase
 * Use this instead of: import studentData from '@/lib/students.json'
 */
export async function getStudentData(studentId?: string) {
  try {
    if (studentId) {
      const studentRef = ref(db, `students/${studentId}`);
      const snapshot = await get(studentRef);
      return snapshot.exists() ? snapshot.val() : null;
    } else {
      const studentsRef = ref(db, 'students');
      const snapshot = await get(studentsRef);
      return snapshot.exists() ? snapshot.val() : {};
    }
  } catch (error) {
    console.error('Error loading student data:', error);
    return studentId ? null : {};
  }
}

/**
 * Load all students for a specific bus
 */
export async function getStudentsByBusId(busId: string) {
  try {
    const studentsRef = ref(db, 'students');
    const snapshot = await get(studentsRef);
    
    if (snapshot.exists()) {
      const allStudents = snapshot.val();
      const studentsArray = Object.values(allStudents);
      return studentsArray.filter((student: any) => student.busId === busId);
    }
    return [];
  } catch (error) {
    console.error('Error loading students for bus:', error);
    return [];
  }
}

/**
 * Get bus capacity info
 */
export async function getBusCapacity(busId: string) {
  try {
    const busData = await getBusData(busId);
    return {
      capacity: busData?.capacity || 0,
      studentsOnBoard: busData?.studentsOnBoard || 0,
      name: busData?.name || `Bus ${busId}`,
    };
  } catch (error) {
    console.error('Error getting bus capacity:', error);
    return { capacity: 0, studentsOnBoard: 0, name: `Bus ${busId}` };
  }
}
