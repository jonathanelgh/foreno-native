import { Avatar } from './Avatar';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
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
import { 
  getOrganizationGroups, 
  getOrganizationMembersForNewConversation, 
  type OrgMemberForPicker 
} from '../lib/api/messages';
import { supabase } from '../lib/supabase';
import { OrganizationConversation } from '../types/database';

interface CreateEventSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

export function CreateEventSheet({ visible, onClose, onSuccess }: CreateEventSheetProps) {
  const { activeOrganization, user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours later
  const [eventType, setEventType] = useState<'regular' | 'meeting'>('regular');
  
  // Visibility State
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('public');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  
  // Data for pickers
  const [groups, setGroups] = useState<OrganizationConversation[]>([]);
  const [members, setMembers] = useState<OrgMemberForPicker[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  // Notification options
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

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

  const handleCreate = async () => {
    if (!activeOrganization || !user) return;

    if (!title.trim()) {
      Alert.alert('Fel', 'Titel är obligatorisk');
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

    setLoading(true);
    
    try {
      // Convert times to time strings
      const startTimeStr = startTime.toTimeString().split(' ')[0];
      const endTimeStr = endTime.toTimeString().split(' ')[0];
      
      // Determine visible_to array
      // 'medlem' = public (all members)
      // 'styrelse' = board & admin
      // For groups/members, we currently map to these string tags or pass IDs if backend supports it.
      // Based on CreateUtskickSheet logic, we prepare the array but backend might only support limited tags yet.
      
      /* 
      let visibleToArray: string[] = [];
      if (visibilityMode === 'public') visibleToArray = ['medlem'];
      else if (visibilityMode === 'board') visibleToArray = ['styrelse', 'admin'];
      else if (visibilityMode === 'groups') visibleToArray = Array.from(selectedGroups).map(id => `group:${id}`);
      else if (visibilityMode === 'members') visibleToArray = Array.from(selectedMembers).map(id => `user:${id}`);
      */

      const eventData = {
        organization_id: activeOrganization.id,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        event_date: eventDate.toISOString().split('T')[0], // YYYY-MM-DD format
        start_time: startTimeStr,
        end_time: endTimeStr,
        event_type: eventType,
        mandatory_for: null, // Removed field
        created_by: user.id,
        notify_via_email: sendEmailNotification,
        notify_via_sms: false, // Disabled
        // TODO: Pass visibility settings to backend once supported by events table
        // visible_to: visibleToArray
      };

      const { error } = await supabase
        .from('events')
        .insert([eventData]);

      if (error) {
        console.error('Error creating event:', error);
        Alert.alert('Fel', 'Kunde inte skapa aktivitet');
        return;
      }

      Alert.alert('Framgång', `${eventType === 'meeting' ? 'Möte' : 'Aktivitet'} har skapats`, [
        { text: 'OK', onPress: () => {
          resetForm();
          onSuccess();
          onClose();
        }}
      ]);
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Fel', 'Ett oväntat fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setEventDate(new Date());
    setStartTime(new Date());
    setEndTime(new Date(Date.now() + 2 * 60 * 60 * 1000));
    setEventType('regular');
    setVisibilityMode('public');
    setSelectedGroups(new Set());
    setSelectedMembers(new Set());
    setMemberSearchQuery('');
    setSendEmailNotification(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
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
          <Text style={styles.title}>Ny aktivitet</Text>
          <TouchableOpacity 
            style={[styles.createButton, loading && styles.createButtonDisabled]} 
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Skapar...' : 'Skapa'}
            </Text>
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
                  placeholder="Ange titel för aktiviteten"
                  autoCapitalize="sentences"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Typ av aktivitet</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[styles.typeButton, eventType === 'regular' && styles.typeButtonActive]}
                    onPress={() => setEventType('regular')}
                  >
                    <Text style={[styles.typeButtonText, eventType === 'regular' && styles.typeButtonTextActive]}>
                      Aktivitet
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, eventType === 'meeting' && styles.typeButtonActive]}
                    onPress={() => setEventType('meeting')}
                  >
                    <Text style={[styles.typeButtonText, eventType === 'meeting' && styles.typeButtonTextActive]}>
                      Möte
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Beskrivning</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Beskriv aktiviteten..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Plats</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Var äger aktiviteten rum?"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Datum *</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateButtonText}>{formatDate(eventDate)}</Text>
                  <Feather name="calendar" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Starttid</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartTimePicker(true)}>
                    <Text style={styles.dateButtonText}>{formatTime(startTime)}</Text>
                    <Feather name="clock" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Sluttid</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndTimePicker(true)}>
                    <Text style={styles.dateButtonText}>{formatTime(endTime)}</Text>
                    <Feather name="clock" size={20} color="#6b7280" />
                  </TouchableOpacity>
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notifikationer</Text>
                <Text style={[styles.helpText, { marginBottom: 12 }]}>
                  Push-notiser skickas automatiskt till medlemmar med appen
                </Text>
                
                <TouchableOpacity 
                  style={styles.checkboxRow}
                  onPress={() => setSendEmailNotification(!sendEmailNotification)}
                >
                  <View style={styles.checkbox}>
                    {sendEmailNotification && (
                      <Feather name="check" size={18} color="#2563eb" />
                    )}
                  </View>
                  <View style={styles.checkboxLabel}>
                    <Text style={styles.checkboxText}>Skicka e-postnotifiering</Text>
                    <Text style={styles.checkboxSubtext}>Skickas till alla medlemmar via e-post</Text>
                  </View>
                </TouchableOpacity>

                {/* SMS Notification removed */}
              </View>
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showDatePicker}
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerCancelText}>Avbryt</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>Välj datum</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDoneText}>Klar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display="spinner"
                  onChange={(event: any, selectedDate?: Date) => {
                    if (selectedDate) {
                      setEventDate(selectedDate);
                    }
                  }}
                  style={styles.picker}
                />
              </View>
            </View>
          </Modal>
        )}

        {showStartTimePicker && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showStartTimePicker}
            onRequestClose={() => setShowStartTimePicker(false)}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                    <Text style={styles.pickerCancelText}>Avbryt</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>Välj starttid</Text>
                  <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                    <Text style={styles.pickerDoneText}>Klar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="spinner"
                  onChange={(event: any, selectedTime?: Date) => {
                    if (selectedTime) {
                      setStartTime(selectedTime);
                    }
                  }}
                  style={styles.picker}
                />
              </View>
            </View>
          </Modal>
        )}

        {showEndTimePicker && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showEndTimePicker}
            onRequestClose={() => setShowEndTimePicker(false)}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                    <Text style={styles.pickerCancelText}>Avbryt</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>Välj sluttid</Text>
                  <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                    <Text style={styles.pickerDoneText}>Klar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="spinner"
                  onChange={(event: any, selectedTime?: Date) => {
                    if (selectedTime) {
                      setEndTime(selectedTime);
                    }
                  }}
                  style={styles.picker}
                />
              </View>
            </View>
          </Modal>
        )}
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
    height: 80,
    paddingTop: 10,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  bottomPadding: {
    height: 80,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
  },
  checkboxText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  checkboxSubtext: {
    fontSize: 13,
    color: '#6b7280',
  },
  smsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  smsWarningText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  picker: {
    height: 200,
  },
  // New styles for visibility UI
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  visibilityCardContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
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
  checkboxSelected: {
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
}); 