import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStreamOptions = {
    ipCamUrl?: string;
    iceServers?: RTCIceServer[];
    maxRetries?: number;
    retryDelay?: number;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
};

export type CameraStreamState = {
    isConnected: boolean;
    isConnecting: boolean;
    error: Error | null;
};

const defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export function useCameraStream(options: CameraStreamOptions) {
    const {
        ipCamUrl,
        iceServers = defaultIceServers,
        maxRetries = 3,
        retryDelay = 5000,
        onConnect,
        onDisconnect,
        onError
    } = options;

    const [state, setState] = useState<CameraStreamState>({
        isConnected: false,
        isConnecting: false,
        error: null,
    });

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const retryCount = useRef(0);
    const retryTimeout = useRef<NodeJS.Timeout>();

    const cleanup = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (retryTimeout.current) {
            clearTimeout(retryTimeout.current);
        }
    }, []);

    const retryConnection = useRef<() => void>();

    const handleError = useCallback((error: Error) => {
        // Suppress network errors for demo mode (hardware camera not available)
        const isNetworkError = error.message.includes('Failed to fetch') || 
                              error.message.includes('ERR_NAME_NOT_RESOLVED');
        
        if (!isNetworkError) {
            console.warn('Camera stream error:', error.message);
        }
        
        setState(prev => ({ ...prev, error, isConnecting: false }));
        onError?.(error);

        // Don't retry network errors (hardware camera unavailable)
        if (!isNetworkError && retryCount.current < maxRetries) {
            retryCount.current++;
            retryTimeout.current = setTimeout(() => {
                retryConnection.current?.();
            }, retryDelay);
        }
    }, [maxRetries, retryDelay, onError]);

    const initializeWebRTC = useCallback(async () => {
        try {
            cleanup();
            setState(prev => ({ ...prev, isConnecting: true, error: null }));

            if (!ipCamUrl) {
                // If no IP camera URL is provided, try to use local webcam
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                            facingMode: "user"
                        }
                    });

                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        setState(prev => ({
                            ...prev,
                            isConnected: true,
                            isConnecting: false,
                            error: null
                        }));
                        onConnect?.();
                    }
                } catch (error) {
                    handleError(error instanceof Error ? error : new Error('Failed to access webcam'));
                }
                return;
            }

            peerConnection.current = new RTCPeerConnection({ iceServers });

            // Set up WebRTC event handlers
            peerConnection.current.ontrack = (event) => {
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                    setState(prev => ({
                        ...prev,
                        isConnected: true,
                        isConnecting: false,
                        error: null
                    }));
                    onConnect?.();
                    retryCount.current = 0;
                }
            };

            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    // Send the ICE candidate to the signaling server
                    // This will depend on your specific signaling implementation
                }
            };

            peerConnection.current.onconnectionstatechange = () => {
                const state = peerConnection.current?.connectionState;
                if (state === 'disconnected' || state === 'failed') {
                    setState(prev => ({ ...prev, isConnected: false }));
                    onDisconnect?.();
                    handleError(new Error(`WebRTC connection ${state}`));
                }
            };

            // Create and set local description
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);

            // Send the offer to your signaling server and wait for answer
            // This is where you would integrate with your specific signaling server
            const response = await fetch(ipCamUrl, {
                method: 'POST',
                body: JSON.stringify({ offer }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Failed to connect to IP camera');
            }

            const { answer } = await response.json();
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));

        } catch (error) {
            handleError(error instanceof Error ? error : new Error('Failed to initialize camera stream'));
        }
    }, [ipCamUrl, iceServers, cleanup, handleError, onConnect, onDisconnect]);

    // Set up the retry function reference
    retryConnection.current = initializeWebRTC;

    useEffect(() => {
        if (ipCamUrl || (!ipCamUrl && typeof navigator !== 'undefined' && navigator.mediaDevices)) {
            initializeWebRTC();
        }
        return cleanup;
    }, [ipCamUrl, iceServers]); // Remove initializeWebRTC and cleanup from dependencies

    return {
        videoRef,
        state,
        retry: () => {
            retryCount.current = 0;
            initializeWebRTC();
        }
    };
}