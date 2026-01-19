import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
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
import { supabase } from '../lib/supabase';

interface CreateEventSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  const [mandatoryFor, setMandatoryFor] = useState('');
  
  // Notification options
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [sendSmsNotification, setSendSmsNotification] = useState(false);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleCreate = async () => {
    if (!activeOrganization || !user) return;

    if (!title.trim()) {
      Alert.alert('Fel', 'Titel är obligatorisk');
      return;
    }

    setLoading(true);
    
    try {
      // Convert times to time strings
      const startTimeStr = startTime.toTimeString().split(' ')[0];
      const endTimeStr = endTime.toTimeString().split(' ')[0];
      
      // Parse mandatory_for into array
      const mandatoryArray = mandatoryFor.trim() 
        ? mandatoryFor.split(',').map(item => item.trim()).filter(item => item.length > 0)
        : [];

      const eventData = {
        organization_id: activeOrganization.id,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        event_date: eventDate.toISOString().split('T')[0], // YYYY-MM-DD format
        start_time: startTimeStr,
        end_time: endTimeStr,
        event_type: eventType,
        mandatory_for: mandatoryArray.length > 0 ? mandatoryArray : null,
        created_by: user.id,
        notify_via_email: sendEmailNotification,
        notify_via_sms: sendSmsNotification,
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
    setMandatoryFor('');
    setSendEmailNotification(true);
    setSendSmsNotification(false);
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
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Starttid</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartTimePicker(true)}>
                    <Text style={styles.dateButtonText}>{formatTime(startTime)}</Text>
                    <Ionicons name="time-outline" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Sluttid</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndTimePicker(true)}>
                    <Text style={styles.dateButtonText}>{formatTime(endTime)}</Text>
                    <Ionicons name="time-outline" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Obligatorisk för (valfritt)</Text>
                <TextInput
                  style={styles.input}
                  value={mandatoryFor}
                  onChangeText={setMandatoryFor}
                  placeholder="t.ex. styrelse, spelare, alla (separera med komma)"
                  autoCapitalize="none"
                />
                <Text style={styles.helpText}>
                  Ange roller som denna aktivitet är obligatorisk för, separerade med komma
                </Text>
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
                      <Ionicons name="checkmark" size={18} color="#2563eb" />
                    )}
                  </View>
                  <View style={styles.checkboxLabel}>
                    <Text style={styles.checkboxText}>Skicka e-postnotifiering</Text>
                    <Text style={styles.checkboxSubtext}>Skickas till alla medlemmar via e-post</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.checkboxRow}
                  onPress={() => setSendSmsNotification(!sendSmsNotification)}
                >
                  <View style={styles.checkbox}>
                    {sendSmsNotification && (
                      <Ionicons name="checkmark" size={18} color="#2563eb" />
                    )}
                  </View>
                  <View style={styles.checkboxLabel}>
                    <Text style={styles.checkboxText}>Skicka SMS-notifiering</Text>
                    <View style={styles.smsWarning}>
                      <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                      <Text style={styles.smsWarningText}>Extra kostnad tillkommer</Text>
                    </View>
                  </View>
                </TouchableOpacity>
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
}); 