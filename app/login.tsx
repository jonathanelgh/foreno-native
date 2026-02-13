import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

const HERO_HEIGHT = 300;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Scroll to bottom when keyboard appears so inputs stay visible
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, []);

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
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.signInButtonText}>Logga in</Text>
              )}
            </TouchableOpacity>
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
