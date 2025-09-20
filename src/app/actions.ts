'use server';

import { 
  generateAttendanceSummary,
  type GenerateAttendanceSummaryInput,
  type GenerateAttendanceSummaryOutput,
} from '@/ai/flows/generate-attendance-summary';
import {
  detectFace,
  type DetectFaceInput,
  type DetectFaceOutput,
} from '@/ai/flows/detect-face';
import {
    generateSafetyScore,
    type GenerateSafetyScoreInput,
    type GenerateSafetyScoreOutput,
} from '@/ai/flows/generate-safety-score';
import { db } from '@/lib/firebase';
import { ref, set, get, remove } from 'firebase/database';
import studentData from '@/lib/students.json';
import busData from '@/lib/buses.json';

export async function generateAttendanceSummaryAction(
  input: GenerateAttendanceSummaryInput
): Promise<GenerateAttendanceSummaryOutput> {
  try {
    const output = await generateAttendanceSummary(input);
    return output;
  } catch (error) {
    console.error('Error generating attendance summary:', error);
    return {
      summary: 'An unexpected error occurred while generating the summary. Please try again later.',
    };
  }
}

export async function detectFaceAction(
    input: DetectFaceInput
  ): Promise<DetectFaceOutput> {
    try {
      const output = await detectFace(input);
      return output;
    } catch (error) {
      console.error('Error detecting face:', error);
      // Return a structured error or an empty faces array
      return { faces: [] };
    }
}

export async function generateSafetyScoreAction(
  input: GenerateSafetyScoreInput
): Promise<GenerateSafetyScoreOutput> {
  try {
    const output = await generateSafetyScore(input);
    return output;
  } catch (error) {
    console.error('Error generating safety score:', error);
    return {
      dailyScore: 0,
      summary: 'An unexpected error occurred while generating the safety score.',
    };
  }
}

export async function seedDatabaseAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const studentsRef = ref(db, 'students');
    await set(studentsRef, studentData);

    const busesRef = ref(db, 'buses');
    await set(busesRef, busData);
    
    return { success: true };
  } catch (error) {
    console.error("Error seeding database:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function reviewFaceRegistrationAction(
  registrationId: string,
  studentId: string,
  studentName: string,
  photoUrls: string[],
  isApproved: boolean
): Promise<{ success: boolean; error?: string }> {
  const pendingRef = ref(db, `pendingFaceRegistrations/${registrationId}`);

  if (isApproved) {
    const approvedRef = ref(db, `registeredFaces/${studentId}`);
    try {
      // Get existing photos if any
      const snapshot = await get(approvedRef);
      const existingData = snapshot.val() || { name: studentName, photos: [] };
      
      // Add new photos to the existing list
      await set(approvedRef, {
        name: studentName,
        photos: [...existingData.photos, ...photoUrls],
      });

      // Remove from pending
      await remove(pendingRef);
      
      return { success: true };
    } catch (error) {
      console.error("Error approving face registration:", error);
      return { success: false, error: (error as Error).message };
    }
  } else {
    // If rejected, just remove from pending
    try {
      await remove(pendingRef);
      return { success: true };
    } catch (error) {
      console.error("Error rejecting face registration:", error);
      return { success: false, error: (error as Error).message };
    }
  }
}