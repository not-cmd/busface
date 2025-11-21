import { db } from './firebase';
import { ref, set, get, remove, onValue, serverTimestamp, Database } from 'firebase/database';

export interface StaffSession {
    staffId: string;
    busId: string;
    sessionId: string;
    deviceInfo: string;
    loginTime: number;
    lastActive: number;
    isPrimary: boolean; // Primary session has camera access
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get device information for session tracking
 */
export function getDeviceInfo(): string {
    const ua = navigator.userAgent;
    let device = 'Unknown Device';
    
    if (/mobile/i.test(ua)) {
        device = 'Mobile';
    } else if (/tablet/i.test(ua)) {
        device = 'Tablet';
    } else {
        device = 'Desktop';
    }
    
    // Get browser info
    let browser = 'Unknown Browser';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    return `${device} - ${browser}`;
}

/**
 * Check if a staff member already has an active session
 */
export async function checkExistingSession(staffId: string, busId: string): Promise<StaffSession | null> {
    const sessionsRef = ref(db, `staffSessions/${busId}`);
    const snapshot = await get(sessionsRef);
    
    if (snapshot.exists()) {
        const sessions = snapshot.val();
        // Find any session for this staff member
        for (const sessionId in sessions) {
            const session = sessions[sessionId] as StaffSession;
            if (session.staffId === staffId) {
                // Check if session is still active (within last 10 minutes - increased for stability)
                const now = Date.now();
                if (now - session.lastActive < 10 * 60 * 1000) {
                    return session;
                } else {
                    // Clean up stale session
                    await remove(ref(db, `staffSessions/${busId}/${sessionId}`));
                }
            }
        }
    }
    
    return null;
}

/**
 * Create a new session for a staff member
 */
export async function createSession(
    staffId: string, 
    busId: string, 
    isPrimary: boolean = true
): Promise<string> {
    const sessionId = generateSessionId();
    const sessionRef = ref(db, `staffSessions/${busId}/${sessionId}`);
    
    const session: StaffSession = {
        staffId,
        busId,
        sessionId,
        deviceInfo: getDeviceInfo(),
        loginTime: Date.now(),
        lastActive: Date.now(),
        isPrimary
    };
    
    await set(sessionRef, session);
    
    // Store session ID in localStorage for cleanup
    localStorage.setItem('staffSessionId', sessionId);
    
    return sessionId;
}

/**
 * Update session's last active timestamp
 */
export async function updateSessionActivity(busId: string, sessionId: string): Promise<void> {
    const sessionRef = ref(db, `staffSessions/${busId}/${sessionId}`);
    const snapshot = await get(sessionRef);
    
    if (snapshot.exists()) {
        await set(ref(db, `staffSessions/${busId}/${sessionId}/lastActive`), Date.now());
    }
}

/**
 * Remove a session (logout or takeover)
 */
export async function removeSession(busId: string, sessionId: string): Promise<void> {
    const sessionRef = ref(db, `staffSessions/${busId}/${sessionId}`);
    await remove(sessionRef);
    
    // Clear from localStorage if it's the current session
    if (localStorage.getItem('staffSessionId') === sessionId) {
        localStorage.removeItem('staffSessionId');
    }
}

/**
 * Take over an existing session (become primary)
 */
export async function takeOverSession(
    staffId: string, 
    busId: string, 
    existingSessionId: string
): Promise<string> {
    // Remove the existing session
    await removeSession(busId, existingSessionId);
    
    // Create new primary session
    return await createSession(staffId, busId, true);
}

/**
 * Check if current session is primary (has camera access)
 */
export async function isPrimarySession(busId: string, sessionId: string): Promise<boolean> {
    const sessionRef = ref(db, `staffSessions/${busId}/${sessionId}`);
    const snapshot = await get(sessionRef);
    
    if (snapshot.exists()) {
        const session = snapshot.val() as StaffSession;
        return session.isPrimary === true;
    }
    
    return false;
}

/**
 * Listen for session changes (to detect takeovers)
 */
export function listenToSessionChanges(
    busId: string, 
    sessionId: string, 
    onSessionRemoved: () => void
): () => void {
    const sessionRef = ref(db, `staffSessions/${busId}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Session was removed (taken over by another device)
            onSessionRemoved();
        }
    });
    
    return unsubscribe;
}

/**
 * Get all active sessions for a bus
 */
export async function getActiveSessions(busId: string): Promise<StaffSession[]> {
    const sessionsRef = ref(db, `staffSessions/${busId}`);
    const snapshot = await get(sessionsRef);
    
    if (snapshot.exists()) {
        const sessions = snapshot.val();
        return Object.values(sessions) as StaffSession[];
    }
    
    return [];
}

/**
 * Clean up stale sessions (older than 10 minutes of inactivity - increased for stability)
 */
export async function cleanupStaleSessions(busId: string): Promise<void> {
    const sessionsRef = ref(db, `staffSessions/${busId}`);
    const snapshot = await get(sessionsRef);
    
    if (snapshot.exists()) {
        const sessions = snapshot.val();
        const now = Date.now();
        const staleThreshold = 10 * 60 * 1000; // 10 minutes - more forgiving for development and network issues
        
        for (const sessionId in sessions) {
            const session = sessions[sessionId] as StaffSession;
            if (now - session.lastActive > staleThreshold) {
                console.log(`Cleaning up stale session: ${sessionId} (inactive for ${Math.round((now - session.lastActive) / 60000)} minutes)`);
                await removeSession(busId, sessionId);
            }
        }
    }
}
