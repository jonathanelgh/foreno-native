import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    areNotificationsEnabled,
    getNotificationPermissionStatus,
    initializeNotifications,
    PermissionResult,
    requestNotificationPermissions,
    scheduleLocalNotification,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';

export function DebugNotifications() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const loadDebugInfo = async () => {
    try {
      const permissionStatus = await getNotificationPermissionStatus();
      const notificationState = await areNotificationsEnabled();
      const { data: { user } } = await supabase.auth.getUser();
      
      let userProfile = null;
      if (user) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('expo_push_token, push_notifications, email_notifications')
          .eq('id', user.id)
          .single();
        
        if (!error) {
          userProfile = data;
        }
      }

      setDebugInfo({
        permissionStatus,
        notificationState,
        isDevice: Device.isDevice,
        deviceType: Device.deviceType,
        user: user ? { id: user.id, email: user.email } : null,
        userProfile,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error loading debug info:', error);
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const testRequestPermissions = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Requesting permissions...');
      const result: PermissionResult = await requestNotificationPermissions();
      console.log('📋 Permission result:', result);
      
      Alert.alert(
        'Permission Result',
        `Success: ${result.success}\n${result.error || 'Token: ' + (result.token ? 'Yes' : 'No')}`,
        [{ text: 'OK', onPress: loadDebugInfo }]
      );
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testInitializeNotifications = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Initializing notifications...');
      const result: PermissionResult = await initializeNotifications();
      console.log('📋 Initialize result:', result);
      
      Alert.alert(
        'Initialize Result',
        `Success: ${result.success}\n${result.error || 'Token: ' + (result.token ? 'Yes' : 'No')}`,
        [{ text: 'OK', onPress: loadDebugInfo }]
      );
    } catch (error) {
      console.error('❌ Error initializing:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testLocalNotification = async () => {
    try {
      await scheduleLocalNotification(
        'Test Notification',
        'This is a test notification to verify everything is working!'
      );
      Alert.alert('Success', 'Local notification scheduled!');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const clearAndRequestAgain = async () => {
    try {
      // Clear the current token from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ expo_push_token: null })
          .eq('id', user.id);
      }
      
      Alert.alert(
        'Token Cleared',
        'Push token cleared. Now request permissions again.',
        [{ text: 'OK', onPress: loadDebugInfo }]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const forceRequestSystemPermissions = async () => {
    try {
      setIsLoading(true);
      
      // Force request system permissions regardless of current state
      const { status } = await Notifications.requestPermissionsAsync();
      
      Alert.alert(
        'System Permission Request',
        `Permission status: ${status}`,
        [{ text: 'OK', onPress: loadDebugInfo }]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔧 Push Notifications Debug</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <Text style={styles.debugText}>
          {JSON.stringify(debugInfo, null, 2)}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.refreshButton]}
          onPress={loadDebugInfo}
        >
          <Text style={styles.buttonText}>🔄 Refresh Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testRequestPermissions}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '⏳ Testing...' : '🔐 Test Request Permissions'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testInitializeNotifications}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '⏳ Testing...' : '🚀 Test Initialize'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={forceRequestSystemPermissions}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            ⚠️ Force System Permission Request
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.successButton]}
          onPress={testLocalNotification}
        >
          <Text style={styles.buttonText}>📱 Test Local Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearAndRequestAgain}
        >
          <Text style={styles.buttonText}>🗑️ Clear Token & Try Again</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📝 Troubleshooting Steps:</Text>
        <Text style={styles.instructionsText}>
          1. Check if isDevice is true (simulators do not support push notifications){'\n'}
          2. If permission is granted but no token, there is a token generation issue{'\n'}
          3. If permission is denied, you need to enable in device settings{'\n'}
          4. If permission is undetermined, the system should ask when you tap Test Request Permissions{'\n'}
          5. Try Force System Permission Request if normal request does not work
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
  },
  testButton: {
    backgroundColor: '#34C759',
  },
  warningButton: {
    backgroundColor: '#FF9500',
  },
  successButton: {
    backgroundColor: '#30D158',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default DebugNotifications; 