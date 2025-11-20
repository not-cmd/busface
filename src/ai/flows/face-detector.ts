import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

// Use the actual BlazeFace NormalizedFace type
interface NormalizedFace {
  topLeft: tf.Tensor1D | [number, number];
  bottomRight: tf.Tensor1D | [number, number]; 
  landmarks: tf.Tensor2D | number[][];
  probability: tf.Tensor1D | number[];
}

export interface DetectedFace {
  box: {
    xMin: number;
    yMin: number; 
    width: number;
    height: number;
  };
  score: number;
  keypoints: { x: number; y: number; z?: number }[];
}

interface FaceDetectionResult {
  box?: {
    xMin: number;
    yMin: number;
    width: number;
    height: number;
  };
  boundingBox?: {
    xMin: number;
    yMin: number;
    width: number;
    height: number;
  };
  score?: number;
  keypoints?: { x: number; y: number; z?: number }[];
  landmarks?: { x: number; y: number; z?: number }[];
}

let model: blazeface.BlazeFaceModel | null = null;

export async function loadModel(): Promise<blazeface.BlazeFaceModel> {
  if (model) return model;

  await tf.ready();
  await tf.setBackend('cpu'); // Use CPU backend for better compatibility

  model = await blazeface.load();
  return model;
}

export async function detectSingleFace(tensor: tf.Tensor3D): Promise<DetectedFace | null> {
  const detector = await loadModel();
  const predictions = await detector.estimateFaces(tensor, false);
  
  if (!predictions || predictions.length === 0) return null;
  
  const face = predictions[0];
  
  // Handle both tensor and array formats
  const topLeft = Array.isArray(face.topLeft) ? face.topLeft : await (face.topLeft as tf.Tensor1D).data();
  const bottomRight = Array.isArray(face.bottomRight) ? face.bottomRight : await (face.bottomRight as tf.Tensor1D).data();
  const probability = face.probability ? 
    (Array.isArray(face.probability) ? face.probability : await (face.probability as tf.Tensor1D).data()) : 
    [0.9];
  
  const width = (bottomRight as number[])[0] - (topLeft as number[])[0];
  const height = (bottomRight as number[])[1] - (topLeft as number[])[1];
  
  let keypoints: { x: number; y: number; z: number }[] = [];
  if (face.landmarks) {
    if (Array.isArray(face.landmarks)) {
      keypoints = (face.landmarks as number[][]).map((landmark: number[]) => ({
        x: landmark[0],
        y: landmark[1],
        z: 0
      }));
    } else {
      // Handle tensor format
      const landmarksData = await (face.landmarks as tf.Tensor2D).data();
      const landmarksArray = Array.from(landmarksData);
      for (let i = 0; i < landmarksArray.length; i += 2) {
        keypoints.push({
          x: landmarksArray[i],
          y: landmarksArray[i + 1],
          z: 0
        });
      }
    }
  }
  
  return {
    box: {
      xMin: (topLeft as number[])[0],
      yMin: (topLeft as number[])[1],
      width,
      height
    },
    score: (probability as number[])[0] || 0.9,
    keypoints
  };
}

export async function detectFaces(tensor: tf.Tensor3D): Promise<DetectedFace[]> {
  const detector = await loadModel();
  const predictions = await detector.estimateFaces(tensor, false);
  
  if (!predictions) return [];
  
  const results: DetectedFace[] = [];
  
  for (const face of predictions) {
    try {
      // Handle both tensor and array formats
      const topLeft = Array.isArray(face.topLeft) ? face.topLeft : await (face.topLeft as tf.Tensor1D).data();
      const bottomRight = Array.isArray(face.bottomRight) ? face.bottomRight : await (face.bottomRight as tf.Tensor1D).data();
      const probability = face.probability ? 
        (Array.isArray(face.probability) ? face.probability : await (face.probability as tf.Tensor1D).data()) : 
        [0.9];
      
      const width = (bottomRight as number[])[0] - (topLeft as number[])[0];
      const height = (bottomRight as number[])[1] - (topLeft as number[])[1];
      
      let keypoints: { x: number; y: number; z: number }[] = [];
      if (face.landmarks) {
        if (Array.isArray(face.landmarks)) {
          keypoints = (face.landmarks as number[][]).map((landmark: number[]) => ({
            x: landmark[0],
            y: landmark[1],
            z: 0
          }));
        } else {
          // Handle tensor format
          const landmarksData = await (face.landmarks as tf.Tensor2D).data();
          const landmarksArray = Array.from(landmarksData);
          for (let i = 0; i < landmarksArray.length; i += 2) {
            keypoints.push({
              x: landmarksArray[i],
              y: landmarksArray[i + 1],
              z: 0
            });
          }
        }
      }
      
      results.push({
        box: {
          xMin: (topLeft as number[])[0],
          yMin: (topLeft as number[])[1],
          width,
          height
        },
        score: (probability as number[])[0] || 0.9,
        keypoints
      });
    } catch (error) {
      console.error('Error processing face detection result:', error);
    }
  }
  
  return results;
}