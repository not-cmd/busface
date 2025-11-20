import { db, storage } from './firebase';
import { ref as dbRef, set, get, onValue, remove, query, orderByChild, limitToLast } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

export interface LiveFeedFrame {
  url: string;
  timestamp: number;
  busId: string;
  quality: 'low' | 'medium' | 'high';
}

/**
 * Upload a video frame to Firebase Storage and update the live feed
 * @param frameDataUrl - Base64 data URL of the frame
 * @param busId - ID of the bus
 * @param quality - Quality setting for the frame
 */
export async function uploadLiveFrame(
  frameDataUrl: string,
  busId: string,
  quality: 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  try {
    const timestamp = Date.now();
    const fileName = `frame-${timestamp}.jpg`;
    const frameRef = storageRef(storage, `live-feeds/${busId}/${fileName}`);
    
    // Convert data URL to blob
    const response = await fetch(frameDataUrl);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    await uploadBytes(frameRef, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=10', // Short cache for live feeds
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(frameRef);
    
    // Update Realtime Database with latest frame info
    const feedRef = dbRef(db, `liveFeeds/${busId}/current`);
    await set(feedRef, {
      url: downloadURL,
      timestamp: timestamp,
      quality: quality,
      fileName: fileName
    });
    
    // Clean up old frames (keep only last 5 frames)
    await cleanupOldFrames(busId, 5);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading live frame:', error);
    throw error;
  }
}

/**
 * Start broadcasting live feed from bus staff camera
 * @param busId - ID of the bus
 * @param videoElement - HTML video element capturing the camera
 * @param interval - Interval between frame uploads in milliseconds (default 3000ms = 3 seconds)
 */
export function startLiveBroadcast(
  busId: string,
  videoElement: HTMLVideoElement,
  interval: number = 3000
): () => void {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  let broadcasting = true;
  let frameCount = 0;
  
  const broadcast = async () => {
    if (!broadcasting || videoElement.paused || videoElement.ended) {
      return;
    }
    
    try {
      // Set canvas size to match video
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        // Draw current video frame
        ctx.drawImage(videoElement, 0, 0);
        
        // Determine quality based on frame count (adaptive quality)
        // Every 10th frame: high quality
        // Every 5th frame: medium quality
        // Other frames: low quality for bandwidth saving
        let quality: 'low' | 'medium' | 'high' = 'low';
        let compressionQuality = 0.3;
        
        frameCount++;
        if (frameCount % 10 === 0) {
          quality = 'high';
          compressionQuality = 0.7;
        } else if (frameCount % 5 === 0) {
          quality = 'medium';
          compressionQuality = 0.5;
        }
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', compressionQuality);
        
        // Upload frame
        await uploadLiveFrame(dataUrl, busId, quality);
        
        console.log(`Live frame uploaded for bus ${busId} (${quality} quality)`);
      }
    } catch (error) {
      console.error('Error broadcasting frame:', error);
    }
    
    // Schedule next broadcast
    if (broadcasting) {
      setTimeout(broadcast, interval);
    }
  };
  
  // Start broadcasting
  broadcast();
  
  // Return cleanup function
  return () => {
    broadcasting = false;
    console.log(`Live broadcast stopped for bus ${busId}`);
  };
}

/**
 * Subscribe to live feed updates for a bus
 * @param busId - ID of the bus
 * @param onFrame - Callback when new frame is available
 */
export function subscribeLiveFeed(
  busId: string,
  onFrame: (frame: LiveFeedFrame) => void
): () => void {
  const feedRef = dbRef(db, `liveFeeds/${busId}/current`);
  
  const unsubscribe = onValue(feedRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      onFrame({
        url: data.url,
        timestamp: data.timestamp,
        busId: busId,
        quality: data.quality || 'medium'
      });
    }
  });
  
  return unsubscribe;
}

/**
 * Get the latest frame for a bus (one-time fetch)
 * @param busId - ID of the bus
 */
export async function getLatestFrame(busId: string): Promise<LiveFeedFrame | null> {
  try {
    const feedRef = dbRef(db, `liveFeeds/${busId}/current`);
    const snapshot = await get(feedRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        url: data.url,
        timestamp: data.timestamp,
        busId: busId,
        quality: data.quality || 'medium'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting latest frame:', error);
    return null;
  }
}

/**
 * Clean up old frames from storage
 * @param busId - ID of the bus
 * @param keepCount - Number of recent frames to keep
 */
async function cleanupOldFrames(busId: string, keepCount: number = 5): Promise<void> {
  try {
    const folderRef = storageRef(storage, `live-feeds/${busId}`);
    const fileList = await listAll(folderRef);
    
    if (fileList.items.length > keepCount) {
      // Sort by name (which includes timestamp)
      const sortedItems = fileList.items.sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      // Delete oldest files
      const filesToDelete = sortedItems.slice(0, sortedItems.length - keepCount);
      
      await Promise.all(
        filesToDelete.map(item => deleteObject(item))
      );
      
      console.log(`Cleaned up ${filesToDelete.length} old frames for bus ${busId}`);
    }
  } catch (error) {
    console.error('Error cleaning up old frames:', error);
  }
}

/**
 * Stop broadcasting and clean up all frames for a bus
 * @param busId - ID of the bus
 */
export async function stopAndCleanupBroadcast(busId: string): Promise<void> {
  try {
    // Remove current feed reference
    const feedRef = dbRef(db, `liveFeeds/${busId}/current`);
    await remove(feedRef);
    
    // Delete all frames from storage
    const folderRef = storageRef(storage, `live-feeds/${busId}`);
    const fileList = await listAll(folderRef);
    
    await Promise.all(
      fileList.items.map(item => deleteObject(item))
    );
    
    console.log(`Cleaned up all frames for bus ${busId}`);
  } catch (error) {
    console.error('Error stopping and cleaning up broadcast:', error);
  }
}

/**
 * Check if a bus is currently broadcasting
 * @param busId - ID of the bus
 */
export async function isBroadcasting(busId: string): Promise<boolean> {
  try {
    const feedRef = dbRef(db, `liveFeeds/${busId}/current`);
    const snapshot = await get(feedRef);
    
    if (!snapshot.exists()) return false;
    
    const data = snapshot.val();
    const now = Date.now();
    const timeSinceLastFrame = now - data.timestamp;
    
    // Consider broadcasting if last frame was within 10 seconds
    return timeSinceLastFrame < 10000;
  } catch (error) {
    console.error('Error checking broadcast status:', error);
    return false;
  }
}

/**
 * Get broadcast statistics
 * @param busId - ID of the bus
 */
export async function getBroadcastStats(busId: string): Promise<{
  isActive: boolean;
  lastFrameTimestamp: number | null;
  timeSinceLastFrame: number | null;
  frameCount: number;
}> {
  try {
    const feedRef = dbRef(db, `liveFeeds/${busId}/current`);
    const snapshot = await get(feedRef);
    
    const folderRef = storageRef(storage, `live-feeds/${busId}`);
    const fileList = await listAll(folderRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const now = Date.now();
      const timeSince = now - data.timestamp;
      
      return {
        isActive: timeSince < 10000,
        lastFrameTimestamp: data.timestamp,
        timeSinceLastFrame: timeSince,
        frameCount: fileList.items.length
      };
    }
    
    return {
      isActive: false,
      lastFrameTimestamp: null,
      timeSinceLastFrame: null,
      frameCount: fileList.items.length
    };
  } catch (error) {
    console.error('Error getting broadcast stats:', error);
    return {
      isActive: false,
      lastFrameTimestamp: null,
      timeSinceLastFrame: null,
      frameCount: 0
    };
  }
}
