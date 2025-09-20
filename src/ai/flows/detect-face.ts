'use server';
/**
 * @fileOverview An AI agent that detects and recognizes faces in a photo using FaceNet, providing stable IDs.
 */

import * as tf from '@tensorflow/tfjs';
import { z } from 'zod';
import { loadModel } from './face-detector';
import { imageDataUriToTensor, cosineSimilarity, generateStableId } from './face-utils';

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
  const model = await loadModel();
  const predictions = await model.landmarksModel.estimateFaces(face);
  
  if (!predictions || predictions.length === 0) return null;

  return tf.tidy(() => {
    const keypoints = (predictions[0].keypoints as Keypoint[]).map(p => [p.x, p.y, p.z || 0]);
    const points = tf.tensor2d(keypoints);
    const mean = points.mean(0);
    const std = points.sub(mean).square().mean(0).sqrt();
    return points.sub(mean).div(std) as tf.Tensor2D;
  });
}

async function detectFaces(tensor: tf.Tensor3D): Promise<DetectedFace[]> {
  const model = await loadModel();
  const detections = await model.detector.estimateFaces(tensor);
  
  return detections.map(d => ({
    box: {
      xMin: d.box.xMin,
      yMin: d.box.yMin,
      width: d.box.width,
      height: d.box.height
    },
    confidence: 1 // MediaPipe doesn't provide confidence scores
  }));
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

            // Process registered faces if available
            if (input.registeredFaces) {
              let bestMatch = { name: '', similarity: 0 };
              
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
                      if (similarity > 0.85 && similarity > bestMatch.similarity) {
                        bestMatch = { name: regFace.name, similarity };
                      }
                    }
                  }
                } finally {
                  regFaceTensor?.dispose();
                  regEmbedding?.dispose();
                  regImageTensor?.dispose();
                }
              }

              if (bestMatch.name) {
                name = bestMatch.name;
              }
            }

            result.push({
              boundingBox: {
                x: detection.box.xMin / imageTensor.shape[1],
                y: detection.box.yMin / imageTensor.shape[0],
                width: detection.box.width / imageTensor.shape[1],
                height: detection.box.height / imageTensor.shape[0],
              },
              confidence: detection.confidence,
              name,
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