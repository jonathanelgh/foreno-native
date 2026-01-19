import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { getFileSize, uploadImage } from '../lib/storage';
import { supabase } from '../lib/supabase';

interface UploadedImage {
  uri: string;
  name: string;
  size: number;
  uploadedUrl?: string;
}

export default function EditOrganizationScreen() {
  const { activeOrganization, user, refreshMemberships } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState(activeOrganization?.name || '');
  const [type, setType] = useState(activeOrganization?.type || '');
  const [description, setDescription] = useState(activeOrganization?.description || '');
  const [organizationNumber, setOrganizationNumber] = useState(activeOrganization?.organization_number || '');
  const [address, setAddress] = useState(activeOrganization?.address || '');
  const [postalCode, setPostalCode] = useState(activeOrganization?.postal_code || '');
  const [city, setCity] = useState(activeOrganization?.city || '');
  const [billingAddress, setBillingAddress] = useState(activeOrganization?.billing_address || '');
  const [billingPostalCode, setBillingPostalCode] = useState(activeOrganization?.billing_postal_code || '');
  const [billingCity, setBillingCity] = useState(activeOrganization?.billing_city || '');
  const [sameBillingAddress, setSameBillingAddress] = useState(activeOrganization?.same_billing_address ?? true);
  
  // Image state
  const [coverImage, setCoverImage] = useState<UploadedImage | null>(
    activeOrganization?.cover_image_url ? {
      uri: activeOrganization.cover_image_url,
      name: 'cover_image.jpg',
      size: 0,
      uploadedUrl: activeOrganization.cover_image_url
    } : null
  );
  const [logoImage, setLogoImage] = useState<UploadedImage | null>(
    activeOrganization?.logo_url ? {
      uri: activeOrganization.logo_url,
      name: 'logo.jpg',
      size: 0,
      uploadedUrl: activeOrganization.logo_url
    } : null
  );

  const pickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const image: UploadedImage = {
          uri: asset.uri,
          name: asset.fileName || `cover_${Date.now()}.jpg`,
          size: asset.fileSize || 0
        };
        setCoverImage(image);
      }
    } catch (error) {
      Alert.alert('Fel', 'Kunde inte välja bild');
    }
  };

  const pickLogoImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const image: UploadedImage = {
          uri: asset.uri,
          name: asset.fileName || `logo_${Date.now()}.jpg`,
          size: asset.fileSize || 0
        };
        setLogoImage(image);
      }
    } catch (error) {
      Alert.alert('Fel', 'Kunde inte välja bild');
    }
  };

  const removeCoverImage = () => {
    setCoverImage(null);
  };

  const removeLogoImage = () => {
    setLogoImage(null);
  };

  const handleSave = async () => {
    if (!activeOrganization || !user) return;

    if (!name.trim()) {
      Alert.alert('Fel', 'Organisationsnamn är obligatoriskt');
      return;
    }

    setLoading(true);
    
    try {
      let coverImageUrl = activeOrganization.cover_image_url;
      let logoUrl = activeOrganization.logo_url;

      // Upload cover image if changed
      if (coverImage && !coverImage.uploadedUrl) {
        const result = await uploadImage(coverImage.uri, 'organization_logos', coverImage.name);
        coverImageUrl = result.url;
      } else if (!coverImage) {
        coverImageUrl = null;
      }

      // Upload logo if changed
      if (logoImage && !logoImage.uploadedUrl) {
        const result = await uploadImage(logoImage.uri, 'organization_logos', logoImage.name);
        logoUrl = result.url;
      } else if (!logoImage) {
        logoUrl = null;
      }

      const updateData = {
        name: name.trim(),
        type: type.trim() || null,
        description: description.trim() || null,
        organization_number: organizationNumber.trim() || null,
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        billing_address: sameBillingAddress ? null : billingAddress.trim() || null,
        billing_postal_code: sameBillingAddress ? null : billingPostalCode.trim() || null,
        billing_city: sameBillingAddress ? null : billingCity.trim() || null,
        same_billing_address: sameBillingAddress,
        cover_image_url: coverImageUrl,
        logo_url: logoUrl,
      };

      const { error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', activeOrganization.id);

      if (error) {
        console.error('Error updating organization:', error);
        Alert.alert('Fel', 'Kunde inte spara ändringar');
        return;
      }

      // Refresh user data to get updated organization info
      await refreshMemberships();
      
      Alert.alert('Framgång', 'Organisationen har uppdaterats', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating organization:', error);
      Alert.alert('Fel', 'Ett oväntat fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (!activeOrganization) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Ingen organisation vald</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Redigera organisation</Text>
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Spara</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grundläggande information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Organisationsnamn *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ange organisationsnamn"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Typ av organisation</Text>
              <TextInput
                style={styles.input}
                value={type}
                onChangeText={setType}
                placeholder="t.ex. Fotbollsklubb, Förening"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Beskrivning</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Beskriv organisationen"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Organisationsnummer</Text>
              <TextInput
                style={styles.input}
                value={organizationNumber}
                onChangeText={setOrganizationNumber}
                placeholder="XXXXXX-XXXX"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Address Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adressinformation</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adress</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Gatuadress"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>Postnummer</Text>
                <TextInput
                  style={styles.input}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="12345"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.flex2]}>
                <Text style={styles.label}>Ort</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Ort"
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          {/* Billing Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Faktureringsadress</Text>
            
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setSameBillingAddress(!sameBillingAddress)}
            >
              <Ionicons
                name={sameBillingAddress ? "checkbox" : "square-outline"}
                size={20}
                color={sameBillingAddress ? "#007AFF" : "#666"}
              />
              <Text style={styles.checkboxLabel}>Samma som organisationsadress</Text>
            </TouchableOpacity>

            {!sameBillingAddress && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Faktureringsadress</Text>
                  <TextInput
                    style={styles.input}
                    value={billingAddress}
                    onChangeText={setBillingAddress}
                    placeholder="Gatuadress"
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.label}>Postnummer</Text>
                    <TextInput
                      style={styles.input}
                      value={billingPostalCode}
                      onChangeText={setBillingPostalCode}
                      placeholder="12345"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.flex2]}>
                    <Text style={styles.label}>Ort</Text>
                    <TextInput
                      style={styles.input}
                      value={billingCity}
                      onChangeText={setBillingCity}
                      placeholder="Ort"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Images */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bilder</Text>
            
            <View style={styles.inputGroup}>
              <View style={styles.imageHeader}>
                <Text style={styles.label}>Omslagsbild</Text>
                <TouchableOpacity onPress={pickCoverImage} style={styles.addImageButton}>
                  <Ionicons name="add" size={16} color="#007AFF" />
                  <Text style={styles.addImageButtonText}>
                    {coverImage ? 'Ändra bild' : 'Lägg till bild'}
                  </Text>
                </TouchableOpacity>
              </View>
              {coverImage && (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: coverImage.uri }} style={styles.coverImagePreview} />
                  <View style={styles.imageInfo}>
                    <Text style={styles.imageName}>{coverImage.name}</Text>
                    {coverImage.size > 0 && (
                      <Text style={styles.imageSize}>{getFileSize(coverImage.size)}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={removeCoverImage}>
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.imageHeader}>
                <Text style={styles.label}>Logotyp</Text>
                <TouchableOpacity onPress={pickLogoImage} style={styles.addImageButton}>
                  <Ionicons name="add" size={16} color="#007AFF" />
                  <Text style={styles.addImageButtonText}>
                    {logoImage ? 'Ändra logotyp' : 'Lägg till logotyp'}
                  </Text>
                </TouchableOpacity>
              </View>
              {logoImage && (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: logoImage.uri }} style={styles.logoImagePreview} />
                  <View style={styles.imageInfo}>
                    <Text style={styles.imageName}>{logoImage.name}</Text>
                    {logoImage.size > 0 && (
                      <Text style={styles.imageSize}>{getFileSize(logoImage.size)}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={removeLogoImage}>
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
     addImageButton: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 4,
     padding: 8,
   },
  addImageButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
     imageContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 12,
     marginTop: 8,
     padding: 12,
     backgroundColor: '#F8F9FA',
     borderRadius: 8,
   },
  coverImagePreview: {
    width: 100,
    height: 56,
    borderRadius: 8,
  },
  logoImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  imageInfo: {
    flex: 1,
  },
  imageName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  imageSize: {
    fontSize: 12,
    color: '#64748b',
  },
}); 