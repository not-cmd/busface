'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, CheckCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/firebase';
import { ref as dbRef, set, push } from 'firebase/database';

const prompts = [
  { text: 'Please look directly at the camera.', icon: null, progress: 0 },
  { text: 'Slowly turn your head to the right.', icon: ArrowRight, progress: 20 },
  { text: 'Slowly turn your head to the left.', icon: ArrowLeft, progress: 40 },
  { text: 'Slowly tilt your head up.', icon: ArrowUp, progress: 60 },
  { text: 'Slowly tilt your head down.', icon: ArrowDown, progress: 80 },
  { text: 'Great! All done.', icon: CheckCircle, progress: 100 },
];

interface FaceRegistrationProps {
    studentId: string;
    studentName: string;
}

export function FaceRegistration({ studentId, studentName }: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const { toast } = useToast();
  const capturedImagesRef = useRef<string[]>([]);
  const isComponentMounted = useRef(true);

  const cleanupCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      cleanupCamera();
    };
  }, [cleanupCamera]);

  const playSound = () => {
    audioRef.current?.play().catch(e => console.error("Error playing sound:", e));
  }

  const finishRegistration = useCallback(async () => {
    if (!isComponentMounted.current) return;
    setIsRegistering(false);
    cleanupCamera();
    
    if(capturedImagesRef.current.length < 5) {
        toast({ variant: 'destructive', title: "Registration Failed", description: "Not enough images were captured. Please try again." });
        return;
    }

    setIsSubmitting(true);
    toast({ title: "Submitting for Approval...", description: "Please wait while we upload your facial data for admin review." });

    try {
        const pendingFacesRef = dbRef(db, `pendingFaceRegistrations`);
        const newPendingRef = push(pendingFacesRef);
        
        await set(newPendingRef, {
            studentId,
            studentName,
            status: 'pending',
            photos: capturedImagesRef.current,
            timestamp: new Date().toISOString()
        });

        toast({
            title: "Registration Submitted!",
            description: "An administrator will review your photos. You will be notified upon approval.",
            className: 'bg-green-100 border-green-300 text-green-800'
        });

    } catch (error) {
        console.error("Error submitting face for registration:", error);
        toast({ variant: 'destructive', title: "Submission Failed", description: "Could not submit facial registration data." });
    } finally {
        if(isComponentMounted.current) {
            setIsSubmitting(false);
            setCurrentPromptIndex(0);
            capturedImagesRef.current = [];
        }
    }
  }, [cleanupCamera, studentId, studentName, toast]);

  const captureImage = useCallback(() => {
      if (videoRef.current && videoRef.current.readyState >= 3 && videoRef.current.videoWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const context = canvas.getContext('2d');
          if (context) {
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              capturedImagesRef.current.push(dataUrl);
          }
      }
  }, []);
    
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    
    if (isRegistering) {
        if (currentPromptIndex < prompts.length - 1) {
            interval = setInterval(() => {
                if(isComponentMounted.current) {
                    captureImage();
                    playSound();
                    setCurrentPromptIndex(prev => prev + 1);
                }
            }, 3000); 
        } else {
            captureImage();
            setTimeout(finishRegistration, 1000);
        }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRegistering, currentPromptIndex, finishRegistration, captureImage]);

  const startRegistration = async () => {
    if (isRegistering || isSubmitting) return;

    setCurrentPromptIndex(0);
    capturedImagesRef.current = [];
    setHasCameraPermission(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!isComponentMounted.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onplaying = () => {
             // This ensures we only start the process when the video is ready
             setTimeout(() => {
                if (isComponentMounted.current) {
                    setIsRegistering(true);
                    playSound();
                }
             }, 500); // A small delay to ensure rendering
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      if (isComponentMounted.current) setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  };
  
  const currentPrompt = prompts[currentPromptIndex];
  const PromptIcon = currentPrompt.icon;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>AI Face Registration</CardTitle>
        <CardDescription>
          Register your child's face for automated, AI-powered attendance tracking.
          Follow the on-screen prompts to complete the process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <audio ref={audioRef} src="/sounds/ting.mp3" preload="auto"></audio>

        <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-black flex items-center justify-center group">
          <video ref={videoRef} className="w-full h-full object-contain -scale-x-100" autoPlay muted playsInline />
          
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center p-4">
               <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access to use this feature.
                  </AlertDescription>
              </Alert>
            </div>
          )}

          {isRegistering && (
             <>
                <div className="absolute inset-0 z-10 pointer-events-none hologram-grid" />
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                     <div className="w-48 h-64 border-2 border-cyan-400/50 rounded-full animate-pulse" />
                </div>
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-400 animate-[pulse_2s_infinite]"></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-400 animate-[pulse_2s_infinite_0.2s]"></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-400 animate-[pulse_2s_infinite_0.4s]"></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-400 animate-[pulse_2s_infinite_0.6s]"></div>
             </>
          )}
        </div>

        {isRegistering ? (
            <div className="mt-4 text-center space-y-4">
                <p className="text-lg font-semibold text-primary">{currentPrompt.text}</p>
                <Progress value={currentPrompt.progress} className="w-1/2 mx-auto" />
                <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                   {PromptIcon && <PromptIcon className="h-24 w-24 text-cyan-400 animate-float" />}
                </div>
            </div>
        ) : (
             <div className="mt-4 flex justify-center">
                 <Button onClick={startRegistration} size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                        </>
                    ) : "Start Face Registration"}
                 </Button>
             </div>
        )}
      </CardContent>
    </Card>
  );
}
