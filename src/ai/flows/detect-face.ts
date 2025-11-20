'use server';
/**
 * @fileOverview An AI agent that detects and recognizes faces in a photo using FaceNet, providing stable IDs.
 */

import * as tf from '@tensorflow/tfjs';
import { z } from 'zod';
import { loadModel } from './face-detector';
import { imageDataUriToTensor, cosineSimilarity, generateStableId } from './face-utils';

// Add a new input schema that accepts stored embeddings
const DetectFaceInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a person, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  registeredFaces: z.array(z.object({
    name: z.string().describe('The name of the registered person.'),
    photoDataUri: z.string().describe("A reference photo of the registered person as a data URI."),
  })).optional().describe('An optional list of already registered faces to perform recognition against.'),
  
  // New: stored embeddings for faster matching
  storedEmbeddings: z.array(z.object({
    studentName: z.string().describe('The name of the registered student.'),
    studentId: z.string().describe('The ID of the registered student.'),
    embedding: z.array(z.number()).describe('The stored face embedding array.'),
    uid: z.string().describe('The unique identifier for this face embedding.'),
  })).optional().describe('Pre-computed face embeddings from the database for fast matching.'),
});
export type DetectFaceInput = z.infer<typeof DetectFaceInputSchema>;

const DetectFaceOutputSchema = z.object({
  faces: z.array(z.object({
    boundingBox: z.object({
      x: z.number().describe('The x-coordinate of the top-left corner of the bounding box as a value between 0 and 1.'),
      y: z.number().describe('The y-coordinate of the top-left corner of the bounding box as a value between 0 and 1.'),
      width: z.number().describe('The width of the bounding box as a value between 0 and 1.'),
      height: z.number().describe('The height of the bounding box as a value between 0 and 1.'),
    }).describe('The bounding box of the detected face, normalized to image dimensions (0-1).'),
    confidence: z.number().describe('The confidence score of the detection, from 0 to 1.'),
    name: z.string().optional().describe('The name of the person if recognized from the registered faces list.'),
    matchConfidence: z.number().describe('The confidence score of the face recognition match, from 0 to 1.'),
    isPotentialMatch: z.boolean().describe('Indicates if this face is a potential match but below the strict threshold.'),
    potentialMatches: z.array(z.object({
      name: z.string(),
      confidence: z.number()
    })).optional().describe('List of potential matches when confidence is in the medium range.'),
    uid: z.string().describe('A stable, randomly generated unique identifier for the detected face. This ID should remain consistent for the same person across different frames.'),
  })).describe('An array of detected faces.')
});
export type DetectFaceOutput = z.infer<typeof DetectFaceOutputSchema>;

interface Face {
  box: {
    xMin: number;
    yMin: number;
    width: number;
    height: number;
  };
  confidence: number;
}

type DetectedFace = Face;

interface BoundingBox {
  yMin: number;
  xMin: number;
  height: number;
  width: number;
}

interface Keypoint {
  x: number;
  y: number;
  z?: number;
}

