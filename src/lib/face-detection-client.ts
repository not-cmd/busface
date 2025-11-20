/**
 * Client-side face detection utility
 * Runs face detection in the browser to avoid server payload limits
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

let blazefaceModel: any = null;

/**
 * Load the BlazeFace model (client-side)
 */
export async function loadFaceDetectionModel() {
  if (blazefaceModel) return blazefaceModel;
  
  try {
    // Ensure TensorFlow.js is ready
    await tf.ready();
    
    // Dynamically import BlazeFace to avoid SSR issues
    const blazeface = await import('@tensorflow-models/blazeface');
    blazefaceModel = await blazeface.load();
    
    console.log('BlazeFace model loaded successfully (client-side)');
    return blazefaceModel;
  } catch (error) {
    console.error('Error loading BlazeFace model:', error);
    throw error;
  }
}

/**
 * Detect faces in an image (client-side)
 */
export async function detectFacesClient(
  imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<any[]> {
  try {
    const model = await loadFaceDetectionModel();
    
    // Convert to tensor
    const tensor = tf.browser.fromPixels(imageElement);
    
    // Detect faces
    const predictions = await model.estimateFaces(tensor, false);
    
    // Clean up
    tensor.dispose();
    
    return predictions;
  } catch (error) {
    console.error('Error detecting faces (client):', error);
    return [];
  }
}

/**
 * Generate face embedding (simplified client-side version)
 * Always generates a 512-dimensional embedding for consistency
 */
export function generateFaceEmbeddingClient(faceTensor: tf.Tensor3D): Float32Array {
  return tf.tidy(() => {
    // Resize to standard size
    const resized = tf.image.resizeBilinear(faceTensor, [224, 224]);
    
    // Convert to grayscale and normalize
    const grayscale = tf.image.rgbToGrayscale(resized);
    const normalized = tf.div(grayscale, 255.0);
    
    // Generate multiple scales for better features
    const scales = [1.0, 0.85, 0.7, 0.5];
    const allFeatures: tf.Tensor1D[] = [];
    
    for (const scale of scales) {
      const scaledSize = Math.round(224 * scale);
      const scaled = tf.image.resizeBilinear(normalized as tf.Tensor3D, [scaledSize, scaledSize]);
      
      // Extract moments
      const moments = tf.moments(scaled, [0, 1]);
      allFeatures.push(moments.mean.flatten() as tf.Tensor1D);
      allFeatures.push(moments.variance.flatten() as tf.Tensor1D);
      
      // Extract patches
      const flattened = scaled.flatten();
      const patchSize = Math.min(30, flattened.shape[0]);
      allFeatures.push(flattened.slice([0], [patchSize]) as tf.Tensor1D);
    }
    
    // Concatenate all features
    const combined = tf.concat(allFeatures) as tf.Tensor1D;
    
    // Ensure exactly 512 dimensions - MATCH SERVER-SIDE LOGIC
    const targetSize = 512;
    let finalFeatures: tf.Tensor1D;
    
    if (combined.shape[0] > targetSize) {
      // If we have more features, truncate to 512
      finalFeatures = combined.slice([0], [targetSize]) as tf.Tensor1D;
    } else if (combined.shape[0] < targetSize) {
      // If we have fewer features, replicate and pad intelligently
      // This prevents having large blocks of zeros
      const repetitions = Math.floor(targetSize / combined.shape[0]);
      const remainder = targetSize % combined.shape[0];
      
      const repeated = [];
      for (let i = 0; i < repetitions; i++) {
        repeated.push(combined);
      }
      if (remainder > 0) {
        repeated.push(combined.slice([0], [remainder]));
      }
      
      finalFeatures = tf.concat(repeated) as tf.Tensor1D;
    } else {
      finalFeatures = combined as tf.Tensor1D;
    }
    
    // Normalize features AFTER ensuring correct size
    const featuresMean = tf.mean(finalFeatures);
    const featureVariance = tf.moments(finalFeatures).variance;
    const featuresStd = tf.sqrt(tf.add(featureVariance, 1e-8));
    
    const normalizedFeatures = tf.div(
      tf.sub(finalFeatures, featuresMean), 
      featuresStd
    ) as tf.Tensor1D;
    
    return normalizedFeatures.dataSync() as Float32Array;
  });
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function calculateSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
  if (embedding1.length !== embedding2.length) {
    console.error('Embeddings must have the same length');
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/**
 * Extract face crop from canvas
 */
export function extractFaceCrop(
  canvas: HTMLCanvasElement,
  boundingBox: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const faceCanvas = document.createElement('canvas');
  const ctx = faceCanvas.getContext('2d');
  
  if (!ctx) throw new Error('Failed to get canvas context');
  
  // Add padding around face
  const padding = 0.2;
  const paddedX = Math.max(0, boundingBox.x - boundingBox.width * padding);
  const paddedY = Math.max(0, boundingBox.y - boundingBox.height * padding);
  const paddedWidth = Math.min(
    canvas.width - paddedX,
    boundingBox.width * (1 + 2 * padding)
  );
  const paddedHeight = Math.min(
    canvas.height - paddedY,
    boundingBox.height * (1 + 2 * padding)
  );
  
  faceCanvas.width = 160;
  faceCanvas.height = 160;
  
  ctx.drawImage(
    canvas,
    paddedX,
    paddedY,
    paddedWidth,
    paddedHeight,
    0,
    0,
    160,
    160
  );
  
  return faceCanvas;
}

/**
 * Match detected face against stored embeddings
 */
export interface StoredFaceEmbedding {
  studentId: string;
  studentName: string;
  embedding: number[];
}

export interface FaceMatch {
  studentId: string;
  studentName: string;
  confidence: number;
  isHighConfidence: boolean;
  isPotentialMatch: boolean;
}

export function matchFace(
  faceEmbedding: Float32Array,
  storedEmbeddings: StoredFaceEmbedding[]
): FaceMatch | null {
  if (storedEmbeddings.length === 0) {
    console.log('No stored embeddings available for matching');
    return null;
  }
  
  // LOWERED THRESHOLDS: More forgiving recognition for improved user experience
  // The embedding generation was improved to create better features, but thresholds need adjustment
  const HIGH_CONFIDENCE = 0.65;  // Lowered from 0.78
  const MEDIUM_CONFIDENCE = 0.55; // Lowered from 0.68
  
  let bestMatch: FaceMatch | null = null;
  let bestSimilarity = 0;
  const allSimilarities: Array<{ name: string; similarity: number }> = [];
  
  console.log(`Matching against ${storedEmbeddings.length} stored embeddings`);
  console.log(`Face embedding length: ${faceEmbedding.length}`);
  
  for (const stored of storedEmbeddings) {
    const storedArray = new Float32Array(stored.embedding);
    
    // Validate stored embedding
    if (storedArray.length !== faceEmbedding.length) {
      console.warn(`Embedding size mismatch for ${stored.studentName}: ${storedArray.length} vs ${faceEmbedding.length}`);
      continue;
    }
    
    const similarity = calculateSimilarity(faceEmbedding, storedArray);
    allSimilarities.push({ name: stored.studentName, similarity });
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = {
        studentId: stored.studentId,
        studentName: stored.studentName,
        confidence: similarity,
        isHighConfidence: similarity >= HIGH_CONFIDENCE,
        isPotentialMatch: similarity >= MEDIUM_CONFIDENCE && similarity < HIGH_CONFIDENCE,
      };
    }
  }
  
  // Debug logging
  console.log('All similarity scores:', allSimilarities.sort((a, b) => b.similarity - a.similarity));
  console.log('Best match:', bestMatch ? `${bestMatch.studentName} (${(bestMatch.confidence * 100).toFixed(1)}%)` : 'None');
  
  // Return best match even if below medium confidence for debugging
  if (bestMatch && bestSimilarity >= 0.45) { // Very low threshold for potential matches
    if (!bestMatch.isHighConfidence && !bestMatch.isPotentialMatch) {
      console.log(`Low confidence match: ${bestMatch.studentName} at ${(bestSimilarity * 100).toFixed(1)}%`);
      bestMatch.isPotentialMatch = true; // Mark as potential for review
    }
    return bestMatch;
  }
  
  return null;
}

/**
 * Generate stable ID for a face
 */
export function generateStableFaceId(embedding: Float32Array): string {
  // Use first few values of embedding to create a stable ID
  const sample = Array.from(embedding.slice(0, 8))
    .map(v => Math.round(v * 1000))
    .join('-');
  
  return `face-${sample}`;
}
