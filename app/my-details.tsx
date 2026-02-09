import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function MyDetailsScreen() {
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [personnummer, setPersonnummer] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');
      setPhone(userProfile.phone_number || '');
      setPersonnummer(userProfile.personnummer || '');
      setStreetAddress(userProfile.street_address || '');
      setPostalCode(userProfile.postal_code || '');
      setCity(userProfile.city || '');
    }
  }, [userProfile]);

  const displayName = () => {
    const name = `${firstName || ''} ${lastName || ''}`.trim();
    return name || user?.email || 'Användare';
  };

  const currentImageUrl = localImageUri || userProfile?.profile_image_url || null;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Vi behöver åtkomst till dina foton för att byta profilbild.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // Check file size (max 2MB)
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      Alert.alert('För stor fil', 'Bilden får vara max 2 MB.');
      return;
    }

    await uploadImage(asset.uri);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Vi behöver åtkomst till kameran för att ta en profilbild.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    await uploadImage(result.assets[0].uri);
  };

  const showImageOptions = () => {
    Alert.alert('Profilbild', 'Välj hur du vill ändra din profilbild', [
      { text: 'Välj från galleri', onPress: handlePickImage },
      { text: 'Ta foto', onPress: handleTakePhoto },
      ...(currentImageUrl
        ? [{ text: 'Ta bort bild', style: 'destructive' as const, onPress: handleRemoveImage }]
        : []),
      { text: 'Avbryt', style: 'cancel' as const },
    ]);
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    setUploadingImage(true);
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Read file as base64 and decode to ArrayBuffer (Supabase RN recommended approach)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, decode(base64), {
          upsert: true,
          contentType: mimeType,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Fel', 'Kunde inte ladda upp bilden.');
        return;
      }

      // Update profile with new image path
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_image_url: filePath })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        Alert.alert('Fel', 'Kunde inte uppdatera profilbilden.');
        return;
      }

      setLocalImageUri(uri);
      await refreshUserProfile();
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Fel', 'Ett oväntat fel uppstod vid uppladdning.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;

    setUploadingImage(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ profile_image_url: null })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Fel', 'Kunde inte ta bort profilbilden.');
        return;
      }

      setLocalImageUri(null);
      await refreshUserProfile();
    } catch (error) {
      Alert.alert('Fel', 'Ett oväntat fel uppstod.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone_number: phone.trim() || null,
          personnummer: personnummer.trim() || null,
          street_address: streetAddress.trim() || null,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Save error:', error);
        Alert.alert('Fel', 'Kunde inte spara dina uppgifter.');
        return;
      }

      await refreshUserProfile();
      Alert.alert('Sparat', 'Dina uppgifter har uppdaterats.');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Fel', 'Ett oväntat fel uppstod.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    return (
      (firstName.trim() || '') !== (userProfile?.first_name || '') ||
      (lastName.trim() || '') !== (userProfile?.last_name || '') ||
      (phone.trim() || '') !== (userProfile?.phone_number || '') ||
      (personnummer.trim() || '') !== (userProfile?.personnummer || '') ||
      (streetAddress.trim() || '') !== (userProfile?.street_address || '') ||
      (postalCode.trim() || '') !== (userProfile?.postal_code || '') ||
      (city.trim() || '') !== (userProfile?.city || '')
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Mina uppgifter',
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Feather name="chevron-left" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Image Section */}
          <View style={styles.imageSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={showImageOptions}
              disabled={uploadingImage}
              activeOpacity={0.7}
            >
              <Avatar
                url={localImageUri || userProfile?.profile_image_url}
                size={100}
                name={displayName()}
                placeholderColor="#2563eb"
              />
              <View style={styles.cameraOverlay}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="camera" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.imageHint}>Tryck för att ändra profilbild</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Förnamn</Text>
              <View style={styles.inputContainer}>
                <Feather name="user" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Ange förnamn"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Efternamn</Text>
              <View style={styles.inputContainer}>
                <Feather name="user" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Ange efternamn"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Telefonnummer</Text>
              <View style={styles.inputContainer}>
                <Feather name="phone" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Ange telefonnummer"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-post</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Feather name="mail" size={18} color="#9ca3af" style={styles.inputIcon} />
                <Text style={styles.disabledText}>{user?.email || ''}</Text>
              </View>
              <Text style={styles.fieldHint}>E-postadressen kan inte ändras här.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Personnummer</Text>
              <View style={styles.inputContainer}>
                <Feather name="hash" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={personnummer}
                  onChangeText={setPersonnummer}
                  placeholder="ÅÅÅÅMMDD-XXXX"
                  placeholderTextColor="#9ca3af"
                  keyboardType="default"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Section title for address */}
            <Text style={styles.sectionLabel}>Adress</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Gatuadress</Text>
              <View style={styles.inputContainer}>
                <Feather name="map-pin" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={streetAddress}
                  onChangeText={setStreetAddress}
                  placeholder="Ange gatuadress"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Postnummer</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { paddingLeft: 0 }]}
                    value={postalCode}
                    onChangeText={setPostalCode}
                    placeholder="123 45"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    returnKeyType="next"
                  />
                </View>
              </View>
              <View style={[styles.fieldGroup, { flex: 1.5 }]}>
                <Text style={styles.label}>Ort</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { paddingLeft: 0 }]}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Ange ort"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[styles.saveButton, (!hasChanges() || saving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!hasChanges() || saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>Spara ändringar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imageHint: {
    marginTop: 10,
    fontSize: 13,
    color: '#9ca3af',
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  disabledText: {
    flex: 1,
    fontSize: 16,
    color: '#6b7280',
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#9ca3af',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    marginTop: 4,
  },
  rowFields: {
    flexDirection: 'row',
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
