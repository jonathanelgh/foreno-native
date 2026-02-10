import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { IconSymbol } from './ui/IconSymbol';
import { Check, ChevronDown } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { ListingDetail } from '../lib/api/marketplace';

interface ReportListingModalProps {
  visible: boolean;
  onClose: () => void;
  listing: ListingDetail;
  reporterName: string;
  reporterId: string;
  reporterEmail?: string;
}

const REPORT_SUBJECTS = [
  { label: 'Bedrägeri eller bluff', value: 'Bedrägeri eller bluff' },
  { label: 'Olämpligt innehåll', value: 'Olämpligt innehåll' },
  { label: 'Stötande bilder', value: 'Stötande bilder' },
  { label: 'Förbjuden vara eller tjänst', value: 'Förbjuden vara eller tjänst' },
  { label: 'Felaktig information', value: 'Felaktig information' },
  { label: 'Spam eller dubblettannons', value: 'Spam eller dubblettannons' },
  { label: 'Annat', value: 'Annat' },
];

export const ReportListingModal: React.FC<ReportListingModalProps> = ({
  visible,
  onClose,
  listing,
  reporterName,
  reporterId,
  reporterEmail,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const creatorName = listing.creator
    ? [listing.creator.first_name, listing.creator.last_name].filter(Boolean).join(' ') || 'Okänd'
    : 'Okänd';

  const formatPrice = (price: number | null, type: string) => {
    if (type === 'give') return 'Gratis';
    if (price === null || price === 0) return 'Pris ej angivet';
    return `${price.toLocaleString('sv-SE')} kr`;
  };

  const handleSubmit = async () => {
    if (!selectedSubject) {
      Alert.alert('Välj ämne', 'Du behöver välja ett ämne för din rapport.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await supabase.functions.invoke('report-listing', {
        body: {
          listing_id: listing.id,
          listing_title: listing.title,
          listing_description: listing.description,
          listing_price: formatPrice(listing.price, listing.transaction_type),
          listing_transaction_type: listing.transaction_type,
          listing_category: listing.category?.name,
          listing_city: listing.city,
          listing_created_by_name: creatorName,
          reporter_id: reporterId,
          reporter_name: reporterName,
          reporter_email: reporterEmail,
          subject: selectedSubject,
          message: message.trim(),
        },
      });

      if (res.error) {
        throw res.error;
      }

      Alert.alert(
        'Tack för din rapport',
        'Vi har tagit emot din rapport och kommer att granska annonsen.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (e) {
      console.error('Error sending report:', e);
      Alert.alert('Fel', 'Kunde inte skicka rapporten. Försök igen senare.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedSubject(null);
    setDropdownOpen(false);
    setMessage('');
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rapportera annons</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Listing summary */}
            <View style={styles.listingSummary}>
              <Text style={styles.listingSummaryTitle} numberOfLines={2}>
                {listing.title}
              </Text>
              <Text style={styles.listingSummaryMeta}>
                {formatPrice(listing.price, listing.transaction_type)}
                {listing.city ? ` · ${listing.city}` : ''}
              </Text>
            </View>

            {/* Subject dropdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vad vill du rapportera?</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  dropdownOpen && styles.dropdownTriggerOpen,
                ]}
                onPress={() => setDropdownOpen(!dropdownOpen)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    !selectedSubject && styles.dropdownPlaceholder,
                  ]}
                >
                  {selectedSubject || 'Välj ämne...'}
                </Text>
                <ChevronDown
                  size={20}
                  color="#9ca3af"
                  style={{ transform: [{ rotate: dropdownOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {dropdownOpen && (
                <View style={styles.dropdownList}>
                  {REPORT_SUBJECTS.map((subject, index) => (
                    <TouchableOpacity
                      key={subject.value}
                      style={[
                        styles.dropdownItem,
                        selectedSubject === subject.value && styles.dropdownItemActive,
                        index === REPORT_SUBJECTS.length - 1 && styles.dropdownItemLast,
                      ]}
                      onPress={() => {
                        setSelectedSubject(subject.value);
                        setDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedSubject === subject.value && styles.dropdownItemTextActive,
                        ]}
                      >
                        {subject.label}
                      </Text>
                      {selectedSubject === subject.value && (
                        <Check size={18} color={Colors.light.tint} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Message */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Beskriv problemet (valfritt)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ge oss mer detaljer om varför du rapporterar denna annons..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
                maxLength={1000}
              />
              <Text style={styles.charCount}>{message.length}/1000</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedSubject && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedSubject || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Skicka rapport</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  listingSummary: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  listingSummaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  listingSummaryMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dropdownTriggerOpen: {
    borderColor: Colors.light.tint,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: '#e5e7eb',
  },
  dropdownTriggerText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  dropdownPlaceholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  dropdownList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.light.tint,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dropdownItemTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    backgroundColor: '#fff',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
