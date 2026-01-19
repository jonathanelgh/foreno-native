import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    areNotificationsEnabled,
    getNotificationPermissionStatus,
    initializeNotifications,
    PermissionResult
} from '../lib/notifications';

export function NotificationPermissionHandler() {
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [notificationState, setNotificationState] = useState({
    permissionsGranted: false,
    hasToken: false,
    tokenSaved: false,
  });

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      const status = await getNotificationPermissionStatus();
      const state = await areNotificationsEnabled();
      
      setPermissionStatus(status);
      setNotificationState(state);
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const handleRequestPermissions = async () => {
    setIsLoading(true);
    
    try {
      const result: PermissionResult = await initializeNotifications();
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'Push notifications have been enabled. You\'ll now receive notifications for new events and updates.',
          [{ text: 'OK', onPress: checkNotificationStatus }]
        );
      } else {
        Alert.alert(
          'Permission Required',
          result.error || 'Unable to enable push notifications.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Settings',
              onPress: () => {
                // You might want to link to app settings here
                console.log('Navigate to settings');
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'An unexpected error occurred while setting up notifications.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusMessage = () => {
    if (permissionStatus === 'checking') {
      return 'Checking notification status...';
    }

    if (permissionStatus === 'granted' && notificationState.tokenSaved) {
      return '✅ Push notifications are enabled';
    }

    if (permissionStatus === 'granted' && !notificationState.tokenSaved) {
      return '⚠️ Notifications allowed but not fully configured';
    }

    if (permissionStatus === 'denied') {
      return '❌ Push notifications are disabled';
    }

    return '❓ Push notifications not set up';
  };

  const getStatusColor = () => {
    if (permissionStatus === 'granted' && notificationState.tokenSaved) {
      return '#4CAF50'; // Green
    }
    if (permissionStatus === 'denied') {
      return '#F44336'; // Red
    }
    return '#FF9800'; // Orange
  };

  const shouldShowRequestButton = () => {
    return permissionStatus !== 'granted' || !notificationState.tokenSaved;
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusMessage()}
        </Text>
        
        {/* Debug info - remove in production */}
        <Text style={styles.debugText}>
          Status: {permissionStatus} | Token: {notificationState.hasToken ? 'Yes' : 'No'} | Saved: {notificationState.tokenSaved ? 'Yes' : 'No'}
        </Text>
      </View>

      {shouldShowRequestButton() && (
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRequestPermissions}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Setting up...' : 'Enable Notifications'}
          </Text>
        </TouchableOpacity>
      )}

      {permissionStatus === 'denied' && (
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            To enable notifications, go to your device Settings → [App Name] → Notifications and turn them on.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  statusContainer: {
    marginBottom: 15,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  helpText: {
    fontSize: 14,
    color: '#856404',
  },
});

export default NotificationPermissionHandler; 