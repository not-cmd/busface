import { db } from './firebase';
import { ref, set, push, onValue, remove, get, query, orderByChild, limitToLast, Database } from 'firebase/database';

export type NotificationType = 
  | 'student_boarded'
  | 'student_exited'
  | 'intruder_alert'
  | 'bus_delay'
  | 'emergency'
  | 'attendance_issue'
  | 'system'
  | 'eta_update';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  metadata?: {
    studentId?: string;
    studentName?: string;
    busId?: string;
    busName?: string;
    [key: string]: any;
  };
}

export interface NotificationPreferences {
  studentBoarded: boolean;
  studentExited: boolean;
  intruderAlert: boolean;
  busDelay: boolean;
  emergency: boolean;
  attendanceIssue: boolean;
  system: boolean;
  etaUpdate: boolean;
  soundEnabled: boolean;
  browserNotifications: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  studentBoarded: true,
  studentExited: true,
  intruderAlert: true,
  busDelay: true,
  emergency: true,
  attendanceIssue: true,
  system: true,
  etaUpdate: false,
  soundEnabled: true,
  browserNotifications: true,
};

/**
 * Create a new notification
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  priority: NotificationPriority = 'medium',
  metadata?: Notification['metadata'],
  actionUrl?: string
): Promise<string> {
  const notificationsRef = ref(db, `notifications/${userId}`);
  const newNotificationRef = push(notificationsRef);
  
  const notification: Omit<Notification, 'id'> = {
    userId,
    type,
    priority,
    title,
    message,
    timestamp: Date.now(),
    read: false,
    metadata,
    actionUrl
  };
  
  await set(newNotificationRef, notification);
  
  // Send browser notification if enabled
  await sendBrowserNotification(userId, title, message, priority);
  
  return newNotificationRef.key!;
}

/**
 * Send browser notification
 */
async function sendBrowserNotification(
  userId: string,
  title: string,
  message: string,
  priority: NotificationPriority
): Promise<void> {
  // Check if browser notifications are enabled
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.browserNotifications) return;
  
  // Check if permission is granted
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body: message,
        icon: '/images/Bus.png',
        badge: '/images/Bus.png',
        tag: `notification-${Date.now()}`,
        requireInteraction: priority === 'critical',
        silent: !prefs.soundEnabled
      };
      
      new Notification(title, options);
    }
  }
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  }
  return 'denied';
}

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const prefsRef = ref(db, `notificationPreferences/${userId}`);
  const snapshot = await get(prefsRef);
  
  if (snapshot.exists()) {
    return { ...DEFAULT_PREFERENCES, ...snapshot.val() };
  }
  
  // Set default preferences if not exists
  await set(prefsRef, DEFAULT_PREFERENCES);
  return DEFAULT_PREFERENCES;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  const prefsRef = ref(db, `notificationPreferences/${userId}`);
  const currentPrefs = await getNotificationPreferences(userId);
  await set(prefsRef, { ...currentPrefs, ...preferences });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  const notificationRef = ref(db, `notifications/${userId}/${notificationId}`);
  await set(ref(db, `notifications/${userId}/${notificationId}/read`), true);
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notificationsRef = ref(db, `notifications/${userId}`);
  const snapshot = await get(notificationsRef);
  
  if (snapshot.exists()) {
    const updates: { [key: string]: boolean } = {};
    snapshot.forEach((child) => {
      updates[`${child.key}/read`] = true;
    });
    
    await set(notificationsRef, updates);
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const notificationRef = ref(db, `notifications/${userId}/${notificationId}`);
  await remove(notificationRef);
}

/**
 * Delete all notifications
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  const notificationsRef = ref(db, `notifications/${userId}`);
  await remove(notificationsRef);
}

/**
 * Get all notifications for a user
 */
export async function getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
  const notificationsRef = ref(db, `notifications/${userId}`);
  const notificationsQuery = query(
    notificationsRef,
    orderByChild('timestamp'),
    limitToLast(limit)
  );
  
  const snapshot = await get(notificationsQuery);
  const notifications: Notification[] = [];
  
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      notifications.push({
        id: child.key!,
        ...child.val()
      });
    });
  }
  
  // Sort by timestamp descending (newest first)
  return notifications.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const notifications = await getNotifications(userId);
  return notifications.filter(n => !n.read).length;
}

/**
 * Subscribe to real-time notifications
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notifications: Notification[]) => void
): () => void {
  const notificationsRef = ref(db, `notifications/${userId}`);
  
  const unsubscribe = onValue(notificationsRef, (snapshot) => {
    const notifications: Notification[] = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        notifications.push({
          id: child.key!,
          ...child.val()
        });
      });
    }
    
    // Sort by timestamp descending (newest first)
    onNotification(notifications.sort((a, b) => b.timestamp - a.timestamp));
  });
  
  return unsubscribe;
}

/**
 * Helper functions for common notification scenarios
 */

export async function notifyStudentBoarded(
  parentId: string,
  studentName: string,
  studentId: string,
  busName: string,
  busId: string
): Promise<string> {
  return createNotification(
    parentId,
    'student_boarded',
    `${studentName} Boarded Bus`,
    `${studentName} has boarded ${busName}`,
    'medium',
    { studentName, studentId, busName, busId },
    `/dashboard/parent`
  );
}

export async function notifyStudentExited(
  parentId: string,
  studentName: string,
  studentId: string,
  busName: string,
  busId: string
): Promise<string> {
  return createNotification(
    parentId,
    'student_exited',
    `${studentName} Exited Bus`,
    `${studentName} has safely exited ${busName}`,
    'medium',
    { studentName, studentId, busName, busId },
    `/dashboard/parent`
  );
}

export async function notifyIntruderAlert(
  userIds: string[],
  busName: string,
  busId: string
): Promise<void> {
  const promises = userIds.map(userId =>
    createNotification(
      userId,
      'intruder_alert',
      'Intruder Alert!',
      `Unrecognized person detected on ${busName}`,
      'critical',
      { busName, busId },
      `/dashboard`
    )
  );
  
  await Promise.all(promises);
}

export async function notifyEmergency(
  userIds: string[],
  busName: string,
  busId: string,
  message: string
): Promise<void> {
  const promises = userIds.map(userId =>
    createNotification(
      userId,
      'emergency',
      '🚨 Emergency Alert',
      message,
      'critical',
      { busName, busId },
      `/dashboard`
    )
  );
  
  await Promise.all(promises);
}

export async function notifyBusDelay(
  parentIds: string[],
  busName: string,
  busId: string,
  delayMinutes: number
): Promise<void> {
  const promises = parentIds.map(parentId =>
    createNotification(
      parentId,
      'bus_delay',
      'Bus Delay',
      `${busName} is delayed by approximately ${delayMinutes} minutes`,
      'medium',
      { busName, busId, delayMinutes },
      `/dashboard/parent`
    )
  );
  
  await Promise.all(promises);
}

/**
 * Clean up old notifications (older than 30 days)
 */
export async function cleanupOldNotifications(userId: string): Promise<void> {
  const notifications = await getNotifications(userId, 1000);
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const deletePromises = notifications
    .filter(n => n.timestamp < thirtyDaysAgo)
    .map(n => deleteNotification(userId, n.id));
  
  await Promise.all(deletePromises);
}
