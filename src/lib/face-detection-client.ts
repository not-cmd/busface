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
 * @param returnTensors - Whether to return tensors (set to true for better detection)
 * @param iouThreshold - IoU threshold for face detection (lower = more sensitive)
 * @param scoreThreshold - Score threshold for face detection (lower = more sensitive)
 */
export async function detectFacesClient(
  imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  returnTensors: boolean = true,
  iouThreshold: number = 0.3,
  scoreThreshold: number = 0.5
): Promise<any[]> {
  try {
    const model = await loadFaceDetectionModel();
    
    // Convert to tensor
    const tensor = tf.browser.fromPixels(imageElement);
    
    // Detect faces with more sensitive thresholds
    // returnTensors=true provides better detection
    // Lower scoreThreshold (0.5 instead of 0.75) to catch more faces
    const predictions = await model.estimateFaces(tensor, returnTensors, iouThreshold, scoreThreshold);
    
    console.log(`BlazeFace detected ${predictions.length} faces with scoreThreshold=${scoreThreshold}`);
    
    // Clean up
    tensor.dispose();
    
    return predictions;
  } catch (error) {
    console.error('Error detecting faces (client):', error);
    return [];
  }
}

/**
 * Generate face embedding (client-side version matching server)
 * Always generates a 512-dimensional embedding for consistency
 */
