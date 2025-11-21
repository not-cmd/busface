'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, CheckCircle, Loader2, Volume2, VolumeX } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/firebase';
import { ref as dbRef, set, push } from 'firebase/database';
import { generateFaceEmbeddingAction } from '@/app/actions';

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
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();
  const capturedImagesRef = useRef<string[]>([]);
  const isComponentMounted = useRef(true);

  const cleanupCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
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
    if (audioRef.current) {
      audioRef.current.play().catch(e => {
        // Silently handle audio errors - sound is not critical for functionality
        console.log("Audio not available:", e.message);
      });
    }
  };

  const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    // Trigger haptic feedback (vibration) if supported
    if ('vibrate' in navigator) {
      const patterns = {
        light: 50,
        medium: 100,
        heavy: [100, 50, 100]
      };
      navigator.vibrate(patterns[intensity]);
    }
  };

  const speak = (text: string) => {
    // Check if voice is enabled
    if (!voiceEnabled) return;
    
    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Create and speak the text
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Try to use a pleasant voice (fallback to default)
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Female') || voice.name.includes('Samantha')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      // Add event listeners
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const showNotification = (title: string, body: string) => {
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/images/Bus.png',
        badge: '/images/Bus.png',
        tag: 'face-registration'
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const finishRegistration = useCallback(async () => {
    if (!isComponentMounted.current) return;
    setIsRegistering(false);
    cleanupCamera();
    
    if(capturedImagesRef.current.length < 5) {
        toast({ variant: 'destructive', title: "Registration Failed", description: "Not enough images were captured. Please try again." });
        speak("Registration failed. Please try again.");
        triggerHaptic('heavy');
        return;
    }

    setIsSubmitting(true);
    
    // Celebrate completion with haptic and voice
    triggerHaptic('heavy');
    speak("Perfect! Registration complete. Processing your facial data.");
    
    // Store photos immediately and show success
    const pendingFacesRef = dbRef(db, `pendingFaceRegistrations`);
    const newPendingRef = push(pendingFacesRef);
    
    try {
        // Save with processing status first
        await set(newPendingRef, {
            studentId,
            studentName,
            status: 'processing',
            photos: capturedImagesRef.current,
            embeddings: [],
            timestamp: new Date().toISOString(),
            embeddingCount: 0
        });

        toast({
            title: "Registration Submitted!",
            description: "Processing face embeddings in the background. You'll be notified when ready for review.",
            className: 'bg-green-100 border-green-300 text-green-800'
        });

        // Show browser notification
        showNotification(
            "Face Registration Complete!",
            `${studentName}'s face has been registered successfully. Processing embeddings...`
        );

        // Capture photos in a local variable BEFORE clearing the ref
        const capturedPhotos = [...capturedImagesRef.current];

        if(isComponentMounted.current) {
            setIsSubmitting(false);
            setCurrentPromptIndex(0);
            capturedImagesRef.current = [];
        }

        // Process embeddings in the background (non-blocking)
        (async () => {
            try {
                console.log('🔄 Starting background embedding generation...');
                console.log(`📸 Processing ${capturedPhotos.length} photos`);
                
                const embeddingPromises = capturedPhotos.map(async (photoDataUri, index) => {
                  console.log(`🔄 Generating embedding ${index + 1}/${capturedPhotos.length}...`);
                  const result = await generateFaceEmbeddingAction(photoDataUri, studentId, studentName);
                  console.log(`${result.success ? '✅' : '❌'} Embedding ${index + 1}/${capturedPhotos.length}: ${result.success ? 'Success' : result.error}`);
                  return {
                    photoDataUri,
                    embedding: result.embedding,
                    uid: result.uid,
                    success: result.success,
                    error: result.error,
                    index
                  };
                });

                const embeddingResults = await Promise.all(embeddingPromises);
                const successfulEmbeddings = embeddingResults.filter(result => result.success);
                const failedEmbeddings = embeddingResults.filter(result => !result.success);

                console.log(`✅ Generated ${successfulEmbeddings.length}/${embeddingResults.length} embeddings`);
                if (failedEmbeddings.length > 0) {
                    console.error(`❌ Failed embeddings:`, failedEmbeddings.map(e => e.error));
                }

                // Update the pending registration with embeddings
                await set(newPendingRef, {
                    studentId,
                    studentName,
                    status: successfulEmbeddings.length > 0 ? 'pending' : 'failed',
                    photos: capturedPhotos,
                    embeddings: successfulEmbeddings.map(result => ({
                      photoDataUri: result.photoDataUri,
                      embedding: result.embedding,
                      uid: result.uid
                    })),
                    timestamp: new Date().toISOString(),
                    embeddingCount: successfulEmbeddings.length,
                    processingCompleted: new Date().toISOString(),
                    failedCount: failedEmbeddings.length,
                    errors: failedEmbeddings.map(e => e.error)
                });

                console.log('✅ Background processing complete, registration updated');
                
                // Notify user of completion
                showNotification(
                    "Face Registration Ready!",
                    `${studentName}'s face embeddings have been processed. Ready for admin review.`
                );

            } catch (error) {
                console.error("❌ Error in background embedding generation:", error);
                // Update status to failed
                await set(newPendingRef, {
                    studentId,
                    studentName,
                    status: 'failed',
                    photos: capturedPhotos,
                    embeddings: [],
                    timestamp: new Date().toISOString(),
                    embeddingCount: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    processingCompleted: new Date().toISOString()
                });
            }
        })();

    } catch (error) {
        console.error("Error submitting face for registration:", error);
        toast({ variant: 'destructive', title: "Submission Failed", description: "Could not submit facial registration data." });
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
          const video = videoRef.current;
          
          // Optimize image size for upload
          const maxWidth = 640;
          const maxHeight = 480;
          const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight, 1);
          
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          
          const context = canvas.getContext('2d');
          if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // Reduced quality to 50%
              capturedImagesRef.current.push(dataUrl);
              
              // Trigger haptic feedback on capture
              triggerHaptic('light');
          }
      }
  }, []);
    
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    
    if (isRegistering) {
        // Speak the current prompt
        speak(prompts[currentPromptIndex].text);
        
        if (currentPromptIndex < prompts.length - 1) {
            interval = setInterval(() => {
                if(isComponentMounted.current) {
                    captureImage();
                    playSound();
                    triggerHaptic('medium');
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

    // Request notification permission upfront
    await requestNotificationPermission();

    try {
      // First check if we have permission
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (permissions.state === 'denied') {
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings and refresh the page.',
        });
        speak("Camera access denied. Please enable camera permissions.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } 
      });
      
      if (!isComponentMounted.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      setHasCameraPermission(true);
      triggerHaptic('light');
      speak("Camera ready. Starting face registration.");
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onplaying = () => {
             // This ensures we only start the process when the video is ready
             setTimeout(() => {
                if (isComponentMounted.current) {
                    setIsRegistering(true);
                    playSound();
                    triggerHaptic('medium');
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
      speak("Error accessing camera. Please check your settings.");
    }
  };
  
  const currentPrompt = prompts[currentPromptIndex];
  const PromptIcon = currentPrompt.icon;

  return (
    <Card className="mt-4 border-2 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Camera className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">AI Face Registration</CardTitle>
            <CardDescription className="text-base mt-1">
              Register your child's face for automated, AI-powered attendance tracking
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <audio ref={audioRef} src="/sounds/ting.mp3" preload="auto"></audio>

        {/* Instructions Card */}
        {!isRegistering && !isSubmitting && (
          <div className="mb-6 space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">i</span>
                  How it works
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className="flex items-center gap-2"
                >
                  {voiceEnabled ? (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Voice On
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4" />
                      Voice Off
                    </>
                  )}
                </Button>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground ml-8">
                <li>• Position your face in the center of the camera frame</li>
                <li>• Follow the on-screen instructions to capture multiple angles</li>
                <li>• Keep your face well-lit and clearly visible</li>
                <li>• The process takes about 15 seconds</li>
                {voiceEnabled && (
                  <li className="text-cyan-600 dark:text-cyan-400 font-medium">• Voice guidance will help you through each step</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Video Preview */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-black shadow-xl">
          <video 
            ref={videoRef} 
            className="w-full h-full object-contain -scale-x-100" 
            autoPlay 
            muted 
            playsInline 
          />
          
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6">
               <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md">
                 <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                 <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                 <p className="text-sm text-muted-foreground mb-4">
                   Please allow camera access in your browser to use face registration.
                 </p>
                 <Button onClick={startRegistration} variant="outline" className="w-full">
                   <Camera className="mr-2 h-4 w-4" />
                   Grant Camera Access
                 </Button>
               </div>
            </div>
          )}

          {isRegistering && (
             <>
                {/* Scanning Effect */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-cyan-500/10 animate-pulse" />
                </div>
                
                {/* Face Detection Oval */}
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                     <div className="w-64 h-80 border-4 border-cyan-400/70 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.5)] animate-pulse" />
                </div>
                
                {/* Corner Brackets */}
                <div className="absolute top-6 left-6 w-12 h-12 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg animate-[pulse_2s_infinite]"></div>
                <div className="absolute top-6 right-6 w-12 h-12 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg animate-[pulse_2s_infinite_0.2s]"></div>
                <div className="absolute bottom-6 left-6 w-12 h-12 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg animate-[pulse_2s_infinite_0.4s]"></div>
                <div className="absolute bottom-6 right-6 w-12 h-12 border-b-4 border-r-4 border-cyan-400 rounded-br-lg animate-[pulse_2s_infinite_0.6s]"></div>
                
                {/* Scanning Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[scan_3s_ease-in-out_infinite]" />
                
                {/* Status Badge */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                  <div className="bg-cyan-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Scanning Face...
                  </div>
                </div>
             </>
          )}
          
          {/* Submitting Overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30">
              <Loader2 className="h-16 w-16 text-cyan-400 animate-spin mb-4" />
              <p className="text-white text-lg font-semibold">Processing Registration...</p>
              <p className="text-gray-300 text-sm mt-2">Generating face embeddings</p>
            </div>
          )}
        </div>

        {/* Instructions During Scan */}
        {isRegistering && (
            <div className="mt-6 space-y-4">
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 p-6 rounded-lg border-2 border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">{currentPrompt.text}</p>
                      {voiceEnabled && isSpeaking && (
                        <div className="flex items-center gap-1">
                          <Volume2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                          <div className="flex gap-1">
                            <div className="w-1 h-4 bg-cyan-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]"></div>
                            <div className="w-1 h-4 bg-cyan-500 rounded-full animate-[bounce_0.6s_ease-in-out_0.1s_infinite]"></div>
                            <div className="w-1 h-4 bg-cyan-500 rounded-full animate-[bounce_0.6s_ease-in-out_0.2s_infinite]"></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-full">
                      Step {currentPromptIndex + 1} of {prompts.length}
                    </div>
                  </div>
                  <Progress value={currentPrompt.progress} className="h-3" />
                </div>
                
                <div className="flex items-center justify-center">
                   {PromptIcon && (
                     <div className="relative">
                       <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl"></div>
                       <PromptIcon className="h-32 w-32 text-cyan-500 relative animate-bounce" strokeWidth={1.5} />
                     </div>
                   )}
                </div>
            </div>
        )}

        {/* Start Button */}
        {!isRegistering && (
             <div className="mt-6 flex flex-col items-center gap-4">
                 <Button 
                   onClick={startRegistration} 
                   size="lg" 
                   disabled={isSubmitting}
                   className="px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                 >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Submitting Registration...
                        </>
                    ) : (
                        <>
                            <Camera className="mr-2 h-5 w-5" />
                            Start Face Registration
                        </>
                    )}
                 </Button>
                 
                 {!isSubmitting && (
                   <p className="text-sm text-muted-foreground text-center max-w-md">
                     By starting registration, you consent to capturing and processing facial data for attendance tracking purposes.
                   </p>
                 )}
             </div>
        )}
      </CardContent>
    </Card>
  );
}
