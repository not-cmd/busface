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
 */
export function generateFaceEmbeddingClient(faceTensor: tf.Tensor3D): Float32Array {
  return tf.tidy(() => {
    // Resize to standard size
    const resized = tf.image.resizeBilinear(faceTensor, [160, 160]);
    
    // Convert to grayscale
    const grayscale = tf.image.rgbToGrayscale(resized);
    const normalized = tf.div(grayscale, 255.0);
    
    // Generate features using moments and simple statistics
    const moments = tf.moments(normalized, [0, 1]);
    const mean = moments.mean;
    const variance = moments.variance;
    
    // Create histogram features
    const flattened = normalized.flatten();
    const bins = 64;
    const histogram = tf.zeros([bins]);
    
    // Simple feature extraction
    const features = tf.concat([
      mean.flatten(),
      variance.flatten(),
      flattened.slice([0], [Math.min(128, flattened.shape[0])])
    ]);
    
    // Normalize features
    const featuresMean = tf.mean(features);
    const featuresStd = tf.sqrt(tf.mean(tf.square(tf.sub(features, featuresMean))));
    const normalizedFeatures = tf.div(tf.sub(features, featuresMean), tf.add(featuresStd, 1e-8));
    
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
  if (storedEmbeddings.length === 0) return null;
  
  const HIGH_CONFIDENCE = 0.78;
  const MEDIUM_CONFIDENCE = 0.68;
  
  let bestMatch: FaceMatch | null = null;
  let bestSimilarity = 0;
  
  for (const stored of storedEmbeddings) {
    const storedArray = new Float32Array(stored.embedding);
    const similarity = calculateSimilarity(faceEmbedding, storedArray);
    
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
  
  return bestMatch;
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
