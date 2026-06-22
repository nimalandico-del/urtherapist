import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { post } from './client';

// Try to import Constants (may not be available in all setups)
let Constants: any;
try {
  Constants = require('expo-constants').default;
} catch (e) {
  // Constants not available
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Configure Android notification channel for better visibility
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Register device token with backend
 */
export async function registerDeviceToken(): Promise<void> {
  try {
    // Check if device is physical (not simulator)
    if (!Device.isDevice) {
      console.log('Device token registration skipped: Running on simulator/emulator');
      return;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Get Expo push token
    // For Expo Go, we need projectId or experienceId
    let projectId: string | undefined;
    let experienceId: string | undefined;
    
    try {
      if (Constants) {
        // Try to get projectId from expo config
        projectId = Constants.expoConfig?.extra?.eas?.projectId 
          || Constants.expoConfig?.extra?.projectId;
        
        // For Expo Go, we can use experienceId format: @username/slug
        // Try to construct from manifest if available
        if (!projectId && Constants.manifest) {
          const manifest = Constants.manifest as any;
          if (manifest.id) {
            experienceId = manifest.id;
          } else if (manifest.owner && manifest.slug) {
            experienceId = `@${manifest.owner}/${manifest.slug}`;
          } else if (manifest.slug) {
            // Try with just slug - Expo Go might work with this
            experienceId = manifest.slug;
          }
        }
        
        // Also try from expoConfig
        if (!projectId && !experienceId && Constants.expoConfig) {
          const config = Constants.expoConfig as any;
          if (config.owner && config.slug) {
            experienceId = `@${config.owner}/${config.slug}`;
          } else if (config.slug) {
            experienceId = config.slug;
          }
        }
      }
    } catch (e) {
      console.log('Could not get projectId/experienceId from Constants:', e);
    }
    
    // Get push token
    let tokenData;
    try {
      if (projectId) {
        console.log('Using projectId:', projectId);
        tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      } else if (experienceId) {
        // Use experienceId for Expo Go
        console.log('Using experienceId:', experienceId);
        tokenData = await Notifications.getExpoPushTokenAsync({ experienceId });
      } else {
        // Try without parameters (may work in some setups)
        console.log('Trying without projectId/experienceId...');
        tokenData = await Notifications.getExpoPushTokenAsync();
      }
    } catch (error: any) {
      console.error('Error getting push token:', error);
      if (error.message?.includes('projectId') || error.message?.includes('experienceId')) {
        console.warn('⚠️ Push notifications require a projectId or experienceId.');
        console.warn('📱 Note: Push notifications in Expo Go have limitations.');
        console.warn('💡 Quick Fix: Create EAS project');
        console.warn('   Run: cd mobile && npx eas init');
        console.warn('📝 For now, notifications will be saved in database but not sent as push.');
        return;
      }
      throw error;
    }
    
    const pushToken = tokenData.data;
    console.log('Expo Push Token:', pushToken);

    // Determine device type
    const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';
    
    // Get device name
    let deviceName = 'Unknown Device';
    if (Device.deviceName) {
      deviceName = Device.deviceName;
    } else if (Device.modelName) {
      deviceName = Device.modelName;
    } else if (Device.brand && Device.modelName) {
      deviceName = `${Device.brand} ${Device.modelName}`;
    }

    // Register with backend
    try {
      await post('/device-tokens/register/', {
        token: pushToken,
        device_type: deviceType,
        device_name: deviceName,
      });
      console.log('✅ Device token registered successfully!');
      console.log('📱 Push notifications are now enabled - you will receive notifications on top of your device!');
    } catch (error: any) {
      console.error('Error registering device token:', error);
      // Don't throw - allow app to continue even if registration fails
    }
  } catch (error: any) {
    console.error('Error in registerDeviceToken:', error);
    // Don't throw - allow app to continue even if registration fails
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (notification: Notifications.NotificationResponse) => void
) {
  // Listener for notifications received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener(onNotificationReceived);
  
  // Listener for when user taps on notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

  return () => {
    Notifications.removeNotificationSubscription(receivedListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}

