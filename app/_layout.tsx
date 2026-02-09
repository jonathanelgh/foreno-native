import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Image, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '../lib/supabase';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { UnreadCountProvider } from '../contexts/UnreadCountContext';
import { initializeNotifications } from '../lib/notifications';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();

  useEffect(() => {
    // Handle deep links for OAuth callback
    const createSessionFromUrl = async (url: string) => {
      console.log('Processing URL for session:', url);
      
      // Check if URL contains tokens (could be in hash or query params)
      if (!url.includes('access_token') && !url.includes('#access_token')) {
        console.log('URL does not contain access_token');
        return;
      }

      try {
        const { params, errorCode } = QueryParams.getQueryParams(url);

        if (errorCode) {
          console.error('Error in callback URL:', errorCode);
          return;
        }
        
        const { access_token, refresh_token } = params;

        if (!access_token) {
          console.log('No access token found in params');
          return;
        }

        console.log('Setting session from URL');
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error('Error setting session from URL:', error);
        } else {
          console.log('Session set successfully from URL');
        }
      } catch (error) {
        console.error('Error processing URL:', error);
      }
    };

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        createSessionFromUrl(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('URL event received:', event.url);
      createSessionFromUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (session) {
        // Initialize push notifications when user is authenticated
        initializeNotifications().then(result => {
          if (result.success) {
            console.log('🔔 Notifications enabled');
          }
          // Silently handle failures - they're expected in Expo Go
        });
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [session, loading]);

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <Image 
          source={require('../assets/images/foreno-icon.png')} 
          style={styles.splashIcon}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <UnreadCountProvider>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="bookings" options={{ headerShown: false }} />
          <Stack.Screen name="fees" options={{ headerShown: false }} />
          <Stack.Screen name="marketplace" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </UnreadCountProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return (
      <View style={styles.splashContainer}>
        <Image 
          source={require('../assets/images/foreno-icon.png')} 
          style={styles.splashIcon}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashIcon: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  spinner: {
    marginTop: 16,
  },
});
