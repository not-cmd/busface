'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Video, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { detectFaceAction } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { StudentJson as StudentType } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref as dbRef, set, push, get, serverTimestamp, update } from 'firebase/database';
import busData from '@/lib/buses.json';
import { format } from 'date-fns';

interface LiveFeedProps {
    busId: string;
    studentsOnBus: StudentType[];
}

interface Face {
    boundingBox: { x: number; y: number; width: number; height: number; };
    confidence: number;
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

export function LiveFeed({ busId, studentsOnBus }: LiveFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const { toast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const animationFrameId = useRef<number | null>(null);
    const [detectedFaces, setDetectedFaces] = useState<Face[]>([]);
    const lastRecognitionTime = useRef<Record<string, number>>({});
    const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>([]);
    const [allStudents, setAllStudents] = useState<StudentType[]>([]);


     useEffect(() => {
        const studentsRef = dbRef(db, 'students');
        get(studentsRef).then(snapshot => {
            if (snapshot.exists()) {
                setAllStudents(Object.values(snapshot.val()));
            }
        });

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
    
    const startCamera = useCallback(async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setHasCameraPermission(true);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        setIsScanning(true);
                    };
                }
            } else {
                throw new Error('Camera not supported');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
                variant: 'destructive',
                title: 'Camera Access Denied',
                description: 'Please enable camera permissions to use this feature.',
            });
        }
    }, [toast]);

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
        startCamera();
        return () => {
            stopCamera();
        };
    }, [startCamera, stopCamera]);


    const handleRecognitionEvent = useCallback(async (face: Face, snapshotDataUrl: string) => {
        const now = Date.now();
        const recognitionCooldown = 60000; // 1 minute cooldown per UID
    
        if (now - (lastRecognitionTime.current[face.uid] || 0) < recognitionCooldown) {
            return; // Cooldown active for this face
        }
        lastRecognitionTime.current[face.uid] = now;
    
        try {
            if (face.name && !face.isWrongBus) {
                // Handle correctly recognized student
                 const student = studentsOnBus.find(s => s.name === face.name);
                 if (!student) return;

                // 1. Update Attendance Record
                const today = format(new Date(), 'yyyy-MM-dd');
                const attendanceRef = dbRef(db, `attendance/${today}/${student.studentId}`);
                await update(attendanceRef, {
                    status: 'On Board',
                    entry: format(new Date(), 'hh:mm a'),
                    source: 'AIAttendance'
                });

                // 2. Update Student Event for Parent Snapshot
                const studentEventRef = dbRef(db, `studentEvents/${student.studentId}`);
                await set(studentEventRef, {
                    latestSnapshotUrl: snapshotDataUrl,
                    timestamp: new Date().toISOString(),
                    eventType: 'OnboardRecognition'
                });
                
                console.log(`Attendance updated and snapshot sent for ${face.name}.`);
                toast({ title: `Recognized: ${face.name}`, description: 'Attendance marked as "On Board".' });

            } else if (!face.name) {
                // Handle intruder
                const intruderAlertsRef = dbRef(db, `intruderAlerts`);
                const newIntruderRef = push(intruderAlertsRef);
                
                await set(newIntruderRef, {
                    snapshotUrl: snapshotDataUrl,
                    timestamp: new Date().toISOString(),
                    faceUid: face.uid,
                    busId: busId
                });
                 console.log(`Intruder with UID ${face.uid} detected and reported.`);
                 toast({ variant: 'destructive', title: `Intruder Alert!`, description: `Unrecognized person detected on Bus ${busId}. Snapshot saved.` });
            }

        } catch (error) {
            console.error('Error in recognition event process:', error);
        }
    }, [busId, toast, studentsOnBus]);


    const scanLoop = useCallback(async () => {
        if (!isScanning || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
            animationFrameId.current = requestAnimationFrame(scanLoop);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            detectedFaces.forEach(face => {
                const { x, y, width, height } = face.boundingBox;
                const absX = x * canvas.width;
                const absY = y * canvas.height;
                const absWidth = width * canvas.width;
                const absHeight = height * canvas.height;

                context.lineWidth = 3;
                let color = 'red'; // Intruder
                let label = 'Intruder';

                if (face.isWrongBus) {
                    color = '#3b82f6'; // Blue for wrong bus
                    label = `Wrong bus. Go to ${face.correctBusName || 'your bus'}.`;
                } else if (face.name) {
                    color = 'lime'; // Green for correct student
                    label = face.name;
                }
                
                context.strokeStyle = color;
                context.strokeRect(absX, absY, absWidth, absHeight);
                
                context.fillStyle = color;
                context.font = 'bold 16px Arial';
                context.fillText(label || '', absX, absY > 20 ? absY - 5 : absY + absHeight + 20);
            });

            if (!isProcessing) {
                setIsProcessing(true);
                const photoDataUri = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    const result = await detectFaceAction({ photoDataUri, registeredFaces });
                    
                    const processedFaces = result.faces.map(face => {
                        const studentInfo = allStudents.find(s => s.name === face.name);
                        const isCorrectBus = studentInfo && studentInfo.busId === busId;
                        const isWrongBus = studentInfo && studentInfo.busId !== busId;
                        const correctBusName = isWrongBus ? busData[studentInfo.busId as keyof typeof busData]?.name : undefined;

                        return {
                            ...face,
                            isRecognized: !!face.name,
                            isWrongBus: isWrongBus,
                            correctBusName: correctBusName
                        };
                    });

                    setDetectedFaces(processedFaces);

                    processedFaces.forEach(face => {
                        handleRecognitionEvent(face, photoDataUri);
                    });

                } catch (error) {
                    console.error("Error during face scan:", error);
                } finally {
                    setTimeout(() => setIsProcessing(false), 2000); // Add a small delay to control frequency
                }
            }
        }
        
        animationFrameId.current = requestAnimationFrame(scanLoop);
    }, [isScanning, detectedFaces, isProcessing, handleRecognitionEvent, registeredFaces, allStudents, busId]);

    useEffect(() => {
        if (isScanning) {
            animationFrameId.current = requestAnimationFrame(scanLoop);
        } else {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        }
        return () => {
            if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        }
    }, [isScanning, scanLoop]);
    
    return (
        <Card className="lg:col-span-2">
            <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                <Camera className="h-6 w-6 text-primary" />
                <CardTitle>Live Security Feed</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Faces Detected:</span>
                    <Badge variant="secondary">{detectedFaces.length}</Badge>
                </div>
            </div>
            <CardDescription>Real-time video with student recognition and intruder detection.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="relative group">
                <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 text-white p-2 rounded-md">
                <Video className="h-5 w-5" />
                <span className="font-medium text-sm">{isScanning ? 'Scanning...' : 'Paused'}</span>
                <span className={`relative flex h-3 w-3 ${isScanning ? '' : 'hidden'}`}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                </div>
                {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-md">
                    <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Camera access is required.</p>
                    <Alert variant="destructive" className="mt-4 max-w-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Camera Access Denied</AlertTitle>
                        <AlertDescription>
                            Please enable camera permissions in your browser settings to use this feature.
                        </AlertDescription>
                    </Alert>
                </div>
                )}
            </div>
            </CardContent>
        </Card>
    );
}
