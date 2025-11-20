'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  requestNotificationPermission,
  type Notification,
  type NotificationPreferences,
} from '@/lib/notification-manager';
import { useRouter } from 'next/navigation';

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to notifications
    const unsubscribe = subscribeToNotifications(userId, (newNotifications) => {
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);
    });

    // Load preferences
    loadPreferences();

    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }

    return unsubscribe;
  }, [userId]);

  const loadPreferences = async () => {
    const prefs = await getNotificationPreferences(userId);
    setPreferences(prefs);
  };

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationAsRead(userId, notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(userId);
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(userId, notificationId);
  };

  const handleDeleteAll = async () => {
    await deleteAllNotifications(userId);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markNotificationAsRead(userId, notification.id);
    }

    // Navigate if action URL provided
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    await updateNotificationPreferences(userId, { [key]: value });
  };

  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    setPermissionGranted(permission === 'granted');
    
    if (permission === 'granted' && preferences) {
      await updateNotificationPreferences(userId, { browserNotifications: true });
      setPreferences({ ...preferences, browserNotifications: true });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'emergency': return '🚨';
      case 'intruder_alert': return '⚠️';
      case 'student_boarded': return '🚌';
      case 'student_exited': return '👋';
      case 'bus_delay': return '⏱️';
      case 'attendance_issue': return '📋';
      default: return '🔔';
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                variant="destructive"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-1">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleMarkAllAsRead}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Sheet open={showSettings} onOpenChange={setShowSettings}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Settings className="h-3 w-3" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Notification Settings</SheetTitle>
                    <SheetDescription>
                      Customize which notifications you want to receive
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    {!permissionGranted && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800 mb-2">
                          Browser notifications are blocked
                        </p>
                        <Button size="sm" onClick={handleRequestPermission}>
                          Enable Notifications
                        </Button>
                      </div>
                    )}

                    {preferences && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="student-boarded">Student Boarded</Label>
                          <Switch
                            id="student-boarded"
                            checked={preferences.studentBoarded}
                            onCheckedChange={(checked) => handlePreferenceChange('studentBoarded', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="student-exited">Student Exited</Label>
                          <Switch
                            id="student-exited"
                            checked={preferences.studentExited}
                            onCheckedChange={(checked) => handlePreferenceChange('studentExited', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="intruder-alert">Intruder Alerts</Label>
                          <Switch
                            id="intruder-alert"
                            checked={preferences.intruderAlert}
                            onCheckedChange={(checked) => handlePreferenceChange('intruderAlert', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="bus-delay">Bus Delays</Label>
                          <Switch
                            id="bus-delay"
                            checked={preferences.busDelay}
                            onCheckedChange={(checked) => handlePreferenceChange('busDelay', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="emergency">Emergency Alerts</Label>
                          <Switch
                            id="emergency"
                            checked={preferences.emergency}
                            onCheckedChange={(checked) => handlePreferenceChange('emergency', checked)}
                            disabled
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="sound">Sound</Label>
                          <Switch
                            id="sound"
                            checked={preferences.soundEnabled}
                            onCheckedChange={(checked) => handlePreferenceChange('soundEnabled', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="browser-notifications">Browser Notifications</Label>
                          <Switch
                            id="browser-notifications"
                            checked={preferences.browserNotifications}
                            onCheckedChange={(checked) => handlePreferenceChange('browserNotifications', checked)}
                            disabled={!permissionGranted}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollArea className="h-96">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex-col items-start p-3 cursor-pointer",
                    !notification.read && "bg-blue-50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-lg">{getTypeIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">{notification.title}</p>
                          {notification.priority !== 'low' && (
                            <Badge className={cn("text-xs py-0 px-1", getPriorityColor(notification.priority))}>
                              {notification.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleDelete(notification.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
          {notifications.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-destructive" onClick={handleDeleteAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear all notifications
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
