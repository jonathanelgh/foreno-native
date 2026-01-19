import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { createPoll } from '../lib/api/polls';
import { createUtskick } from '../lib/api/utskick';
import { getFileSize, uploadDocument, uploadImage } from '../lib/storage';

interface CreateUtskickSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedUrl?: string;
}

interface PollOption {
  id: string;
  text: string;
}

export function CreateUtskickSheet({ visible, onClose, onSuccess }: CreateUtskickSheetProps) {
  const { activeOrganization, user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [visibleTo, setVisibleTo] = useState<string[]>(['medlem']);
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' }
  ]);
  const [pollVisibleTo, setPollVisibleTo] = useState<string[]>(['medlem']);
  const [pollExpiresAt, setPollExpiresAt] = useState('');

  const visibilityOptions = [
    { value: 'medlem', label: 'Medlemmar' },
    { value: 'styrelse', label: 'Styrelse' },
    { value: 'admin', label: 'Administratörer' }
  ];

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: UploadedFile = {
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          mimeType: 'image/jpeg'
        };
        setImages(prev => [...prev, file]);
      }
    } catch (error) {
      Alert.alert('Fel', 'Kunde inte välja bild');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: UploadedFile = {
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream'
        };
        setFiles(prev => [...prev, file]);
      }
    } catch (error) {
      Alert.alert('Fel', 'Kunde inte välja fil');
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addPollOption = () => {
    const newId = (pollOptions.length + 1).toString();
    setPollOptions(prev => [...prev, { id: newId, text: '' }]);
  };

  const removePollOption = (id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter(option => option.id !== id));
    }
  };

  const updatePollOption = (id: string, text: string) => {
    setPollOptions(prev => prev.map(option => 
      option.id === id ? { ...option, text } : option
    ));
  };

  const toggleVisibility = (value: string, isPoll: boolean = false) => {
    const setter = isPoll ? setPollVisibleTo : setVisibleTo;
    const current = isPoll ? pollVisibleTo : visibleTo;
    
    setter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleCreate = async () => {
    if (!activeOrganization || !user) return;

    if (!title.trim()) {
      Alert.alert('Fel', 'Titel är obligatorisk');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Fel', 'Innehåll är obligatoriskt');
      return;
    }

    if (includePoll) {
      if (!pollQuestion.trim()) {
        Alert.alert('Fel', 'Omröstningsfråga måste fyllas i');
        return;
      }
      
      const validOptions = pollOptions.filter(option => option.text.trim());
      if (validOptions.length < 2) {
        Alert.alert('Fel', 'Omröstningen måste ha minst 2 alternativ');
        return;
      }
    }

    setLoading(true);
    
    try {
      // Upload images
      const uploadedImages: string[] = [];
      for (const image of images) {
        const result = await uploadImage(image.uri, 'utskick-images', image.name);
        uploadedImages.push(result.url);
      }

      // Upload files
      const uploadedFiles: string[] = [];
      for (const file of files) {
        const result = await uploadDocument(file.uri, 'documents', file.name, activeOrganization.id);
        uploadedFiles.push(result.url);
      }

      // Create the utskick
      const utskickData = {
        organization_id: activeOrganization.id,
        title: title.trim(),
        content: content.trim(),
        published_by: user.id,
        image_url: uploadedImages[0] || null, // Use first image for now
        file_url: uploadedFiles[0] || null, // Use first file for now
        file_name: files[0]?.name || null,
        poll_id: null as string | null // Will be updated if poll is created
      };

      // Create poll if included
      let pollId: string | null = null;
      if (includePoll) {
        const validOptions = pollOptions.filter(option => option.text.trim()).map(option => option.text.trim());
        
        const pollData = {
          organization_id: activeOrganization.id,
          question: pollQuestion.trim(),
          options: validOptions,
          visible_to: pollVisibleTo,
          created_by: user.id,
          expires_at: pollExpiresAt ? new Date(pollExpiresAt).toISOString() : null
        };

        const poll = await createPoll(pollData);
        pollId = poll.id;
        utskickData.poll_id = poll.id;
      }

      await createUtskick(utskickData);

      Alert.alert('Framgång', 'Utskick har skapats', [
        { text: 'OK', onPress: () => {
          resetForm();
          onSuccess();
          onClose();
        }}
      ]);
    } catch (error) {
      console.error('Error creating utskick:', error);
      Alert.alert('Fel', 'Ett oväntat fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setImages([]);
    setFiles([]);
    setVisibleTo(['medlem']);
    setIncludePoll(false);
    setPollQuestion('');
    setPollOptions([
      { id: '1', text: '' },
      { id: '2', text: '' }
    ]);
    setPollVisibleTo(['medlem']);
    setPollExpiresAt('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Avbryt</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nytt utskick</Text>
          <TouchableOpacity 
            style={[styles.createButton, loading && styles.createButtonDisabled]} 
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>
                Skapa
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.content} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Titel *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ange titel för utskicket"
                  autoCapitalize="sentences"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Innehåll *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Skriv innehållet för utskicket..."
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Synligt för</Text>
                <View style={styles.checkboxContainer}>
                  {visibilityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.checkbox}
                      onPress={() => toggleVisibility(option.value)}
                    >
                      <Ionicons
                        name={visibleTo.includes(option.value) ? "checkbox" : "square-outline"}
                        size={20}
                        color={visibleTo.includes(option.value) ? "#007AFF" : "#666"}
                      />
                      <Text style={styles.checkboxLabel}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Bilder</Text>
                <TouchableOpacity onPress={pickImage} style={styles.addButton}>
                  <Ionicons name="add" size={20} color="#007AFF" />
                  <Text style={styles.addButtonText}>Lägg till bild</Text>
                </TouchableOpacity>
              </View>
              {images.map((image, index) => (
                <View key={index} style={styles.fileItem}>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{image.name}</Text>
                    <Text style={styles.fileSize}>{getFileSize(image.size)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeImage(index)}>
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Filer</Text>
                <TouchableOpacity onPress={pickDocument} style={styles.addButton}>
                  <Ionicons name="add" size={20} color="#007AFF" />
                  <Text style={styles.addButtonText}>Lägg till fil</Text>
                </TouchableOpacity>
              </View>
              {files.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Ionicons name="document" size={24} color="#666" />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileSize}>{getFileSize(file.size)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFile(index)}>
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Omröstning</Text>
                <TouchableOpacity 
                  onPress={() => setIncludePoll(!includePoll)} 
                  style={styles.toggleButton}
                >
                  <Ionicons
                    name={includePoll ? "checkbox" : "square-outline"}
                    size={20}
                    color={includePoll ? "#007AFF" : "#666"}
                  />
                  <Text style={styles.toggleButtonText}>Inkludera omröstning</Text>
                </TouchableOpacity>
              </View>

              {includePoll && (
                <View style={styles.pollSection}>
                  <View style={styles.pollInputSection}>
                    <Text style={styles.pollLabel}>Fråga *</Text>
                    <TextInput
                      style={styles.input}
                      value={pollQuestion}
                      onChangeText={setPollQuestion}
                      placeholder="Ange omröstningsfråga..."
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.pollInputSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.pollLabel}>Alternativ</Text>
                      <TouchableOpacity onPress={addPollOption} style={styles.addButton}>
                        <Ionicons name="add" size={16} color="#007AFF" />
                        <Text style={styles.addButtonText}>Lägg till</Text>
                      </TouchableOpacity>
                    </View>
                    {pollOptions.map((option, index) => (
                      <View key={option.id} style={styles.pollOptionItem}>
                        <TextInput
                          style={[styles.input, styles.pollOptionInput]}
                          value={option.text}
                          onChangeText={(text) => updatePollOption(option.id, text)}
                          placeholder={`Alternativ ${index + 1}...`}
                          placeholderTextColor="#999"
                        />
                        {pollOptions.length > 2 && (
                          <TouchableOpacity onPress={() => removePollOption(option.id)}>
                            <Ionicons name="trash" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>

                  <View style={styles.pollInputSection}>
                    <Text style={styles.pollLabel}>Synligt för</Text>
                    <View style={styles.checkboxContainer}>
                      {visibilityOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={styles.checkbox}
                          onPress={() => toggleVisibility(option.value, true)}
                        >
                          <Ionicons
                            name={pollVisibleTo.includes(option.value) ? "checkbox" : "square-outline"}
                            size={20}
                            color={pollVisibleTo.includes(option.value) ? "#007AFF" : "#666"}
                          />
                          <Text style={styles.checkboxLabel}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.pollInputSection}>
                    <Text style={styles.pollLabel}>Slutdatum (valfritt)</Text>
                    <TextInput
                      style={styles.input}
                      value={pollExpiresAt}
                      onChangeText={setPollExpiresAt}
                      placeholder="YYYY-MM-DD HH:MM"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.helpText}>Format: 2024-12-31 23:59</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  cancelButtonText: {
    color: '#2563eb',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  createButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
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
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  inputGroup: {
    marginBottom: 20,
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
    height: 120,
    paddingTop: 10,
  },
  marginTop: {
    marginTop: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  bottomPadding: {
    height: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  imagePreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButtonText: {
    fontSize: 16,
    color: '#000',
  },
  pollSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  pollInputSection: {
    marginBottom: 16,
  },
  pollLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  pollOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pollOptionInput: {
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
  },
}); 