export function generateFaceEmbeddingClient(faceTensor: tf.Tensor3D): Float32Array {
  return tf.tidy(() => {
    // MATCH SERVER: Resize to 256x256 first
    const resized = tf.image.resizeBilinear(faceTensor, [256, 256]);
    
    // Convert to grayscale and normalize
    const grayscale = tf.image.rgbToGrayscale(resized);
    const normalizedGray = tf.div(grayscale, 255.0);
    
    // MATCH SERVER: Enhance contrast
    const enhanced = tf.clipByValue(
      tf.mul(normalizedGray, 1.15), // 15% contrast boost
      0,
      1
    );
    
    // MATCH SERVER: Scale back to 0-255 and tile to 3 channels
    const enhancedScaled = tf.mul(enhanced, 255);
    const grayscale3Channel = tf.tile(enhancedScaled, [1, 1, 3]) as tf.Tensor3D;
    
    // Generate multiple scales for better features - MATCH SERVER-SIDE EXACTLY
    const scales = [1.0, 0.85, 0.7, 0.5];
    const featureMaps = scales.map(scale => {
      const scaled = tf.image.resizeBilinear(
        grayscale3Channel,
        [Math.round(224 * scale), Math.round(224 * scale)]
      );
      
      // Extract features using moments and histogram - MATCH SERVER
      const moments = tf.moments(scaled, [0, 1]);
      const mean = moments.mean;
      const variance = moments.variance;
      
      // Create histogram-like features - MATCH SERVER
      const bins = 32;
      const minVal = tf.min(scaled);
      const maxVal = tf.max(scaled);
      const range = maxVal.sub(minVal);
      const step = range.div(tf.scalar(bins));
      
      // Generate histogram features using tf.stack
      const histogramBins = [];
      for (let i = 0; i < bins; i++) {
        const binStart = minVal.add(step.mul(tf.scalar(i)));
        const binEnd = binStart.add(step);
        const mask = tf.logicalAnd(
          tf.greaterEqual(scaled, binStart),
          tf.less(scaled, binEnd)
        );
        const count = tf.sum(tf.cast(mask, 'float32'));
        histogramBins.push(count);
      }
      const histogram = tf.stack(histogramBins);
      
      return tf.concat([mean, variance, histogram]);
    });
    
    // Combine all features
    const combined = tf.concat(featureMaps);
    
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
    
    const result = normalizedFeatures.dataSync() as Float32Array;
    
    // Debug: Log normalization info
    console.log('🔧 Client-side embedding generation:', {
      beforeNorm_mean: featuresMean.dataSync()[0].toFixed(4),
      beforeNorm_std: featuresStd.dataSync()[0].toFixed(4),
      afterNorm_mean: (Array.from(result).reduce((a, b) => a + b, 0) / result.length).toFixed(4),
      afterNorm_std: Math.sqrt(Array.from(result).reduce((sum, v) => {
        const mean = Array.from(result).reduce((a, b) => a + b, 0) / result.length;
        return sum + Math.pow(v - mean, 2);
      }, 0) / result.length).toFixed(4)
    });
    
    return result;
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
  
  // CRITICAL: Set canvas dimensions BEFORE getting context
  faceCanvas.width = 160;
  faceCanvas.height = 160;
  
  const ctx = faceCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) throw new Error('Failed to get canvas context');
  
  // Validate bounding box
  if (!boundingBox || 
      typeof boundingBox.x !== 'number' || 
      typeof boundingBox.y !== 'number' || 
      typeof boundingBox.width !== 'number' || 
      typeof boundingBox.height !== 'number' ||
      !isFinite(boundingBox.x) || 
      !isFinite(boundingBox.y) || 
      !isFinite(boundingBox.width) || 
      !isFinite(boundingBox.height) ||
      boundingBox.width <= 0 || 
      boundingBox.height <= 0) {
    console.error('❌ Invalid bounding box:', boundingBox);
    // Return a blank canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 160, 160);
    return faceCanvas;
  }
  
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
  
  // Ensure all values are valid finite numbers
  if (!isFinite(paddedX) || !isFinite(paddedY) || !isFinite(paddedWidth) || !isFinite(paddedHeight) ||
      paddedWidth <= 0 || paddedHeight <= 0) {
    console.error('❌ Invalid padded region:', { paddedX, paddedY, paddedWidth, paddedHeight });
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 160, 160);
    return faceCanvas;
  }
  
  // Debug: Log what we're trying to extract
  console.log('🔍 extractFaceCrop params:', {
    sourceCanvas: `${canvas.width}x${canvas.height}`,
    boundingBox,
    paddedRegion: { paddedX, paddedY, paddedWidth, paddedHeight },
    targetSize: '160x160'
  });
  
  // Check if source canvas has data
  const sourceCtx = canvas.getContext('2d');
  if (sourceCtx) {
    try {
      // Ensure we have valid integer coordinates for getImageData
      const sampleX = Math.max(0, Math.floor(paddedX));
      const sampleY = Math.max(0, Math.floor(paddedY));
      const sampleWidth = Math.max(1, Math.min(10, Math.floor(paddedWidth)));
      const sampleHeight = Math.max(1, Math.min(10, Math.floor(paddedHeight)));
      
      if (sampleX + sampleWidth <= canvas.width && sampleY + sampleHeight <= canvas.height) {
        const sourceData = sourceCtx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);
        const sourceAvg = Array.from(sourceData.data).reduce((a, b) => a + b, 0) / sourceData.data.length;
        console.log('🎨 Source canvas sample at crop location:', sourceAvg.toFixed(2));
      } else {
        console.warn('⚠️ Sample region out of canvas bounds');
      }
    } catch (e) {
      console.error('❌ Failed to read source canvas data:', e);
    }
  }
  
  // Draw with explicit integer coordinates, ensuring they're within bounds
  try {
    const srcX = Math.max(0, Math.min(canvas.width - 1, Math.floor(paddedX)));
    const srcY = Math.max(0, Math.min(canvas.height - 1, Math.floor(paddedY)));
    const srcW = Math.max(1, Math.min(canvas.width - srcX, Math.floor(paddedWidth)));
    const srcH = Math.max(1, Math.min(canvas.height - srcY, Math.floor(paddedHeight)));
    
    console.log('📐 Final draw coords:', { srcX, srcY, srcW, srcH });
    
    ctx.drawImage(
      canvas,
      srcX,
      srcY,
      srcW,
      srcH,
      0,
      0,
      160,
      160
    );
    
    // Verify the draw worked
    const verifyData = ctx.getImageData(0, 0, 10, 10);
    const verifyAvg = Array.from(verifyData.data).reduce((a, b) => a + b, 0) / verifyData.data.length;
    console.log('✅ Face crop result pixel average:', verifyAvg.toFixed(2));
  } catch (e) {
    console.error('❌ Failed to draw image to face canvas:', e);
  }
  
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
  
  // AGGRESSIVE THRESHOLDS: Very forgiving for testing and debugging
  // Will match even with lower similarity to help identify issues
  // TEMPORARILY LOWERED: Stored embeddings may be from old code (std=0.5449 vs current 1.0)
  const HIGH_CONFIDENCE = 0.40;  // Was 0.45 - lowered to account for embedding mismatch
  const MEDIUM_CONFIDENCE = 0.30; // Was 0.35
  const MIN_THRESHOLD = 0.20;     // Was 0.25
  
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
  
  // Debug logging with detailed analysis
  console.group('🔍 Face Matching Analysis');
  console.log('📊 All similarity scores (sorted):', allSimilarities.sort((a, b) => b.similarity - a.similarity));
  console.log('🎯 Best match:', bestMatch ? `${bestMatch.studentName} (${(bestMatch.confidence * 100).toFixed(1)}%)` : 'None');
  console.log('📈 Highest similarity score:', bestSimilarity.toFixed(4));
  console.log('🎚️ Thresholds: HIGH=' + HIGH_CONFIDENCE + ', MEDIUM=' + MEDIUM_CONFIDENCE + ', MIN=' + MIN_THRESHOLD);
  
  // Check if embeddings are too different (might indicate different generation methods)
  if (allSimilarities.length > 0) {
    const avgSimilarity = allSimilarities.reduce((sum, s) => sum + s.similarity, 0) / allSimilarities.length;
    console.log('📉 Average similarity across all students:', avgSimilarity.toFixed(4));
    
    if (avgSimilarity < 0.1) {
      console.warn('⚠️ Very low average similarity! Embeddings might be incompatible.');
      console.warn('💡 This suggests client-side and server-side embedding generation are producing different results.');
    }
  }
  console.groupEnd();
  
  // Return best match even with very low threshold for debugging
  if (bestMatch && bestSimilarity >= MIN_THRESHOLD) {
    if (!bestMatch.isHighConfidence && !bestMatch.isPotentialMatch) {
      console.log(`🔶 Low confidence match: ${bestMatch.studentName} at ${(bestSimilarity * 100).toFixed(1)}%`);
      bestMatch.isPotentialMatch = true; // Mark as potential for review
    }
    return bestMatch;
  }
  
  console.log('❌ No matches found above minimum threshold of ' + MIN_THRESHOLD);
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
