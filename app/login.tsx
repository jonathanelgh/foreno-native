import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function LoginScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Fel', 'Vänligen fyll i både e-post och lösenord');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Inloggningsfel', error.message || 'Ett fel uppstod vid inloggning');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Navigation will happen automatically via auth state change
    } catch (error: any) {
      Alert.alert('Inloggningsfel', error.message || 'Ett fel uppstod vid Google-inloggning');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedImage
          source={require('../assets/images/hero-1.webp')}
          style={[
            styles.heroImage,
            {
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [-200, 0, 200],
                    outputRange: [-200, 0, 0],
                    extrapolateRight: 'clamp',
                  }),
                },
              ],
              height: scrollY.interpolate({
                inputRange: [-200, 0, 200],
                outputRange: [340 + 200, 340, 340],
                extrapolate: 'clamp',
              }),
            },
          ]}
          contentFit="cover"
          contentPosition="top center"
        />
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/foreno-icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <Text style={styles.title}>Välkommen till Föreno</Text>
          <Text style={styles.subtitle}>Administrera din förening enkelt och säkert</Text>

          <View style={styles.form}>
            {/* Google Login Button */}
            <TouchableOpacity
              style={[styles.socialButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <>
                  <Image
                    source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                    style={styles.googleLogo}
                    contentFit="contain"
                  />
                  <Text style={styles.socialButtonText}>Logga in med Google</Text>
                </>
              )}
            </TouchableOpacity>

            {!showEmailForm && (
              <TouchableOpacity
                style={[styles.socialButton, styles.emailToggleButton, loading && styles.buttonDisabled]}
                onPress={() => setShowEmailForm(true)}
                disabled={loading || googleLoading}
              >
                <Ionicons name="mail-outline" size={20} color="#1f2937" style={styles.socialIcon} />
                <Text style={styles.socialButtonText}>Logga in med e-post</Text>
              </TouchableOpacity>
            )}

            {/* Separator */}
            {showEmailForm && (
              <>
                <View style={styles.separator}>
                  <Text style={styles.separatorText}>eller</Text>
                </View>

                {/* Email Input */}
                <TextInput
                  style={styles.input}
                  placeholder="E-post"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#9ca3af"
                />

                {/* Password Input */}
                <TextInput
                  style={styles.input}
                  placeholder="Lösenord"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                />

                {/* Email Login Button */}
                <TouchableOpacity
                  style={[styles.emailButton, loading && styles.buttonDisabled]}
                  onPress={handleSignIn}
                  disabled={loading || googleLoading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={20} color="#ffffff" style={styles.emailIcon} />
                      <Text style={styles.emailButtonText}>Logga in</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Registration Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Vill du använda Föreno för din förening? </Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.foreno.se/register')}>
                <Text style={styles.registerLink}>Kom igång här</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 40 : 32,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 64,
    height: 64,
  },
  heroImage: {
    width: '100%',
    height: 340,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 16,
  },
  socialButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  socialButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '500',
  },
  emailToggleButton: {
    marginTop: 12,
  },
  socialIcon: {
    marginRight: 12,
  },
  separator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  separatorText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  emailButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emailIcon: {
    marginRight: 8,
  },
  emailButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  registerText: {
    color: '#64748b',
    fontSize: 14,
  },
  registerLink: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
}); 