import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  BookingProductWithDetails,
  createBooking,
  getBookingProducts,
  getBookingsForProduct
} from '../lib/api/bookings';
import { getMessageImageUrl } from '../lib/storage';

interface CreateBookingSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProduct?: BookingProductWithDetails | null;
}

type Step = 'product' | 'duration' | 'date' | 'time' | 'confirm';

export function CreateBookingSheet({ visible, onClose, onSuccess, initialProduct }: CreateBookingSheetProps) {
  const { activeOrganization, user, memberships } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<BookingProductWithDetails[]>([]);
  const [step, setStep] = useState<Step>('product');
  
  // Selection state
  const [selectedProduct, setSelectedProduct] = useState<BookingProductWithDetails | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null); // minutes
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<{ start: Date; end: Date }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Load products when modal opens
  useEffect(() => {
    if (visible && activeOrganization) {
      loadProducts();
    }
  }, [visible, activeOrganization]);

  // Handle initial product selection
  useEffect(() => {
    if (visible && initialProduct) {
      handleProductSelect(initialProduct);
    }
  }, [visible, initialProduct]);

  const loadProducts = async () => {
    if (!activeOrganization) return;
    setLoading(true);
    try {
      const data = await getBookingProducts(activeOrganization.id);
      
      // Load images if needed (assuming public/signed logic similar to messages)
      // For now assuming public or handling in display
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Fel', 'Kunde inte ladda bokningsbara objekt');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: BookingProductWithDetails) => {
    setSelectedProduct(product);
    if (product.durations && product.durations.length > 0) {
      // If only one duration, auto-select it? Maybe not, let user confirm.
      // But user flow typically wants less clicks.
      if (product.durations.length === 1) {
        setSelectedDuration(product.durations[0].minutes);
        setStep('date');
      } else {
        setStep('duration');
      }
    } else {
      // No durations defined? Default to 60 or handle as error?
      // Assuming at least one duration exists or free form (not supported yet)
      if (product.durations.length === 0) {
        // Fallback or error
        Alert.alert('Fel', 'Detta objekt har inga tidsalternativ');
        return;
      }
      setStep('duration');
    }
  };

  const handleDurationSelect = (minutes: number) => {
    setSelectedDuration(minutes);
    setStep('date');
  };

  const handleDateConfirm = () => {
    setStep('time');
    loadAvailableSlots();
  };

  const loadAvailableSlots = async () => {
    if (!selectedProduct || !selectedDuration) return;
    setLoadingSlots(true);
    
    try {
      // Logic to calculate slots
      // 1. Get availability rules for the selected weekday
      const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay(); // 1-7 (Mon-Sun)
      const rules = selectedProduct.availability.filter(a => a.weekday === dayOfWeek && a.is_active);
      
      if (rules.length === 0) {
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      // 2. Fetch existing bookings for the day
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const existingBookings = await getBookingsForProduct(selectedProduct.id, startOfDay, endOfDay);

      // 3. Generate slots
      const slots: { start: Date; end: Date }[] = [];
      const now = new Date();

      for (const rule of rules) {
        if (!rule.start_time || !rule.end_time) continue;
        
        const [startH, startM] = rule.start_time.split(':').map(Number);
        const [endH, endM] = rule.end_time.split(':').map(Number);
        
        // Create base dates for rule start/end on the selected date
        let current = new Date(selectedDate);
        current.setHours(startH, startM, 0, 0);
        
        const ruleEnd = new Date(selectedDate);
        ruleEnd.setHours(endH, endM, 0, 0);

        // If rule crosses midnight (e.g. 22:00 - 02:00), handle next day
        if (ruleEnd < current) {
          ruleEnd.setDate(ruleEnd.getDate() + 1);
        }

        while (current.getTime() + selectedDuration * 60000 <= ruleEnd.getTime()) {
          const slotStart = new Date(current);
          const slotEnd = new Date(current.getTime() + selectedDuration * 60000);

          // Check if slot is in the past
          if (slotStart < now) {
            current.setMinutes(current.getMinutes() + 30);
            continue; 
          }

          // Check overlap
          const isOverlapping = existingBookings.some(b => {
            const bStart = new Date(b.start_at);
            const bEnd = new Date(b.end_at);
            // Overlap logic: (StartA < EndB) and (EndA > StartB)
            return (slotStart < bEnd && slotEnd > bStart);
          });

          if (!isOverlapping) {
            slots.push({ start: slotStart, end: slotEnd });
          }

          // Move next - 30 min steps
          current.setMinutes(current.getMinutes() + 30);
        }
      }
      
      setAvailableSlots(slots);

    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte ladda tider');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBookingConfirm = async () => {
    if (!selectedProduct || !selectedTimeSlot || !user || !activeOrganization) return;
    
    // Find membership
    const membership = memberships.find(m => m.organization_id === activeOrganization.id);
    if (!membership) {
      Alert.alert('Fel', 'Du saknar medlemskap');
      return;
    }

    setLoading(true);
    try {
      await createBooking(
        selectedProduct.id,
        membership.id,
        selectedTimeSlot.start,
        selectedTimeSlot.end,
        user.id
      );
      
      Alert.alert('Bokat!', 'Din bokning är bekräftad.', [
        { text: 'OK', onPress: () => {
          handleClose();
          onSuccess();
        }}
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte skapa bokning');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('product');
    setSelectedProduct(null);
    setSelectedDuration(null);
    setSelectedTimeSlot(null);
    setAvailableSlots([]);
    onClose();
  };

  const handleBack = () => {
    // If initialProduct was provided, going back from the first visible step should close the modal
    if (initialProduct) {
      if (step === 'duration') return handleClose();
      if (step === 'date' && selectedProduct?.durations.length === 1) return handleClose();
    }

    if (step === 'product') return handleClose();
    if (step === 'duration') return setStep('product');
    if (step === 'date') return setStep(selectedProduct?.durations.length === 1 ? 'product' : 'duration');
    if (step === 'time') return setStep('date');
    if (step === 'confirm') return setStep('time');
  };

  // Render Helpers
  const renderProductItem = ({ item }: { item: BookingProductWithDetails }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleProductSelect(item)}>
      {item.image_path ? (
        // Placeholder for image loading if bucket is known
        <View style={styles.imagePlaceholder}>
           <Feather name="image" size={24} color="#ccc" />
        </View>
      ) : (
        <View style={styles.iconPlaceholder}>
          <Feather name="calendar" size={32} color="#2563eb" />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        {item.description && <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>}
      </View>
      <Feather name="chevron-right" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Feather name={step === 'product' ? 'x' : 'arrow-left'} size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'product' && 'Boka'}
            {step === 'duration' && 'Välj längd'}
            {step === 'date' && 'Välj datum'}
            {step === 'time' && 'Välj tid'}
            {step === 'confirm' && 'Bekräfta'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.content}>
          {/* Skip product list if initialProduct is provided or step is past product */}
          {step === 'product' && !initialProduct && (
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Inga bokningsbara objekt hittades.</Text>
                </View>
              }
            />
          )}

          {step === 'duration' && selectedProduct && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Hur länge vill du boka {selectedProduct.name}?</Text>
              {selectedProduct.durations.map(d => (
                <TouchableOpacity 
                  key={d.id} 
                  style={styles.optionCard}
                  onPress={() => handleDurationSelect(d.minutes)}
                >
                  <Feather name="clock" size={24} color="#2563eb" />
                  <Text style={styles.optionText}>{d.minutes} minuter</Text>
                  <Feather name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 'date' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Välj datum</Text>
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={(e, date) => date && setSelectedDate(date)}
                  minimumDate={new Date()}
                  locale="sv-SE"
                  style={styles.datePicker}
                />
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleDateConfirm}>
                <Text style={styles.primaryBtnText}>Fortsätt</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'time' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Lediga tider {selectedDate.toLocaleDateString('sv-SE')}</Text>
              {loadingSlots ? (
                <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
              ) : (
                <FlatList
                  data={availableSlots}
                  keyExtractor={(item) => item.start.toISOString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.timeSlot}
                      onPress={() => {
                        setSelectedTimeSlot(item);
                        setStep('confirm');
                      }}
                    >
                      <Text style={styles.timeSlotText}>
                        {item.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {item.end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Feather name="plus" size={20} color="#2563eb" />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Inga lediga tider detta datum.</Text>
                  }
                />
              )}
            </View>
          )}

          {step === 'confirm' && selectedProduct && selectedTimeSlot && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Bekräfta bokning</Text>
              
              <View style={styles.confirmCard}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Objekt</Text>
                  <Text style={styles.confirmValue}>{selectedProduct.name}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Datum</Text>
                  <Text style={styles.confirmValue}>{selectedDate.toLocaleDateString('sv-SE')}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Tid</Text>
                  <Text style={styles.confirmValue}>
                    {selectedTimeSlot.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {selectedTimeSlot.end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Längd</Text>
                  <Text style={styles.confirmValue}>{selectedDuration} min</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={handleBookingConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Boka nu</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
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
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  imagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7280',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 16,
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  datePicker: {
    width: '100%',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeSlot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timeSlotText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  confirmLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  confirmValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
});
