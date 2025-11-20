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
  getFaceEmbeddings,
} from '@/ai/flows/detect-face';
import {
    generateSafetyScore,
    type GenerateSafetyScoreInput,
    type GenerateSafetyScoreOutput,
} from '@/ai/flows/generate-safety-score';
import { imageDataUriToTensor, generateStableId } from '@/ai/flows/face-utils';
import { loadModel } from '@/ai/flows/face-detector';
import * as tf from '@tensorflow/tfjs';
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
      // Fetch stored embeddings for faster matching
      const embeddingsResult = await getStoredFaceEmbeddingsAction();
      const storedEmbeddings = embeddingsResult.success ? embeddingsResult.embeddings : [];
      
      // Add stored embeddings to input for optimized matching
      const optimizedInput = {
        ...input,
        storedEmbeddings: storedEmbeddings || []
      };
      
      const output = await detectFace(optimizedInput);
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
    try {
      // Get the pending registration data to access embeddings
      const pendingSnapshot = await get(pendingRef);
      const pendingData = pendingSnapshot.val();
      
      // Store approved photos
      const approvedRef = ref(db, `registeredFaces/${studentId}`);
      const snapshot = await get(approvedRef);
      const existingData = snapshot.val() || { name: studentName, photos: [] };
      
      await set(approvedRef, {
        name: studentName,
        photos: [...existingData.photos, ...photoUrls],
      });

      // If embeddings exist in pending data, store them for fast matching
      if (pendingData?.embeddings && pendingData.embeddings.length > 0) {
        // Store the best embedding (highest quality/confidence)
        const bestEmbedding = pendingData.embeddings[0]; // Use first embedding for now
        
        const embeddingRef = ref(db, `faceEmbeddings/${studentId}`);
        await set(embeddingRef, {
          studentId,
          studentName,
          embedding: bestEmbedding.embedding,
          uid: bestEmbedding.uid,
          photoDataUri: bestEmbedding.photoDataUri,
          timestamp: new Date().toISOString(),
          approved: true
        });
      }

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

// New action to generate and store face embeddings
export async function generateFaceEmbeddingAction(
  photoDataUri: string,
  studentId: string,
  studentName: string
): Promise<{ success: boolean; embedding?: number[]; uid?: string; error?: string }> {
  let imageTensor: tf.Tensor3D | null = null;
  let faceTensor: tf.Tensor3D | null = null;
  let faceEmbedding: tf.Tensor2D | null = null;

  try {
    // Load the image and convert to tensor
    imageTensor = await imageDataUriToTensor(photoDataUri);
    if (!imageTensor) {
      return { success: false, error: 'Failed to load image' };
    }

    // Load model and detect faces
    const model = await loadModel();
    const results = await model.estimateFaces(imageTensor, false);
    
    if (!results || results.length === 0) {
      return { success: false, error: 'No face detected in image' };
    }

    // Get the largest face (most likely to be the main subject)
    const face = results[0];
    const topLeft = face.topLeft as [number, number];
    const bottomRight = face.bottomRight as [number, number];
    
    const box = {
      xMin: topLeft[0],
      yMin: topLeft[1],
      width: bottomRight[0] - topLeft[0],
      height: bottomRight[1] - topLeft[1]
    };

    // Create face crop
    faceTensor = tf.tidy(() => {
      const tensor4D = tf.cast(imageTensor!.expandDims(), 'float32') as tf.Tensor4D;
      const normalized = tf.image.cropAndResize(
        tensor4D,
        [[
          box.yMin / imageTensor!.shape[0],
          box.xMin / imageTensor!.shape[1],
          (box.yMin + box.height) / imageTensor!.shape[0],
          (box.xMin + box.width) / imageTensor!.shape[1]
        ]],
        [0],
        [224, 224]
      );
      return tf.squeeze(normalized) as tf.Tensor3D;
    });

    // Generate face embeddings
    faceEmbedding = await getFaceEmbeddings(faceTensor);
    if (!faceEmbedding) {
      return { success: false, error: 'Failed to generate face embeddings' };
    }

    // Convert embedding to array for storage
    const embeddingArray = Array.from(faceEmbedding.dataSync());
    
    // Validate embedding array - check for NaN values and size
    if (embeddingArray.some(val => isNaN(val) || !isFinite(val))) {
      console.error(`Invalid embedding values for ${studentName}`);
      return { success: false, error: 'Generated embedding contains invalid values' };
    }
    
    if (embeddingArray.length !== 512) {
      console.error(`Invalid embedding size for ${studentName}: ${embeddingArray.length} (expected 512)`);
      return { success: false, error: `Invalid embedding size: ${embeddingArray.length}` };
    }
    
    // Check if embedding has meaningful values (not all zeros)
    const nonZeroCount = embeddingArray.filter(v => Math.abs(v) > 0.01).length;
    const embeddingMean = embeddingArray.reduce((a, b) => a + b, 0) / embeddingArray.length;
    
    console.log(`Generated embedding for ${studentName}:`, {
      length: embeddingArray.length,
      nonZeroValues: nonZeroCount,
      mean: embeddingMean.toFixed(4),
      min: Math.min(...embeddingArray).toFixed(4),
      max: Math.max(...embeddingArray).toFixed(4)
    });
    
    if (nonZeroCount < 100) {
      console.warn(`Embedding for ${studentName} has very few non-zero values (${nonZeroCount})`);
    }
    
    const uid = generateStableId(faceEmbedding);

    // Store in database
    const embeddingRef = ref(db, `faceEmbeddings/${studentId}`);
    await set(embeddingRef, {
      studentId,
      studentName,
      embedding: embeddingArray,
      uid,
      photoDataUri,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✓ Successfully stored embedding for ${studentName} in faceEmbeddings/${studentId}`);

    return { 
      success: true, 
      embedding: embeddingArray, 
      uid 
    };

  } catch (error) {
    console.error('Error generating face embedding:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  } finally {
    // Clean up tensors
    imageTensor?.dispose();
    faceTensor?.dispose();
    faceEmbedding?.dispose();
  }
}

// Action to fetch stored face embeddings for matching
export async function getStoredFaceEmbeddingsAction(): Promise<{
  success: boolean;
  embeddings?: { studentId: string; studentName: string; embedding: number[]; uid: string }[];
  error?: string;
}> {
  try {
    const embeddingsRef = ref(db, 'faceEmbeddings');
    const snapshot = await get(embeddingsRef);
    
    if (!snapshot.exists()) {
      return { success: true, embeddings: [] };
    }

    const data = snapshot.val();
    const embeddings = Object.entries(data).map(([studentId, info]: [string, any]) => ({
      studentId,
      studentName: info.studentName,
      embedding: info.embedding,
      uid: info.uid
    }));

    return { success: true, embeddings };
  } catch (error) {
    console.error('Error fetching face embeddings:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}