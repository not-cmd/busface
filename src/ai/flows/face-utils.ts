import * as tf from '@tensorflow/tfjs';
import { createCanvas, loadImage } from 'canvas';

export async function imageDataUriToTensor(dataUri: string): Promise<tf.Tensor3D> {
  const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Load image and create canvas
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  
  // Draw image
  ctx.drawImage(image, 0, 0);
  
  // Convert to tensor
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = new Float32Array(imageData.data);
  return tf.tensor3d(pixels, [canvas.height, canvas.width, 4]);
}

export function cosineSimilarity(a: tf.Tensor2D, b: tf.Tensor2D): number {
  return tf.tidy(() => {
    const a_norm = a.div(tf.norm(a));
    const b_norm = b.div(tf.norm(b));
    return a_norm.matMul(b_norm.transpose()).dataSync()[0];
  });
}

export function generateStableId(embedding: tf.Tensor2D): string {
  return tf.tidy(() => {
    // Get normalized embedding values
    const normalized = embedding.div(tf.norm(embedding));
    const data = normalized.dataSync();
    
    // Convert to stable string format
    return Array.from(data)
      .map(x => Math.round(x * 1000))
      .join(',')
      .split('')
      .reduce((hash, char) => {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
        return hash & hash;
      }, 0)
      .toString(16)
      .substring(0, 12);
  });
}