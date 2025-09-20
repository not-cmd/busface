import * as tf from '@tensorflow/tfjs';
import * as faceapi from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import type { MediaPipeFaceMeshMediaPipeModelConfig } from '@tensorflow-models/face-landmarks-detection';

export type FaceDetectorModel = {
  detector: faceapi.FaceDetector;
  landmarksModel: faceLandmarksDetection.FaceLandmarksDetector;
};

let model: FaceDetectorModel | null = null;

export async function loadModel(): Promise<FaceDetectorModel> {
  if (model) return model;

  await tf.ready();
  
  const detector = await faceapi.createDetector(
    faceapi.SupportedModels.MediaPipeFaceDetector,
    { 
      runtime: 'tfjs' as const,
      modelType: 'short',
      maxFaces: 10
    }
  );

  const landmarksModel = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { 
      runtime: 'mediapipe' as const,
      refineLandmarks: true,
      maxFaces: 1
    }
  );

  model = { detector, landmarksModel };
  return model;
}

export interface DetectedFace {
  box: {
    xMin: number;
    yMin: number;
    width: number;
    height: number;
  };
  score: number;
  keypoints?: { x: number; y: number; z?: number }[];
}

export async function detectSingleFace(tensor: tf.Tensor3D): Promise<DetectedFace | null> {
  const model = await loadModel();
  const result = await model.detector.estimateFaces(tensor);
  
  if (result.length === 0) return null;
  
  const face = result[0];
  return {
    box: {
      xMin: face.box.xMin,
      yMin: face.box.yMin,
      width: face.box.width,
      height: face.box.height
    },
    score: 1,
    keypoints: face.keypoints
  };
}

export async function detectFaces(tensor: tf.Tensor3D): Promise<DetectedFace[]> {
  const model = await loadModel();
  const results = await model.detector.estimateFaces(tensor);
  
  return results.map(face => ({
    box: {
      xMin: face.box.xMin,
      yMin: face.box.yMin,
      width: face.box.width,
      height: face.box.height
    },
    score: 1,
    keypoints: face.keypoints
  }));
}