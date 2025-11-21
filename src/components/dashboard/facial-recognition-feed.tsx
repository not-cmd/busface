'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import type { StudentJson as StudentType } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref as dbRef, push, set, query, orderByChild, equalTo, limitToLast, get, update, endBefore } from 'firebase/database';
import { format } from 'date-fns';
import * as tf from '@tensorflow/tfjs';
import { 
  detectFacesClient, 
  extractFaceCrop, 
  generateFaceEmbeddingClient,
  matchFace,
  generateStableFaceId,
  type StoredFaceEmbedding 
} from '@/lib/face-detection-client';

interface FacialRecognitionFeedProps {
    busId: string;
    studentsOnBus: StudentType[];
    isPrimarySession?: boolean; // If false, camera access is disabled
}

interface Face {
    boundingBox: { x: number; y: number; width: number; height: number; };
    confidence: number;
    matchConfidence?: number;
    isPotentialMatch?: boolean;
    potentialMatches?: Array<{ name: string; confidence: number }>;
    uid: string;
    name?: string;
    isRecognized?: boolean;
    isWrongBus?: boolean;
    correctBusName?: string;
}

interface RegisteredFace {
    name: string;
    photoDataUri: string;
}

export function FacialRecognitionFeed({ busId, studentsOnBus, isPrimarySession = true }: FacialRecognitionFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
    const { toast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanningEnabled, setScanningEnabled] = useState(false); // New state to control scanning
    const [isCameraStarting, setIsCameraStarting] = useState(false); // Prevent repeated camera starts
    const [cameraInitialized, setCameraInitialized] = useState(false); // Track if camera is properly initialized
    const animationFrameId = useRef<number | null>(null);
    const [detectedFaces, setDetectedFaces] = useState<Face[]>([]);
    const lastRecognitionTime = useRef<Record<string, number>>({});
    const lastToastTime = useRef<Record<string, number>>({});
    const lastIntruderAlertTime = useRef<Record<string, number>>({}); // Track intruder alerts separately
    const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>([]);
    const [allStudents, setAllStudents] = useState<StudentType[]>([]);
    const [readyToScan, setReadyToScan] = useState(false);
    const [storedEmbeddings, setStoredEmbeddings] = useState<StoredFaceEmbedding[]>([]);
    const [busDataState, setBusDataState] = useState<any>({});
    const [embeddingsLoaded, setEmbeddingsLoaded] = useState(false);

    // Throttled toast function to prevent spam
    const throttledToast = useCallback((key: string, toastOptions: any, throttleTime = 5000) => {
        const now = Date.now();
        if (!lastToastTime.current[key] || now - lastToastTime.current[key] > throttleTime) {
            lastToastTime.current[key] = now;
            toast(toastOptions);
        }
    }, [toast]);

    useEffect(() => {
        const studentsRef = dbRef(db, 'students');
        get(studentsRef).then(snapshot => {
            if (snapshot.exists()) {
                setAllStudents(Object.values(snapshot.val()));
            }
        });

        // Load bus data from Firebase
        const busesRef = dbRef(db, 'buses');
        get(busesRef).then(snapshot => {
            if (snapshot.exists()) {
                setBusDataState(snapshot.val());
            }
        });

        // Load stored face embeddings in the background for fast client-side matching
        const embeddingsRef = dbRef(db, 'faceEmbeddings');
        
        // Set loaded immediately so UI doesn't block
        setEmbeddingsLoaded(true);
        
        // Load embeddings in background
        (async () => {
            try {
                console.log('🔄 Loading face embeddings in background...');
                const snapshot = await get(embeddingsRef);
                
                if (snapshot.exists()) {
                    const embeddingsData = snapshot.val();
                    const embeddings: StoredFaceEmbedding[] = [];
                    
                    for (const studentId in embeddingsData) {
                        const data = embeddingsData[studentId];
                        if (data.embedding && data.studentName) {
                            // Validate embedding data
                            const embeddingArray = Array.isArray(data.embedding) ? data.embedding : Array.from(data.embedding);
                            const validEmbedding = embeddingArray.length === 512 && 
                                                  embeddingArray.some((v: number) => !isNaN(v) && isFinite(v));
                            
                            if (validEmbedding) {
                                embeddings.push({
                                    studentId: data.studentId || studentId,
                                    studentName: data.studentName,
                                    embedding: embeddingArray,
                                });
                                console.log(`✓ Loaded embedding for ${data.studentName}`);
                            } else {
                                console.warn(`✗ Invalid embedding for ${data.studentName}`);
                            }
                        }
                    }
                    
                    setStoredEmbeddings(embeddings);
                    console.log(`✅ Successfully loaded ${embeddings.length} face embeddings for matching`);
                    
                    if (embeddings.length === 0) {
                        console.warn('⚠️ No valid embeddings found. Students need to register their faces.');
                    }
                } else {
                    console.warn('⚠️ No faceEmbeddings node found in database');
                }
            } catch (error) {
                console.error('❌ Error loading face embeddings:', error);
            }
        })();

        const registeredFacesRef = dbRef(db, 'registeredFaces');
        const fetchRegisteredFaces = async () => {
            const snapshot = await get(registeredFacesRef);
            if (snapshot.exists()) {
                const allStudentFaces: any = snapshot.val();
                const faces: RegisteredFace[] = [];
                
                for (const studentId in allStudentFaces) {
                    const studentData = allStudentFaces[studentId];
                    if (studentData.photos && studentData.photos.length > 0) {
                        studentData.photos.forEach((photoDataUri: string) => {
                             faces.push({
                                name: studentData.name,
                                photoDataUri: photoDataUri
                            });
                        });
                    }
                }
                setRegisteredFaces(faces);
            }
        };
        fetchRegisteredFaces();
    }, []);
    
    const requestLocation = useCallback(async () => {
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            if (status.state === 'denied') {
                setHasLocationPermission(false);
                toast({ variant: 'destructive', title: 'Location Denied', description: 'Please enable location permissions.' });
                return;
            }
            navigator.geolocation.getCurrentPosition(
                () => {
                    console.log('Location permission granted');
                    setHasLocationPermission(true);
                },
                (err) => {
                    console.log('Location permission error:', err.message);
                    setHasLocationPermission(false);
                    toast({ variant: 'destructive', title: 'Location Error', description: err.message });
                }
            );
        } catch (err) {
            setHasLocationPermission(false);
            toast({ variant: 'destructive', title: 'Location Error', description: 'Could not request location.' });
        }
    }, [toast]);

    const startCamera = useCallback(async () => {
        // Prevent multiple simultaneous camera start attempts
        if (isCameraStarting || cameraInitialized) {
            console.log("Camera startup already in progress or already initialized");
            return;
        }
        
        setIsCameraStarting(true);
        
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported in this browser');
            }

            // Try to get camera stream first, permission check may not work on all browsers
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user", // Change to "user" for front camera, which is more reliable
                    frameRate: { ideal: 15 } // Reduce frame rate for better performance
                }
            });
            
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                // Only show success toast once
                throttledToast('camera-connected', {
                    title: 'Camera Connected',
                    description: 'Face recognition is now active.',
                    className: 'bg-green-100 border-green-300 text-green-800'
                }, 10000);
                
                // Set up proper video initialization
                videoRef.current.onloadedmetadata = () => {
                    if (videoRef.current) {
                        videoRef.current.play().then(() => {
                            console.log('Camera initialized successfully');
                            setCameraInitialized(true);
                        });
                    }
                };
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);

            let errorMessage = 'Please enable camera permissions to use this feature.';
            
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Camera access was denied. Please click the camera icon in your browser address bar and allow camera access.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No camera found on this device.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Camera is being used by another application.';
                } else {
                    errorMessage = 'Error accessing camera: ' + error.message;
                }
            }

            // Throttle error notifications
            throttledToast('camera-error', {
                title: "Camera Access Failed",
                description: errorMessage,
                variant: "destructive"
            }, 5000);
        } finally {
            // Add a short delay to prevent immediate retries
            if (!cameraInitialized) {
                setTimeout(() => setIsCameraStarting(false), 2000);
            } else {
                setIsCameraStarting(false);
            }
        }
    }, [throttledToast, isCameraStarting, cameraInitialized]);

    const stopCamera = useCallback(() => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
        setIsScanning(false);
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }, []);
    
    useEffect(() => {
        let cleanupFn: (() => void) | undefined;
        // Only allow camera access for primary sessions
        if (isPrimarySession && readyToScan && !isCameraStarting && !cameraInitialized) {
            startCamera();
            cleanupFn = () => stopCamera();
        }
        return () => {
            if (cleanupFn) cleanupFn();
        };
    }, [isPrimarySession, readyToScan, startCamera, stopCamera, isCameraStarting, cameraInitialized]);

    const handleRecognitionEvent = useCallback(async (face: Face, snapshotDataUrl: string) => {
        const now = Date.now();
        const recognitionCooldown = 60000; // 1 minute cooldown per UID
    
        if (now - (lastRecognitionTime.current[face.uid] || 0) < recognitionCooldown) {
            return;
        }
        lastRecognitionTime.current[face.uid] = now;
    
        try {
            if (face.name && !face.isWrongBus) {
                const student = studentsOnBus.find(s => s.name === face.name);
                if (!student) return;

                const today = format(new Date(), 'yyyy-MM-dd');
                const attendanceRef = dbRef(db, `attendance/${today}/${student.studentId}`);
                await update(attendanceRef, {
                    status: 'On Board',
                    entry: format(new Date(), 'hh:mm a'),
                    source: 'AIAttendance'
                });

                const studentEventRef = dbRef(db, `studentEvents/${student.studentId}`);
                await set(studentEventRef, {
                    latestSnapshotUrl: snapshotDataUrl,
                    timestamp: new Date().toISOString(),
                    eventType: 'OnboardRecognition'
                });

                throttledToast(`recognized-${face.name}`, {
                    title: `Recognized: ${face.name}`,
                    description: 'Attendance marked as "On Board".',
                }, 30000); // Only show once per 30 seconds per student
            } else if (face.name && face.isWrongBus) {

            } else if (!face.name || face.isPotentialMatch) {
                // INTRUDER ALERT: Add client-side cooldown to prevent spam
                const intruderCooldown = 5 * 60 * 1000; // 5 minutes cooldown per unique face
                const lastAlertForThisFace = lastIntruderAlertTime.current[face.uid] || 0;
                
                if (now - lastAlertForThisFace < intruderCooldown) {
                    console.log(`Skipping intruder alert for ${face.uid} - within cooldown period`);
                    return; // Skip if we already alerted for this face recently
                }
                
                const recentAlertsRef = dbRef(db, 'intruderAlerts');
                
                // Check for recent alerts with this face UID in Firebase
                const recentAlertsQuery = query(
                    recentAlertsRef,
                    orderByChild('faceUid'),
                    equalTo(face.uid),
                    limitToLast(1)
                );
                
                const snapshot = await get(recentAlertsQuery);
                const nowDate = new Date();
                const firebaseCooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown
                
                let shouldCreateAlert = true;
                
                if (snapshot.exists()) {
                    const recentAlert = Object.values(snapshot.val())[0] as any;
                    const lastAlertTime = new Date(recentAlert.timestamp);
                    
                    // Check cooldown period and similarity
                    if (nowDate.getTime() - lastAlertTime.getTime() < firebaseCooldownPeriod ||
                        (face.matchConfidence && recentAlert.matchConfidence && 
                         Math.abs(face.matchConfidence - recentAlert.matchConfidence) < 0.1)) {
                        shouldCreateAlert = false;
                        console.log('Skipping intruder alert - duplicate found in Firebase');
                    }
                }
                
                if (shouldCreateAlert) {
                    // Update client-side tracking
                    lastIntruderAlertTime.current[face.uid] = now;
                    
                    // Clean up old alerts (older than 24 hours)
                    const oldAlertsQuery = query(
                        recentAlertsRef,
                        orderByChild('timestamp'),
                        endBefore(new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString())
                    );
                    
                    const oldAlerts = await get(oldAlertsQuery);
                    if (oldAlerts.exists()) {
                        const updates: { [key: string]: null } = {};
                        oldAlerts.forEach((child) => {
                            updates[child.key as string] = null;
                        });
                        await update(recentAlertsRef, updates);
                    }

                    // Create new alert - ONLY ONCE per unique face per cooldown period
                    const newIntruderRef = push(recentAlertsRef);
                    await set(newIntruderRef, {
                        snapshotUrl: snapshotDataUrl,
                        timestamp: nowDate.toISOString(),
                        faceUid: face.uid,
                        busId: busId,
                        matchConfidence: face.matchConfidence || 0,
                        isPotentialMatch: face.isPotentialMatch || false,
                        potentialMatches: face.potentialMatches || []
                    });

                    console.log(`Intruder alert created for face ${face.uid} on bus ${busId}`);

                    // Show appropriate toast based on match confidence - ONLY ONCE
                    if (face.isPotentialMatch) {
                        const potentialNames = face.potentialMatches?.map(m => m.name).join(', ');
                        throttledToast('potential-match', {
                            variant: 'warning',
                            title: 'Potential Match Detected',
                            description: `This person looks similar to: ${potentialNames}. Please verify.`
                        }, 30000);
                    } else {
                        throttledToast(`intruder-${face.uid}`, {
                            variant: 'destructive',
                            title: `Intruder Detected`,
                            description: `Unrecognized person detected on Bus ${busId}. Alert saved.`
                        }, 30000); // Show once per unique face with longer cooldown
                    }
                }
            }
        } catch (error) {
            console.error('Error in recognition event process:', error);
        }
    }, [busId, throttledToast, studentsOnBus]);

    const scanLoop = useCallback(async () => {
        if (!isScanning || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended || !scanningEnabled) {
            animationFrameId.current = requestAnimationFrame(scanLoop);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
            // Ensure canvas size matches video
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            
            // Clear canvas first
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            // CRITICAL: Draw the current video frame to canvas for processing
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Draw face detection overlays on top
            if (detectedFaces.length > 0) {
                console.log(`Drawing ${detectedFaces.length} face overlays on canvas`);
                
                detectedFaces.forEach(face => {
                    const { x, y, width, height } = face.boundingBox;
                    const absX = x * canvas.width;
                    const absY = y * canvas.height;
                    const absWidth = width * canvas.width;
                    const absHeight = height * canvas.height;

                    context.lineWidth = 3;
                    let color = 'red';
                    let label = 'Unrecognized';

                    if (face.isWrongBus) {
                        color = '#3b82f6';
                        label = `Wrong bus. Go to ${face.correctBusName || 'your bus'}.`;
                    } else if (face.name) {
                        color = 'lime';
                        label = face.name;
                    }
                    
                    context.strokeStyle = color;
                    context.strokeRect(absX, absY, absWidth, absHeight);
                    
                    // Draw background for text
                    const confidenceText = face.matchConfidence ? 
                        `${Math.round(face.matchConfidence * 100)}%` : 
                        `${Math.round(face.confidence * 100)}%`;
                    const labelWithConfidence = `${label} (${confidenceText})`;
                    
                    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    context.fillRect(absX, absY > 25 ? absY - 25 : absY + absHeight, absWidth, 20);
                    
                    context.fillStyle = color;
                    context.font = 'bold 16px Arial';
                    context.fillText(labelWithConfidence, absX + 5, absY > 25 ? absY - 8 : absY + absHeight + 15);
                });
            }

            if (!isProcessing) {
                setIsProcessing(true);
                
                // Create a smaller canvas for processing to reduce payload size
                const processingCanvas = document.createElement('canvas');
                const processingCtx = processingCanvas.getContext('2d');
                
                // OPTIMIZED: Higher resolution (640x480) for better face detection
                // BlazeFace works best with higher resolution images
                const maxWidth = 640;
                const maxHeight = 480;
                const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1);
                
                processingCanvas.width = canvas.width * scale;
                processingCanvas.height = canvas.height * scale;
                
                if (processingCtx) {
                    // Enhance image for better face detection
                    // Draw the video frame (not the overlays) to processing canvas
                    processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);
                    
                    // Apply slight contrast enhancement for better detection
                    const imageData = processingCtx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);
                    const data = imageData.data;
                    const contrastFactor = 1.2; // 20% contrast boost
                    
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = Math.min(255, ((data[i] - 128) * contrastFactor) + 128);     // R
                        data[i + 1] = Math.min(255, ((data[i + 1] - 128) * contrastFactor) + 128); // G
                        data[i + 2] = Math.min(255, ((data[i + 2] - 128) * contrastFactor) + 128); // B
                    }
                    
                    processingCtx.putImageData(imageData, 0, 0);
                }
                
                // OPTIMIZED: Slightly higher quality (25%) for better feature extraction
                // Balance between file size and face recognition accuracy
                const photoDataUri = processingCanvas.toDataURL('image/jpeg', 0.25);

                try {
                    console.log('Running client-side face detection:', processingCanvas.width, 'x', processingCanvas.height);
                    
                    // Debug: Check if processing canvas has actual image data
                    if (processingCtx) {
                        const procImageData = processingCtx.getImageData(0, 0, Math.min(10, processingCanvas.width), Math.min(10, processingCanvas.height));
                        const procAvgPixel = Array.from(procImageData.data).reduce((a, b) => a + b, 0) / procImageData.data.length;
                        console.log('🎥 Processing canvas sample:', {
                            avgPixelValue: procAvgPixel.toFixed(2),
                            firstPixels: Array.from(procImageData.data.slice(0, 12))
                        });
                    }
                    
                    // Client-side face detection with sensitive thresholds
                    // returnTensors=true, iouThreshold=0.3, scoreThreshold=0.5 for better detection
                    const predictions = await detectFacesClient(processingCanvas, true, 0.3, 0.5);
                    console.log(`Detected ${predictions.length} faces`);
                    
                    // If no faces detected, try with even more sensitive threshold
                    if (predictions.length === 0) {
                        console.log('No faces detected, retrying with lower threshold (0.3)...');
                        const retryPredictions = await detectFacesClient(processingCanvas, true, 0.3, 0.3);
                        if (retryPredictions.length > 0) {
                            console.log(`Retry successful! Detected ${retryPredictions.length} faces with lower threshold`);
                            predictions.push(...retryPredictions);
                        }
                    }
                    
                    const processedFaces: Face[] = [];
                    
                    for (const prediction of predictions) {
                        // Validate prediction has required properties
                        if (!prediction.topLeft || !prediction.bottomRight) {
                            console.error('❌ Invalid prediction format:', prediction);
                            continue;
                        }
                        
                        // Extract coordinates from tensors
                        // topLeft and bottomRight are Tensor objects, not arrays!
                        const topLeftData = Array.from(await prediction.topLeft.data()) as number[];
                        const bottomRightData = Array.from(await prediction.bottomRight.data()) as number[];
                        
                        if (topLeftData.length < 2 || bottomRightData.length < 2) {
                            console.error('❌ Invalid tensor data:', { topLeftData, bottomRightData });
                            continue;
                        }
                        
                        // Handle case where topLeft/bottomRight might be swapped
                        const x1 = topLeftData[0];
                        const y1 = topLeftData[1];
                        const x2 = bottomRightData[0];
                        const y2 = bottomRightData[1];
                        
                        // Use Math.min/max to ensure correct bounding box regardless of order
                        const x = Math.min(x1, x2);
                        const y = Math.min(y1, y2);
                        const width = Math.abs(x2 - x1);
                        const height = Math.abs(y2 - y1);
                        
                        console.log('📐 Bounding box from tensors:', { 
                            raw: { x1, y1, x2, y2 },
                            normalized: { x, y, width, height }
                        });
                        
                        // Extract face crop
                        const faceCrop = extractFaceCrop(processingCanvas, { x, y, width, height });
                        
                        // Debug: Check if face crop has actual image data
                        const faceCropCtx = faceCrop.getContext('2d');
                        if (faceCropCtx) {
                            const faceCropData = faceCropCtx.getImageData(0, 0, faceCrop.width, faceCrop.height);
                            const avgPixelValue = Array.from(faceCropData.data).reduce((a, b) => a + b, 0) / faceCropData.data.length;
                            console.log('🖼️ Face crop canvas:', {
                                width: faceCrop.width,
                                height: faceCrop.height,
                                avgPixelValue: avgPixelValue.toFixed(2),
                                firstPixels: Array.from(faceCropData.data.slice(0, 12))
                            });
                        }
                        
                        // Generate embedding
                        const faceTensor = tf.browser.fromPixels(faceCrop);
                        const embedding = generateFaceEmbeddingClient(faceTensor);
                        faceTensor.dispose();
                        
                        // Debug: Check embedding quality and compare with stored
                        const embeddingArray = Array.from(embedding);
                        const nonZeroCount = embeddingArray.filter(v => Math.abs(v) > 0.01).length;
                        const embeddingMean = embeddingArray.reduce((a, b) => a + b, 0) / embedding.length;
                        const embeddingStd = Math.sqrt(embeddingArray.reduce((sum, v) => sum + Math.pow(v - embeddingMean, 2), 0) / embedding.length);
                        
                        console.group('📸 Generated Embedding Analysis');
                        console.log('Length:', embedding.length);
                        console.log('Non-zero values:', nonZeroCount, `(${(nonZeroCount/embedding.length*100).toFixed(1)}%)`);
                        console.log('Mean:', embeddingMean.toFixed(4));
                        console.log('Std Dev:', embeddingStd.toFixed(4));
                        console.log('Min:', Math.min(...embeddingArray).toFixed(4));
                        console.log('Max:', Math.max(...embeddingArray).toFixed(4));
                        console.log('First 10 values:', embeddingArray.slice(0, 10).map(v => v.toFixed(4)));
                        
                        // Compare with stored embeddings
                        if (storedEmbeddings.length > 0) {
                            const firstStored = storedEmbeddings[0].embedding;
                            const storedArray: number[] = Array.isArray(firstStored) ? firstStored : Array.from(firstStored as ArrayLike<number>);
                            const storedMean = storedArray.reduce((a, b) => a + b, 0) / storedArray.length;
                            const storedStd = Math.sqrt(storedArray.reduce((sum, v) => sum + Math.pow(v - storedMean, 2), 0) / storedArray.length);
                            
                            console.log('\n📚 Comparing with stored embedding for:', storedEmbeddings[0].studentName);
                            console.log('Stored Mean:', storedMean.toFixed(4), 'vs Generated:', embeddingMean.toFixed(4));
                            console.log('Stored Std:', storedStd.toFixed(4), 'vs Generated:', embeddingStd.toFixed(4));
                            console.log('Stored First 10:', storedArray.slice(0, 10).map(v => v.toFixed(4)));
                            
                            const meanDiff = Math.abs(storedMean - embeddingMean);
                            const stdDiff = Math.abs(storedStd - embeddingStd);
                            
                            if (meanDiff > 1.0 || stdDiff > 1.0) {
                                console.warn('⚠️ LARGE DIFFERENCE detected between generated and stored embeddings!');
                                console.warn('Mean difference:', meanDiff.toFixed(4), '| Std difference:', stdDiff.toFixed(4));
                                console.warn('This indicates client-side and server-side generation are NOT compatible!');
                            }
                        }
                        console.groupEnd();
                        
                        // Match against stored embeddings
                        const match = matchFace(embedding, storedEmbeddings);
                        
                        // Generate stable ID
                        const uid = generateStableFaceId(embedding);
                        
                        // Determine student info
                        let studentName: string | undefined;
                        let matchConfidence = 0;
                        let isPotentialMatch = false;
                        let isWrongBus = false;
                        let correctBusName: string | undefined;
                        
                        if (match) {
                            studentName = match.studentName;
                            matchConfidence = match.confidence;
                            isPotentialMatch = match.isPotentialMatch;
                            
                            // Check if student is on correct bus
                            const studentInfo = allStudents.find(s => s.name === studentName);
                            if (studentInfo) {
                                isWrongBus = studentInfo.busId !== busId;
                                if (isWrongBus && busDataState[studentInfo.busId]) {
                                    correctBusName = busDataState[studentInfo.busId].name;
                                }
                            }
                        }
                        
                        processedFaces.push({
                            boundingBox: {
                                x: x / processingCanvas.width,
                                y: y / processingCanvas.height,
                                width: width / processingCanvas.width,
                                height: height / processingCanvas.height,
                            },
                            confidence: prediction.probability ? prediction.probability[0] : 0.9,
                            matchConfidence,
                            isPotentialMatch,
                            name: studentName,
                            uid,
                            isRecognized: !!studentName && !isPotentialMatch,
                            isWrongBus,
                            correctBusName,
                        });
                    }

                    setDetectedFaces(processedFaces);
                    
                    if (processedFaces.length > 0) {
                        console.log(`Processed ${processedFaces.length} faces with matches:`, processedFaces);
                    }

                    processedFaces.forEach((face: Face) => {
                        handleRecognitionEvent(face, processingCanvas.toDataURL('image/jpeg', 0.7));
                    });

                    // OPTIMIZED: Adaptive delay based on detection
                    // If faces detected: scan faster (2s) for better tracking
                    // If no faces: scan slower (4s) to save resources
                    const adaptiveDelay = processedFaces.length > 0 ? 2000 : 4000;
                    setTimeout(() => setIsProcessing(false), adaptiveDelay);

                } catch (error) {
                    console.error("Error during face scan:", error);
                    throttledToast('scan-error', {
                        variant: 'destructive',
                        title: "Face Detection Error",
                        description: "Could not process camera feed for face detection.",
                    }, 10000); // Only show once per 10 seconds
                    
                    // On error, wait longer before trying again
                    setTimeout(() => setIsProcessing(false), 5000);
                }
            }
        }
        
        animationFrameId.current = requestAnimationFrame(scanLoop);
    }, [isScanning, detectedFaces, isProcessing, handleRecognitionEvent, registeredFaces, allStudents, busId, scanningEnabled, throttledToast]);

    useEffect(() => {
        if (scanningEnabled && cameraInitialized && hasCameraPermission) {
            setIsScanning(true);
            animationFrameId.current = requestAnimationFrame(scanLoop);
        } else {
            setIsScanning(false);
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        }
        return () => {
            if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        }
    }, [scanningEnabled, cameraInitialized, hasCameraPermission, scanLoop]);

    // Auto-start scanning when camera is ready (location permission optional for face recognition)
    useEffect(() => {
        console.log('Auto-start check:', { cameraInitialized, hasCameraPermission, hasLocationPermission, readyToScan, scanningEnabled });
        if (cameraInitialized && hasCameraPermission && readyToScan && !scanningEnabled) {
            console.log('Auto-starting facial recognition scanning');
            setScanningEnabled(true);
        }
    }, [cameraInitialized, hasCameraPermission, hasLocationPermission, readyToScan, scanningEnabled]);

    const checkCameraPermissions = useCallback(async () => {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });
            if (permissionStatus.state === 'denied') {
                toast({
                    variant: 'destructive',
                    title: 'Camera Permission Denied',
                    description: 'Camera access is blocked. Please reset permissions in your browser settings.',
                });
            } else if (permissionStatus.state === 'prompt') {
                toast({
                    title: 'Camera Permission Needed',
                    description: 'Please allow camera access when prompted.',
                });
            }
        } catch (error) {
            console.error('Error checking camera permissions:', error);
        }
    }, [toast]);

    useEffect(() => {
        checkCameraPermissions();
    }, [checkCameraPermissions]);

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera className="h-6 w-6 text-primary" />
                        <CardTitle>Facial Recognition</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isScanning ? "default" : scanningEnabled ? "outline" : "secondary"}>
                            {isScanning ? "Active" : scanningEnabled ? "Starting..." : "Inactive"}
                        </Badge>
                        <Badge variant="secondary">
                            Detected: {detectedFaces.length}
                        </Badge>
                        {cameraInitialized && (
                            <Badge variant="outline" className="text-green-600">
                                Camera Ready
                            </Badge>
                        )}
                        {embeddingsLoaded && (
                            <Badge 
                                variant={storedEmbeddings.length > 0 ? "default" : "destructive"}
                                className={storedEmbeddings.length > 0 ? "bg-green-600" : ""}
                            >
                                {storedEmbeddings.length} Registered
                            </Badge>
                        )}
                    </div>
                </div>
                <CardDescription>
                    Real-time student recognition and attendance tracking system.
                    {embeddingsLoaded && storedEmbeddings.length === 0 && (
                        <span className="text-red-600 font-semibold ml-2">
                            ⚠️ No registered faces found. Please register students first.
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative group">
                    <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />

                    {/* Initial overlay prompting user to start */}
                    {!readyToScan && isPrimarySession && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
                            <Camera className="h-10 w-10 text-white mb-4" />
                            <p className="text-white mb-4">Facial Recognition</p>
                            <Button onClick={() => setReadyToScan(true)} variant="outline">
                                Start Camera
                            </Button>
                        </div>
                    )}
                    
                    {/* Read-only mode overlay */}
                    {!isPrimarySession && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
                            <Camera className="h-10 w-10 text-muted-foreground mb-4" />
                            <p className="text-white mb-2 font-semibold">Read-Only Mode</p>
                            <p className="text-white/70 text-sm text-center px-4">
                                Camera access is controlled by another device
                            </p>
                        </div>
                    )}

                    {/* Scanning control overlay */}
                    {readyToScan && hasCameraPermission && !isProcessing && (
                        <div className="absolute top-2 right-2 z-20">
                            <Button 
                                onClick={() => setScanningEnabled(!scanningEnabled)}
                                variant={scanningEnabled ? "destructive" : "default"}
                                size="sm"
                                className={scanningEnabled ? "animate-pulse" : ""}
                            >
                                {scanningEnabled ? "Stop Scanning" : "Start Scanning"}
                            </Button>
                        </div>
                    )}

                    {/* Face detection guide */}
                    {isScanning && detectedFaces.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
                            <div className="relative">
                                {/* Guide oval */}
                                <div className="w-48 h-56 border-4 border-dashed border-yellow-400/60 rounded-full"></div>
                                {/* Help text */}
                                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                                    Position your face here
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scanning indicator */}
                    {isScanning && (
                        <div className="absolute top-2 left-2 z-20">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm ${
                                detectedFaces.length > 0 ? 'bg-green-500/80' : 'bg-yellow-500/80'
                            } text-white`}>
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                {detectedFaces.length > 0 ? 'Face Detected' : 'Looking for faces...'}
                            </div>
                        </div>
                    )}

                    {hasCameraPermission === false && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
                            <Camera className="h-10 w-10 text-muted-foreground mb-4" />
                            <Alert variant="destructive" className="mt-4 max-w-sm">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Camera Access Required</AlertTitle>
                                <AlertDescription>
                                    Please enable camera permissions to use facial recognition.
                                </AlertDescription>
                            </Alert>
                            <Button 
                                onClick={startCamera} 
                                className="mt-4"
                                variant="outline"
                            >
                                Request Camera Access
                            </Button>
                        </div>
                    )}
                    {hasLocationPermission === false && readyToScan && hasCameraPermission && (
                        <div className="absolute bottom-2 left-2 z-20">
                            <Alert variant="default" className="max-w-sm bg-amber-50 border-amber-200">
                                <MapPin className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">Location Optional</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                    Face recognition works without location. Enable location for attendance tracking.
                                    <Button onClick={requestLocation} size="sm" variant="outline" className="ml-2">
                                        Enable
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {/* Processing overlay - less intrusive */}
                    {isProcessing && (
                        <div className="absolute top-2 left-2 flex items-center justify-center bg-black/30 rounded-md p-2">
                            <Camera className="h-5 w-5 animate-spin text-primary mr-2" />
                            <span className="text-xs text-white">Processing...</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}