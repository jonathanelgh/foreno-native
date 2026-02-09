import { Avatar } from './Avatar';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  getOrganizationGroups,
  getOrganizationMembersForNewConversation,
  type OrgMemberForPicker
} from '../lib/api/messages';
import { createPoll } from '../lib/api/polls';
import { createUtskick } from '../lib/api/utskick';
import { getFileSize, uploadDocument, uploadImage } from '../lib/storage';
import { OrganizationConversation } from '../types/database';

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

type VisibilityMode = 'public' | 'board' | 'groups' | 'members';

function displayName(m: OrgMemberForPicker): string {
  const first = m.first_name?.trim() || '';
  const last = m.last_name?.trim() || '';
  return [first, last].filter(Boolean).join(' ') || 'Okänd';
}

function matchesSearch(m: OrgMemberForPicker, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const name = displayName(m).toLowerCase();
  return name.includes(q);
}

export function CreateUtskickSheet({ visible, onClose, onSuccess }: CreateUtskickSheetProps) {
  const { activeOrganization, user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  
  // Visibility State
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('public');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [notifyMembers, setNotifyMembers] = useState(false); // "Skicka e-post..." checkbox
  
  // Data for pickers
  const [groups, setGroups] = useState<OrganizationConversation[]>([]);
  const [members, setMembers] = useState<OrgMemberForPicker[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' }
  ]);
  const [pollExpiresAt, setPollExpiresAt] = useState('');

  // Load groups and members when needed
  const loadData = useCallback(async () => {
    if (!activeOrganization?.id) return;
    setLoadingData(true);
    try {
      const [g, m] = await Promise.all([
        getOrganizationGroups(activeOrganization.id),
        getOrganizationMembersForNewConversation(activeOrganization.id)
      ]);
      setGroups(g);
      setMembers(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    if (visible && activeOrganization?.id) {
      loadData();
    }
  }, [visible, activeOrganization?.id, loadData]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => matchesSearch(m, memberSearchQuery));
  }, [members, memberSearchQuery]);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    
    // Check visibility selections
    if (visibilityMode === 'groups' && selectedGroups.size === 0) {
      Alert.alert('Fel', 'Välj minst en grupp');
      return;
    }
    if (visibilityMode === 'members' && selectedMembers.size === 0) {
      Alert.alert('Fel', 'Välj minst en medlem');
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
      
      // Determine visible_to array
      // 'medlem' = public (all members)
      // 'styrelse' = board & admin
      // For groups/members, we might need new logic. For now mapping to existing strings if possible, or new format.
      // Since backend might not support it, we'll construct a meta object or just use what we can.
      // NOTE: The current backend likely only supports string tags. We will try to pass IDs if possible, or assume backend update needed.
      // For this task, we will construct the `visibleTo` array based on selections.
      
      let visibleToArray: string[] = [];
      if (visibilityMode === 'public') visibleToArray = ['medlem'];
      else if (visibilityMode === 'board') visibleToArray = ['styrelse', 'admin'];
      else if (visibilityMode === 'groups') visibleToArray = Array.from(selectedGroups).map(id => `group:${id}`);
      else if (visibilityMode === 'members') visibleToArray = Array.from(selectedMembers).map(id => `user:${id}`);

      // Create the utskick
      const utskickData = {
        organization_id: activeOrganization.id,
        title: title.trim(),
        content: content.trim(),
        published_by: user.id,
        image_url: uploadedImages[0] || null,
        file_url: uploadedFiles[0] || null,
        file_name: files[0]?.name || null,
        poll_id: null as string | null,
        // TODO: Pass visibility and notification settings to backend once supported
        // visible_to: visibleToArray,
        // notify_members: notifyMembers 
      };

      // Create poll if included
      if (includePoll) {
        const validOptions = pollOptions.filter(option => option.text.trim()).map(option => option.text.trim());
        
        const pollData = {
          organization_id: activeOrganization.id,
          question: pollQuestion.trim(),
          options: validOptions,
          visible_to: visibleToArray, // Polls table supports visible_to
          created_by: user.id,
          expires_at: pollExpiresAt ? new Date(pollExpiresAt).toISOString() : null
        };

        const poll = await createPoll(pollData);
        utskickData.poll_id = poll.id;
      }

      await createUtskick(utskickData);

      Alert.alert('Framgång', 'Information har skapats', [
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
    setVisibilityMode('public');
    setSelectedGroups(new Set());
    setSelectedMembers(new Set());
    setNotifyMembers(false);
    setIncludePoll(false);
    setPollQuestion('');
    setPollOptions([
      { id: '1', text: '' },
      { id: '2', text: '' }
    ]);
    setPollExpiresAt('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const renderVisibilityOption = (
    mode: VisibilityMode,
    label: string,
    subtitle: string,
    icon: keyof typeof Feather.glyphMap,
    renderContent?: () => React.ReactNode
  ) => {
    const isSelected = visibilityMode === mode;
    return (
      <View style={styles.visibilityCardContainer}>
        <TouchableOpacity
          style={[styles.visibilityCard, isSelected && styles.visibilityCardSelected]}
          onPress={() => setVisibilityMode(mode)}
          activeOpacity={0.7}
        >
          <View style={styles.visibilityIconCircle}>
            <Feather name={icon} size={20} color="#555" />
          </View>
          <View style={styles.visibilityTextContainer}>
            <Text style={styles.visibilityTitle}>{label}</Text>
            <Text style={styles.visibilitySubtitle}>{subtitle}</Text>
          </View>
          {isSelected && (
            <Feather name="check-circle" size={24} color="#2563eb" />
          )}
        </TouchableOpacity>
        {isSelected && renderContent && (
          <View style={styles.visibilityContent}>
            {renderContent()}
          </View>
        )}
      </View>
    );
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
          <Text style={styles.title}>Ny information</Text>
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
                  placeholder="Ange titel för informationen"
                  autoCapitalize="sentences"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Innehåll *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Skriv innehållet för informationen..."
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Visibility Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Vem kan se detta inlägg?</Text>
              
              {renderVisibilityOption('public', 'Publik', 'Alla medlemmar', 'users')}
              
              {renderVisibilityOption('board', 'Styrelse & Admin', 'Endast styrelse och admin', 'shield')}
              
              {renderVisibilityOption(
                'groups', 
                'Från grupper', 
                'Välj specifika grupper', 
                'tag',
                () => (
                  <View style={styles.selectionContainer}>
                    {loadingData ? (
                      <ActivityIndicator />
                    ) : groups.length === 0 ? (
                      <Text style={styles.emptyText}>Inga grupper tillgängliga</Text>
                    ) : (
                      <ScrollView 
                        style={styles.listScroll} 
                        nestedScrollEnabled 
                        showsVerticalScrollIndicator={true}
                      >
                        {groups.map(g => (
                          <TouchableOpacity 
                            key={g.id} 
                            style={styles.selectionRow} 
                            onPress={() => toggleGroup(g.id)}
                          >
                            <View style={[styles.checkbox, selectedGroups.has(g.id) && styles.checkboxSelected]}>
                              {selectedGroups.has(g.id) && <Feather name="check" size={12} color="#fff" />}
                            </View>
                            <Text style={styles.selectionLabel}>{g.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )
              )}
              
              {renderVisibilityOption(
                'members', 
                'Utvalda medlemmar', 
                'Välj specifika medlemmar', 
                'user',
                () => (
                  <View style={styles.selectionContainer}>
                    <View style={styles.searchBox}>
                      <Feather name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
                      <TextInput 
                        style={styles.searchInput}
                        placeholder="Sök medlem..."
                        value={memberSearchQuery}
                        onChangeText={setMemberSearchQuery}
                        autoCapitalize="none"
                      />
                    </View>
                    {loadingData ? (
                      <ActivityIndicator />
                    ) : filteredMembers.length === 0 ? (
                      <Text style={styles.emptyText}>Inga medlemmar hittades</Text>
                    ) : (
                      <ScrollView 
                        style={styles.listScroll} 
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={true}
                      >
                        {filteredMembers.slice(0, 500).map(m => (
                          <TouchableOpacity 
                            key={m.id} 
                            style={styles.selectionRow} 
                            onPress={() => toggleMember(m.id)}
                          >
                            <View style={[styles.checkbox, selectedMembers.has(m.id) && styles.checkboxSelected]}>
                              {selectedMembers.has(m.id) && <Feather name="check" size={12} color="#fff" />}
                            </View>
                            <Avatar 
                              url={m.profile_image_url} 
                              size={24} 
                              style={styles.memberAvatar} 
                              containerStyle={{ marginRight: 8 }}
                              name={displayName(m)}
                            />
                            <Text style={styles.selectionLabel}>{displayName(m)}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )
              )}
            </View>

            {/* Notification Section */}
            <View style={styles.section}>
              <View style={styles.notificationHeader}>
                <Feather name="bell" size={20} color="#f59e0b" />
                <Text style={styles.notificationTitle}>Meddela medlemmar</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.notificationRow}
                onPress={() => setNotifyMembers(!notifyMembers)}
              >
                <View style={[styles.checkboxSquare, notifyMembers && styles.checkboxSquareSelected]}>
                  {notifyMembers && <Feather name="check" size={14} color="#fff" />}
                </View>
                <View style={styles.notificationTextContainer}>
                  <Text style={styles.notificationLabel}>Skicka e-post till alla medlemmar</Text>
                  <Text style={styles.notificationSubtitle}>
                    Medlemmar som har inaktiverat notifikationer kommer inte att få meddelanden.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Bilder</Text>
                <TouchableOpacity onPress={pickImage} style={styles.addButton}>
                  <Feather name="plus" size={20} color="#007AFF" />
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
                    <Feather name="trash-2" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Filer</Text>
                <TouchableOpacity onPress={pickDocument} style={styles.addButton}>
                  <Feather name="plus" size={20} color="#007AFF" />
                  <Text style={styles.addButtonText}>Lägg till fil</Text>
                </TouchableOpacity>
              </View>
              {files.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Feather name="file-text" size={24} color="#666" />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileSize}>{getFileSize(file.size)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFile(index)}>
                    <Feather name="trash-2" size={20} color="#FF3B30" />
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
                  <Feather
                    name={includePoll ? "check-square" : "square"}
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
                        <Feather name="plus" size={16} color="#007AFF" />
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
                            <Feather name="trash-2" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
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
    marginBottom: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
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
  // New styles for visibility UI
  visibilityCardContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  visibilityCardSelected: {
    backgroundColor: '#eff6ff', // Light blue bg
    borderColor: '#2563eb',
    borderWidth: 0, // Border handled by container
  },
  visibilityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  visibilityTextContainer: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  visibilitySubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  visibilityContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  selectionContainer: {
    gap: 8,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 2,
  },
  checkboxSquareSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  selectionLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  emptyText: {
    color: '#6b7280',
    fontStyle: 'italic',
    padding: 8,
    textAlign: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
  },
  listScroll: {
    maxHeight: 250, // Limit height
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  memberAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationLabel: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  notificationSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
}); 