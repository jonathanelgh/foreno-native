import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Deprecated
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true, // Replaces shouldShowAlert
    shouldShowList: true,
  }),
});

export interface PermissionResult {
  success: boolean;
  token?: string;
  error?: string;
  permissionStatus?: Notifications.PermissionStatus;
}

// Check current permission status
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// Enhanced permission request with better error handling
export async function requestNotificationPermissions(): Promise<PermissionResult> {
  try {
    // Check if device supports push notifications
    if (!Device.isDevice) {
      return {
        success: false,
        error: 'Push notifications require a physical device. Simulator/emulator is not supported.',
      };
    }

    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Current permission status:', existingStatus);

    let finalStatus = existingStatus;

    // If permission not granted, request it
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Handle different permission states
    switch (finalStatus) {
      case 'granted':
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          
          return {
            success: true,
            token: tokenData.data,
            permissionStatus: finalStatus,
          };
        } catch (tokenError) {
          console.error('Error getting push token:', tokenError);
          return {
            success: false,
            error: 'Failed to get push notification token. Please try again.',
            permissionStatus: finalStatus,
          };
        }

      case 'denied':
        return {
          success: false,
          error: Platform.OS === 'ios' 
            ? 'Push notifications are disabled. Please enable them in Settings > Notifications > [App Name]'
            : 'Push notifications are disabled. Please enable them in your device settings.',
          permissionStatus: finalStatus,
        };

      case 'undetermined':
        return {
          success: false,
          error: 'Permission request was cancelled. You can enable notifications later in settings.',
          permissionStatus: finalStatus,
        };

      default:
        return {
          success: false,
          error: `Unexpected permission status: ${finalStatus}`,
          permissionStatus: finalStatus,
        };
    }
  } catch (error) {
    console.error('Error in permission request:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while requesting notification permissions.',
    };
  }
}

// Legacy function for backwards compatibility
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const result = await requestNotificationPermissions();
  
  if (!result.success) {
    console.warn('Push notification registration failed:', result.error);
    // Don't show alert here - let the calling code handle the error
    return null;
  }
  
  return result.token || null;
}

// Check if notifications are properly configured
export async function areNotificationsEnabled(): Promise<{
  permissionsGranted: boolean;
  hasToken: boolean;
  tokenSaved: boolean;
}> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const permissionsGranted = status === 'granted';
    
    let hasToken = false;
    let tokenSaved = false;
    
    // Only check for push token if we have a projectId (not in Expo Go)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (permissionsGranted && Device.isDevice && projectId) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        hasToken = !!tokenData.data;
        
        // Check if token is saved in user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('expo_push_token')
            .eq('id', user.id)
            .single();
          
          if (!error && data?.expo_push_token) {
            tokenSaved = true;
          }
        }
      } catch (error) {
        // Silently handle token errors in Expo Go
        console.log('Skipping push token check (Expo Go mode)');
      }
    }
    
    return {
      permissionsGranted,
      hasToken,
      tokenSaved,
    };
  } catch (error) {
    console.error('Error checking notification status:', error);
    return {
      permissionsGranted: false,
      hasToken: false,
      tokenSaved: false,
    };
  }
}

export async function savePushTokenToProfile(token: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user found');

    const { error } = await supabase
      .from('user_profiles')
      .update({ expo_push_token: token })
      .eq('id', user.id);

    if (error) throw error;
    console.log('Push token saved successfully');
    return { success: true };
  } catch (error) {
    console.error('Error saving push token:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Initialize notifications with proper error handling
export async function initializeNotifications(): Promise<PermissionResult> {
  try {
    // Setup listeners first
    setupNotificationListeners();
    
    // Check if we're in Expo Go (no projectId configured)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const isExpoGo = !projectId;
    
    if (isExpoGo) {
      // In Expo Go, just request permissions for local notifications
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        return {
          success: true,
          permissionStatus: finalStatus,
        };
      } else {
        return {
          success: false,
          error: 'Notification permissions not granted',
          permissionStatus: finalStatus,
        };
      }
    }
    
    // For standalone builds, request permissions and get token
    const permissionResult = await requestNotificationPermissions();
    
    if (permissionResult.success && permissionResult.token) {
      // Save token to user profile
      const saveResult = await savePushTokenToProfile(permissionResult.token);
      
      if (!saveResult.success) {
        console.warn('Token received but failed to save to profile:', saveResult.error);
      }
    }
    
    return permissionResult;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return {
      success: false,
      error: 'Failed to initialize push notifications',
    };
  }
}

export function setupNotificationListeners() {
  // Handle notifications when app is foregrounded
  Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    // Handle the notification as needed
  });

  // Handle notification responses (when user taps notification)
  Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (!data) return;

    if (data.type === 'message' && data.conversation_id && data.conversation_type) {
      router.push({
        pathname: '/conversation/[id]',
        params: {
          id: String(data.conversation_id),
          type: data.conversation_type as 'direct' | 'organization',
        },
      });
    } else if (data.type === 'utskick' && data.utskick_id) {
      router.push({ pathname: '/news', params: { utskick_id: String(data.utskick_id) } } as never);
    } else if (data.type === 'event' && data.event_id) {
      router.push({ pathname: '/events', params: { event_id: String(data.event_id) } } as never);
    }
  });
}

// Helper function to clear all notifications
export async function clearAllNotifications() {
  await Notifications.dismissAllNotificationsAsync();
}

// Helper function to set badge count
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

// Helper function to schedule a local notification (for testing)
export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Show immediately
  });
} 