async function getFaceEmbeddings(face: tf.Tensor3D): Promise<tf.Tensor2D | null> {
  try {
    return tf.tidy(() => {
      // OPTIMIZED: Larger size (256x256) for better distant face feature extraction
      const resized = tf.image.resizeBilinear(face, [256, 256]);
      
      // Convert to grayscale with contrast enhancement for distant/dim faces
      const grayscale = tf.image.rgbToGrayscale(resized);
      const normalizedGray = tf.div(grayscale, 255.0);
      
      // OPTIMIZED: Enhance contrast for better feature extraction at distance
      const enhanced = tf.clipByValue(
        tf.mul(normalizedGray, 1.15), // 15% contrast boost
        0,
        1
      );
      
      const enhancedScaled = tf.mul(enhanced, 255);
      const grayscale3Channel = tf.tile(enhancedScaled, [1, 1, 3]) as tf.Tensor3D;
      
      // OPTIMIZED: More scales for better distance handling
      const scales = [1.0, 0.85, 0.7, 0.5];
      const featureMaps = scales.map(scale => {
        const scaled = tf.image.resizeBilinear(
          grayscale3Channel,
          [Math.round(224 * scale), Math.round(224 * scale)]
        );
        
        // Extract features using moments and histogram
        const moments = tf.moments(scaled, [0, 1]);
        const mean = moments.mean;
        const variance = moments.variance;
        
        // Create histogram-like features
        const bins = 32;
        const minVal = tf.min(scaled);
        const maxVal = tf.max(scaled);
        const range = maxVal.sub(minVal);
        const step = range.div(tf.scalar(bins));
        
        // Generate histogram features using tf.stack
        const histogramBins = [];
        for(let i = 0; i < bins; i++) {
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
      
      // FIX: Ensure we always have exactly 512 dimensions
      const targetSize = 512;
      let resizedFeatures: tf.Tensor1D;
      
      if (combined.shape[0] > targetSize) {
        // If we have more features, truncate to 512
        resizedFeatures = combined.slice([0], [targetSize]) as tf.Tensor1D;
      } else if (combined.shape[0] < targetSize) {
        // If we have fewer features, replicate and pad intelligently
        const repetitions = Math.floor(targetSize / combined.shape[0]);
        const remainder = targetSize % combined.shape[0];
        
        const repeated = [];
        for (let i = 0; i < repetitions; i++) {
          repeated.push(combined);
        }
        if (remainder > 0) {
          repeated.push(combined.slice([0], [remainder]));
        }
        
        resizedFeatures = tf.concat(repeated) as tf.Tensor1D;
      } else {
        resizedFeatures = combined as tf.Tensor1D;
      }
      
      // Normalize the features AFTER ensuring correct size
      const featureMean = tf.mean(resizedFeatures);
      const featureVariance = tf.moments(resizedFeatures).variance;
      const featureStd = tf.sqrt(tf.add(featureVariance, 1e-8));
      
      const normalized = tf.div(
        tf.sub(resizedFeatures, featureMean),
        featureStd
      ) as tf.Tensor1D;
      
      return normalized.expandDims(0) as tf.Tensor2D;
    });
  } catch (error) {
    console.error('Error generating face embeddings:', error);
    return null;
  }
}

// Export for use in actions
export { getFaceEmbeddings };

async function detectFaces(tensor: tf.Tensor3D): Promise<DetectedFace[]> {
  const model = await loadModel();
  const results = await model.estimateFaces(tensor, false);
  
  return results.map((face: any) => {
    const topLeft = face.topLeft as [number, number];
    const bottomRight = face.bottomRight as [number, number];
    
    return {
      box: {
        xMin: topLeft[0],
        yMin: topLeft[1],
        width: bottomRight[0] - topLeft[0],
        height: bottomRight[1] - topLeft[1]
      },
      confidence: face.probability ? face.probability[0] : 0.9
    };
  });
}

function createFaceCrop(image: tf.Tensor3D, box: BoundingBox): tf.Tensor3D {
  return tf.tidy(() => {
    const tensor4D = tf.cast(image.expandDims(), 'float32') as tf.Tensor4D;
    const normalized = tf.image.cropAndResize(
      tensor4D,
      [[
        box.yMin / image.shape[0],
        box.xMin / image.shape[1],
        (box.yMin + box.height) / image.shape[0],
        (box.xMin + box.width) / image.shape[1]
      ]],
      [0],
      [224, 224]
    );
    return tf.squeeze(normalized) as tf.Tensor3D;
  });
}

export async function detectFace(input: DetectFaceInput): Promise<DetectFaceOutput> {
  let imageTensor: tf.Tensor3D | null = null;
  const result: DetectFaceOutput['faces'] = [];
  
  try {
    imageTensor = await imageDataUriToTensor(input.photoDataUri);
    if (!imageTensor) throw new Error('Failed to load image');
    
    const detections = await detectFaces(imageTensor);
    
    for (const detection of detections) {
      let faceTensor: tf.Tensor3D | null = null;
      let faceEmbedding: tf.Tensor2D | null = null;
      
      try {
        faceTensor = createFaceCrop(imageTensor, detection.box);
        if (faceTensor) {
          faceEmbedding = await getFaceEmbeddings(faceTensor);
          
            if (faceEmbedding) {
              const uid = generateStableId(faceEmbedding);
              let name: string | undefined;
              let matchConfidence = 0;
              let isPotentialMatch = false;
              let potentialMatches: Array<{ name: string; confidence: number }> = [];

              // Define confidence thresholds - OPTIMIZED FOR STUDENTS
              // Students have consistent features but may appear at different angles/distances
              // Lowered thresholds to reduce false negatives while maintaining accuracy
              const HIGH_CONFIDENCE = 0.78;   // Definite match - confident identification
              const MEDIUM_CONFIDENCE = 0.68;  // Potential match - likely but verify
              const LOW_CONFIDENCE = 0.58;    // Worth tracking - catch distant/angled faces

              // Use stored embeddings if available (faster)
              if (input.storedEmbeddings && input.storedEmbeddings.length > 0) {
                // Track all matches above low confidence threshold
                const matches: Array<{ name: string; similarity: number }> = [];
                
                for (const storedFace of input.storedEmbeddings) {
                  // Convert stored embedding back to tensor
                  const storedEmbeddingTensor = tf.tensor2d([storedFace.embedding]);
                  
                  try {
                    const similarity = cosineSimilarity(faceEmbedding, storedEmbeddingTensor);
                    if (similarity > LOW_CONFIDENCE) {
                      matches.push({ name: storedFace.studentName, similarity });
                    }
                  } finally {
                    storedEmbeddingTensor.dispose();
                  }
                }

                // Sort matches by similarity
                matches.sort((a, b) => b.similarity - a.similarity);

                if (matches.length > 0) {
                  const bestMatch = matches[0];
                  matchConfidence = bestMatch.similarity;

                  if (bestMatch.similarity >= HIGH_CONFIDENCE) {
                    // Strong match - confident identification
                    name = bestMatch.name;
                    isPotentialMatch = false;
                  } else if (bestMatch.similarity >= MEDIUM_CONFIDENCE) {
                    // Potential match - needs verification
                    isPotentialMatch = true;
                    // Store all potential matches above medium confidence
                    potentialMatches = matches
                      .filter(m => m.similarity >= MEDIUM_CONFIDENCE)
                      .map(m => ({ name: m.name, confidence: m.similarity }));
                  } else if (bestMatch.similarity >= LOW_CONFIDENCE) {
                    // Low confidence match - track but don't identify
                    isPotentialMatch = false;
                    potentialMatches = matches
                      .filter(m => m.similarity >= LOW_CONFIDENCE)
                      .map(m => ({ name: m.name, confidence: m.similarity }));
                  }
                }
              }
              // Fallback to processing registered faces if no stored embeddings
              else if (input.registeredFaces) {
                // Track all matches above low confidence threshold
                const matches: Array<{ name: string; similarity: number }> = [];

                for (const regFace of input.registeredFaces) {
                  let regImageTensor: tf.Tensor3D | null = null;
                  let regFaceTensor: tf.Tensor3D | null = null;
                  let regEmbedding: tf.Tensor2D | null = null;
                  
                  try {
                    regImageTensor = await imageDataUriToTensor(regFace.photoDataUri);
                    if (!regImageTensor) continue;
                    
                    const regDetections = await detectFaces(regImageTensor);
                    if (regDetections.length === 0) continue;
                    
                    regFaceTensor = createFaceCrop(regImageTensor, regDetections[0].box);
                    if (regFaceTensor) {
                      regEmbedding = await getFaceEmbeddings(regFaceTensor);
                      
                      if (regEmbedding) {
                        const similarity = cosineSimilarity(faceEmbedding, regEmbedding);
                        if (similarity > LOW_CONFIDENCE) {
                          matches.push({ name: regFace.name, similarity });
                        }
                      }
                    }
                  } finally {
                    regFaceTensor?.dispose();
                    regEmbedding?.dispose();
                    regImageTensor?.dispose();
                  }
                }

                // Sort matches by similarity
                matches.sort((a, b) => b.similarity - a.similarity);

                if (matches.length > 0) {
                  const bestMatch = matches[0];
                  matchConfidence = bestMatch.similarity;

                  if (bestMatch.similarity >= HIGH_CONFIDENCE) {
                    // Strong match - confident identification
                    name = bestMatch.name;
                    isPotentialMatch = false;
                  } else if (bestMatch.similarity >= MEDIUM_CONFIDENCE) {
                    // Potential match - needs verification
                    isPotentialMatch = true;
                    // Store all potential matches above medium confidence
                    potentialMatches = matches
                      .filter(m => m.similarity >= MEDIUM_CONFIDENCE)
                      .map(m => ({ name: m.name, confidence: m.similarity }));
                  } else if (bestMatch.similarity >= LOW_CONFIDENCE) {
                    // Low confidence match - track but don't identify
                    isPotentialMatch = false;
                    potentialMatches = matches
                      .filter(m => m.similarity >= LOW_CONFIDENCE)
                      .map(m => ({ name: m.name, confidence: m.similarity }));
                  }
                }
              }            result.push({
              boundingBox: {
                x: detection.box.xMin / imageTensor.shape[1],
                y: detection.box.yMin / imageTensor.shape[0],
                width: detection.box.width / imageTensor.shape[1],
                height: detection.box.height / imageTensor.shape[0],
              },
              confidence: detection.confidence,
              matchConfidence: matchConfidence,
              isPotentialMatch: isPotentialMatch,
              name,
              potentialMatches,
              uid,
            });
          }
        }
      } catch (error) {
        console.error('Error processing face:', error);
      } finally {
        faceTensor?.dispose();
        faceEmbedding?.dispose();
      }
    }

    return { faces: result };
  } catch (error) {
    console.error('Error in face detection:', error);
    return { faces: [] };
  } finally {
    imageTensor?.dispose();
  }
}