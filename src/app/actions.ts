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

      // If embeddings exist in pending data, store ALL of them for multi-angle matching
      if (pendingData?.embeddings && pendingData.embeddings.length > 0) {
        console.log(`📐 Storing ${pendingData.embeddings.length} embeddings for ${studentName} (multi-angle recognition)`);
        
        const embeddingRef = ref(db, `faceEmbeddings/${studentId}`);
        await set(embeddingRef, {
          studentId,
          studentName,
          embeddings: pendingData.embeddings.map((emb: any, index: number) => ({
            embedding: emb.embedding,
            uid: emb.uid,
            photoDataUri: emb.photoDataUri,
            angle: index, // 0=front, 1=right, 2=left, 3=up, 4=down
            timestamp: new Date().toISOString()
          })),
          primaryEmbedding: pendingData.embeddings[0].embedding, // Keep front-facing as primary for backward compatibility
          embeddingCount: pendingData.embeddings.length,
          timestamp: new Date().toISOString(),
          approved: true
        });
        
        console.log(`✅ Stored ${pendingData.embeddings.length} multi-angle embeddings for ${studentName}`);
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
    console.log(`🔄 [${studentName}] Starting embedding generation...`);
    
    // Load the image and convert to tensor
    imageTensor = await imageDataUriToTensor(photoDataUri);
    if (!imageTensor) {
      console.error(`❌ [${studentName}] Failed to load image`);
      return { success: false, error: 'Failed to load image' };
    }
    console.log(`✓ [${studentName}] Image tensor loaded: ${imageTensor.shape}`);

    // Load model and detect faces
    console.log(`🔄 [${studentName}] Loading BlazeFace model...`);
    const model = await loadModel();
    console.log(`✓ [${studentName}] Model loaded, detecting faces...`);
    
    const results = await model.estimateFaces(imageTensor, false);
    console.log(`✓ [${studentName}] Face detection complete: ${results?.length || 0} faces found`);
    
    if (!results || results.length === 0) {
      console.error(`❌ [${studentName}] No face detected in image`);
      return { success: false, error: 'No face detected in image' };
    }

    // Get the largest face (most likely to be the main subject)
    const face = results[0];
    console.log(`🔄 [${studentName}] Extracting bounding box...`);
    
    // Extract coordinates from tensors properly
    const topLeftArray = face.topLeft instanceof tf.Tensor 
      ? Array.from(await face.topLeft.data()) 
      : face.topLeft as number[];
    const bottomRightArray = face.bottomRight instanceof tf.Tensor
      ? Array.from(await face.bottomRight.data())
      : face.bottomRight as number[];
    
    const box = {
      xMin: topLeftArray[0],
      yMin: topLeftArray[1],
      width: bottomRightArray[0] - topLeftArray[0],
      height: bottomRightArray[1] - topLeftArray[1]
    };
    
    console.log(`✓ [${studentName}] Bounding box: x=${box.xMin.toFixed(1)}, y=${box.yMin.toFixed(1)}, w=${box.width.toFixed(1)}, h=${box.height.toFixed(1)}`);

    // Create face crop
    console.log(`🔄 [${studentName}] Cropping face region...`);
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
    console.log(`✓ [${studentName}] Face crop created: ${faceTensor.shape}`);

    // Generate face embeddings
    console.log(`🔄 [${studentName}] Generating face embeddings...`);
    faceEmbedding = await getFaceEmbeddings(faceTensor);
    if (!faceEmbedding) {
      console.error(`❌ [${studentName}] Failed to generate face embeddings`);
      return { success: false, error: 'Failed to generate face embeddings' };
    }
    console.log(`✓ [${studentName}] Face embedding generated: ${faceEmbedding.shape}`);

    // Convert embedding to array for storage
    const embeddingArray = Array.from(faceEmbedding.dataSync());
    console.log(`✓ [${studentName}] Embedding array created: ${embeddingArray.length} values`);
    
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

    // Don't store to faceEmbeddings here - it will be stored after admin approval
    // This prevents unapproved faces from being used for matching
    console.log(`✓ Successfully generated embedding for ${studentName} (will be stored after approval)`);

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
  embeddings?: { 
    studentId: string; 
    studentName: string; 
    embedding: number[]; 
    uid: string;
    allEmbeddings?: { embedding: number[]; uid: string; angle: number }[]; // Multi-angle support
  }[];
  error?: string;
}> {
  try {
    const embeddingsRef = ref(db, 'faceEmbeddings');
    const snapshot = await get(embeddingsRef);
    
    if (!snapshot.exists()) {
      return { success: true, embeddings: [] };
    }

    const data = snapshot.val();
    const embeddings = Object.entries(data).map(([studentId, info]: [string, any]) => {
      // Support both old format (single embedding) and new format (multiple embeddings)
      if (info.embeddings && Array.isArray(info.embeddings)) {
        // New multi-angle format
        return {
          studentId,
          studentName: info.studentName,
          embedding: info.primaryEmbedding || info.embeddings[0].embedding, // Use primary or first
          uid: info.embeddings[0].uid,
          allEmbeddings: info.embeddings.map((emb: any) => ({
            embedding: emb.embedding,
            uid: emb.uid,
            angle: emb.angle || 0
          }))
        };
      } else {
        // Old single-embedding format (backward compatibility)
        return {
          studentId,
          studentName: info.studentName,
          embedding: info.embedding,
          uid: info.uid,
          allEmbeddings: undefined
        };
      }
    });

    console.log(`📐 Loaded embeddings for ${embeddings.length} students (${embeddings.filter(e => e.allEmbeddings).length} with multi-angle)`);

    return { success: true, embeddings };
  } catch (error) {
    console.error('Error fetching face embeddings:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ADAPTIVE LEARNING: Update embeddings based on recognition history
export async function improveEmbeddingsFromHistoryAction(
  studentId: string,
  minConfidence: number = 0.40,
  minSamples: number = 5
): Promise<{ success: boolean; updatedEmbeddings?: number; error?: string }> {
  try {
    console.log(`🧠 Starting adaptive learning for student ${studentId}...`);
    
    // Get recognition history
    const historyRef = ref(db, `recognitionHistory/${studentId}`);
    const historySnapshot = await get(historyRef);
    
    if (!historySnapshot.exists()) {
      return { success: false, error: 'No recognition history found' };
    }
    
    const historyData = historySnapshot.val();
    const recognitions = Object.values(historyData) as Array<{
      embedding: number[];
      confidence: number;
      timestamp: string;
    }>;
    
    // Filter high-confidence recognitions
    const highConfidenceRecognitions = recognitions.filter(r => r.confidence >= minConfidence);
    
    if (highConfidenceRecognitions.length < minSamples) {
      return { 
        success: false, 
        error: `Not enough high-confidence samples (${highConfidenceRecognitions.length}/${minSamples})` 
      };
    }
    
    console.log(`✓ Found ${highConfidenceRecognitions.length} high-confidence recognitions`);
    
    // Get current stored embeddings
    const embeddingRef = ref(db, `faceEmbeddings/${studentId}`);
    const embeddingSnapshot = await get(embeddingRef);
    
    if (!embeddingSnapshot.exists()) {
      return { success: false, error: 'No stored embeddings found' };
    }
    
    const currentData = embeddingSnapshot.val();
    
    // Calculate averaged embedding from recognition history
    const embeddingLength = highConfidenceRecognitions[0].embedding.length;
    const avgEmbedding = new Array(embeddingLength).fill(0);
    
    for (const recognition of highConfidenceRecognitions) {
      for (let i = 0; i < embeddingLength; i++) {
        avgEmbedding[i] += recognition.embedding[i];
      }
    }
    
    for (let i = 0; i < embeddingLength; i++) {
      avgEmbedding[i] /= highConfidenceRecognitions.length;
    }
    
    // Normalize the averaged embedding
    const magnitude = Math.sqrt(avgEmbedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedAvg = avgEmbedding.map(val => val / magnitude);
    
    console.log(`✓ Computed averaged embedding from ${highConfidenceRecognitions.length} samples`);
    
    // Add the averaged embedding as a new angle (real-world composite)
    const newAngle = {
      embedding: normalizedAvg,
      uid: `learned-${Date.now()}`,
      angle: 99, // Special angle for learned embeddings
      timestamp: new Date().toISOString(),
      source: 'adaptive-learning',
      sampleCount: highConfidenceRecognitions.length
    };
    
    // Update stored embeddings with the new learned embedding
    const updatedEmbeddings = [...(currentData.embeddings || []), newAngle];
    
    await set(embeddingRef, {
      ...currentData,
      embeddings: updatedEmbeddings,
      embeddingCount: updatedEmbeddings.length,
      lastLearningUpdate: new Date().toISOString(),
      totalRecognitions: recognitions.length,
      learningSamples: highConfidenceRecognitions.length
    });
    
    console.log(`✅ Added learned embedding for student ${studentId} (${updatedEmbeddings.length} total embeddings)`);
    
    return { 
      success: true, 
      updatedEmbeddings: updatedEmbeddings.length 
    };
    
  } catch (error) {
    console.error('Error improving embeddings from history:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}