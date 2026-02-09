import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HERO_HEIGHT = 300;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleSignIn = async () => {
    Keyboard.dismiss();
    if (!email.trim()) {
      Alert.alert('Fel', 'Vänligen fyll i din e-postadress');
      emailInputRef.current?.focus();
      return;
    }
    if (!password) {
      Alert.alert('Fel', 'Vänligen fyll i ditt lösenord');
      passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Inloggningsfel', error.message || 'Ett fel uppstod vid inloggning');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    Keyboard.dismiss();
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Inloggningsfel', error.message || 'Ett fel uppstod vid Google-inloggning');
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleEmailForm = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(300, 'easeInEaseOut', 'opacity'),
    );
    setShowEmailForm(true);
  }, []);

  // Fade in email form fields and auto-focus
  useEffect(() => {
    if (showEmailForm) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
      // Small delay to let layout settle before focusing
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [showEmailForm, fadeAnim]);

  // Scroll to bottom when keyboard appears so inputs stay visible
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      if (showEmailForm) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    return () => sub.remove();
  }, [showEmailForm]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero section with gradient overlay */}
        <View style={styles.heroContainer}>
          <Image
            source={require('../assets/images/hero-1.webp')}
            style={styles.heroImage}
            contentFit="cover"
            contentPosition="top center"
          />
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.6)', '#ffffff']}
            locations={[0, 0.6, 1]}
            style={styles.heroGradient}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/foreno-icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          <Text style={styles.title}>Välkommen till Föreno</Text>
          <Text style={styles.subtitle}>
            Administrera din förening enkelt och säkert
          </Text>

          <View style={styles.form}>
            {/* Google Login Button */}
            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <>
                  <Image
                    source={{
                      uri: 'https://developers.google.com/identity/images/g-logo.png',
                    }}
                    style={styles.googleLogo}
                    contentFit="contain"
                  />
                  <Text style={styles.googleButtonText}>Fortsätt med Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Email toggle button (shown before form is expanded) */}
            {!showEmailForm && (
              <TouchableOpacity
                style={styles.emailToggleButton}
                onPress={toggleEmailForm}
                disabled={loading || googleLoading}
                activeOpacity={0.7}
              >
                <Feather name="mail" size={18} color="#374151" />
                <Text style={styles.emailToggleText}>Fortsätt med e-post</Text>
              </TouchableOpacity>
            )}

            {/* Email form (animated in) */}
            {showEmailForm && (
              <Animated.View style={[styles.emailForm, { opacity: fadeAnim }]}>
                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>eller med e-post</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Email Input */}
                <View style={styles.inputContainer}>
                  <Feather name="mail" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    ref={emailInputRef}
                    style={styles.input}
                    placeholder="E-postadress"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    placeholderTextColor="#9ca3af"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    blurOnSubmit={false}
                    editable={!loading}
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="Lösenord"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    placeholderTextColor="#9ca3af"
                    returnKeyType="go"
                    onSubmitEditing={handleSignIn}
                    editable={!loading}
                  />
                  <Pressable
                    onPress={() => setShowPassword((p) => !p)}
                    style={styles.eyeButton}
                    hitSlop={8}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#9ca3af"
                    />
                  </Pressable>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity
                  style={[styles.signInButton, loading && styles.buttonDisabled]}
                  onPress={handleSignIn}
                  disabled={loading || googleLoading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.signInButtonText}>Logga in</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {/* Registration Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Vill du använda Föreno för din förening?</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.foreno.se/register')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLink}>Kom igång här</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },

  // ── Hero ──
  heroContainer: {
    height: HERO_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.6,
  },

  // ── Content ──
  content: {
    paddingHorizontal: 28,
    marginTop: -20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },

  // ── Form ──
  form: {
    gap: 12,
  },

  // Google button
  googleButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },

  // Email toggle button
  emailToggleButton: {
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  emailToggleText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },

  // Email form
  emailForm: {
    gap: 12,
    marginTop: 4,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 14,
  },

  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },

  // Sign in button
  signInButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  // ── Footer ──
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  footerLink: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
});
