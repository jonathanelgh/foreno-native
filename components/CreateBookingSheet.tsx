import { Feather } from '@expo/vector-icons';
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
  BookingProductAvailability,
  BusySlot,
  createBooking,
  getBookingProducts,
  getBusySlots,
} from '../lib/api/bookings';
import { getMessageImageUrl } from '../lib/storage';
import type { BookingConfirmationData } from './BookingConfirmationModal';

// ── Time-slot helper functions ──

type AbsWindow = { start: number; end: number };

/**
 * Build absolute availability windows (as epoch ms ranges) for a given
 * base date and a number of surrounding days. This lets us check coverage
 * for slots that span midnight or multiple days.
 */
function buildAbsoluteAvailabilityWindows(
  availability: BookingProductAvailability[],
  baseDate: Date,
  extraDays: number
): AbsWindow[] {
  const result: AbsWindow[] = [];

  // Check the selected day and a few surrounding days
  for (let dayOffset = -1; dayOffset <= extraDays; dayOffset++) {
    const day = new Date(baseDate);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);
    const isoWeekday = day.getDay() === 0 ? 7 : day.getDay();

    for (const w of availability) {
      if (!w.is_active || w.weekday !== isoWeekday || !w.start_time || !w.end_time) continue;

      const [sH, sM] = w.start_time.split(':').map(Number);
      const [eH, eM] = w.end_time.split(':').map(Number);

      const wStart = new Date(day);
      wStart.setHours(sH, sM, 0, 0);
      const wEnd = new Date(day);
      wEnd.setHours(eH, eM, 0, 0);

      // 24-hour window
      if (w.start_time === w.end_time) {
        wEnd.setDate(wEnd.getDate() + 1);
      }
      // Overnight window
      else if (wEnd.getTime() <= wStart.getTime()) {
        wEnd.setDate(wEnd.getDate() + 1);
      }

      result.push({ start: wStart.getTime(), end: wEnd.getTime() });
    }
  }

  // Sort by start time for efficient walking
  result.sort((a, b) => a.start - b.start);
  return result;
}

/**
 * Walk from slotStart to slotEnd, checking that every point is covered
 * by at least one availability window. Returns false as soon as a gap
 * is found.
 */
function isSlotFullyCoveredByAvailability(
  slotStart: number,
  slotEnd: number,
  windows: AbsWindow[]
): boolean {
  let cursor = slotStart;

  while (cursor < slotEnd) {
    // Find a window that contains `cursor`
    const covering = windows.find((w) => w.start <= cursor && cursor < w.end);
    if (!covering) return false;

    // Advance cursor to the end of this window (or slotEnd, whichever is sooner)
    cursor = Math.min(covering.end, slotEnd);
  }

  return true;
}

/**
 * Check whether a slot [slotStart, slotEnd) overlaps with any busy range.
 * Overlap: aStart < bEnd && aEnd > bStart
 */
function rangesOverlap(
  slotStart: number,
  slotEnd: number,
  busyRanges: { start: number; end: number }[]
): boolean {
  return busyRanges.some((b) => slotStart < b.end && slotEnd > b.start);
}

/**
 * Format a duration in minutes to a human-readable Swedish string.
 * Examples: 30 → "30 min", 60 → "1 tim", 120 → "2 tim", 1440 → "1 dygn"
 */
function formatDuration(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 dygn' : `${days} dygn`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 tim' : `${hours} tim`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} tim ${mins} min`;
  }
  return `${minutes} min`;
}

// ── Component ──

// ── Custom calendar that greys out unavailable dates ──

const WEEKDAY_LABELS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

function BookingCalendar({
  selectedDate,
  onSelectDate,
  availability,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  availability: BookingProductAvailability[];
}) {
  const [viewMonth, setViewMonth] = React.useState(() => {
    const d = new Date(selectedDate);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Which ISO weekdays (1=Mon..7=Sun) have active availability?
  const availableWeekdays = React.useMemo(() => {
    const set = new Set<number>();
    for (const w of availability) {
      if (w.is_active) set.add(w.weekday);
    }
    return set;
  }, [availability]);

  const isDateAvailable = (date: Date): boolean => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d < today) return false;
    // Max 180 days out
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 180);
    if (d > maxDate) return false;
    const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
    return availableWeekdays.has(isoWeekday);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // Build calendar grid
  const calendarDays = React.useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    // Monday-based: Mon=0..Sun=6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [viewMonth]);

  const goPrevMonth = () => {
    const prev = new Date(viewMonth);
    prev.setMonth(prev.getMonth() - 1);
    // Don't go before current month
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (prev >= thisMonth) setViewMonth(prev);
  };

  const goNextMonth = () => {
    const next = new Date(viewMonth);
    next.setMonth(next.getMonth() + 1);
    const maxMonth = new Date(today);
    maxMonth.setMonth(maxMonth.getMonth() + 6);
    if (next <= maxMonth) setViewMonth(next);
  };

  return (
    <View style={calStyles.container}>
      {/* Month header */}
      <View style={calStyles.monthHeader}>
        <TouchableOpacity onPress={goPrevMonth} style={calStyles.monthArrow}>
          <Feather name="chevron-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={goNextMonth} style={calStyles.monthArrow}>
          <Feather name="chevron-right" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={calStyles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={calStyles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.dayGrid}>
        {calendarDays.map((date, idx) => {
          if (!date) {
            return <View key={`empty-${idx}`} style={calStyles.dayCell} />;
          }

          const available = isDateAvailable(date);
          const selected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={calStyles.dayCell}
              onPress={() => available && onSelectDate(date)}
              disabled={!available}
              activeOpacity={0.6}
            >
              <View style={[
                calStyles.dayInner,
                selected && calStyles.dayInnerSelected,
              ]}>
                <Text
                  style={[
                    calStyles.dayText,
                    selected && calStyles.dayTextSelected,
                    !available && calStyles.dayTextDisabled,
                    isToday && !selected && calStyles.dayTextToday,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthArrow: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    paddingVertical: 4,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInnerSelected: {
    backgroundColor: '#2563eb',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#d1d5db',
  },
  dayTextToday: {
    color: '#2563eb',
    fontWeight: '700',
  },
});

// ── Main component ──

interface CreateBookingSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a booking is created. Receives data for the confirmation popup. */
  onBooked: (data: BookingConfirmationData) => void;
  initialProduct?: BookingProductWithDetails | null;
}

type Step = 'product' | 'duration' | 'date' | 'time' | 'confirm';

export function CreateBookingSheet({ visible, onClose, onBooked, initialProduct }: CreateBookingSheetProps) {
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
      const SLOT_STEP_MINUTES = 15;
      const MIN_ADVANCE_MINUTES = 5;
      const durationMs = selectedDuration * 60_000;

      // 1. Get active availability windows for the selected weekday (ISO: Mon=1..Sun=7)
      const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
      const windows = selectedProduct.availability.filter(
        (a) => a.weekday === dayOfWeek && a.is_active
      );

      if (windows.length === 0) {
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      // 2. Compute absolute Date ranges for each window on the selected date.
      //    Also collect the full availability for isSlotFullyCoveredByAvailability.
      type AbsWindow = { start: Date; end: Date };
      const absWindows: AbsWindow[] = [];

      for (const w of windows) {
        if (!w.start_time || !w.end_time) continue;
        const [sH, sM] = w.start_time.split(':').map(Number);
        const [eH, eM] = w.end_time.split(':').map(Number);

        const wStart = new Date(selectedDate);
        wStart.setHours(sH, sM, 0, 0);

        const wEnd = new Date(selectedDate);
        wEnd.setHours(eH, eM, 0, 0);

        // 24-hour window: start_time === end_time  →  full day
        if (w.start_time === w.end_time) {
          wEnd.setDate(wEnd.getDate() + 1);
        }
        // Overnight window: end < start  →  end is on the next day
        else if (wEnd.getTime() <= wStart.getTime()) {
          wEnd.setDate(wEnd.getDate() + 1);
        }

        absWindows.push({ start: wStart, end: wEnd });
      }

      // 3. Determine query range for busy slots (cover overnight & multi-day durations)
      let queryFrom = new Date(selectedDate);
      queryFrom.setHours(0, 0, 0, 0);
      let queryTo = new Date(selectedDate);
      queryTo.setHours(0, 0, 0, 0);
      queryTo.setDate(queryTo.getDate() + 2); // next day end to cover overnight

      // Extend further if duration is very long (multi-day)
      const extraDays = Math.ceil(selectedDuration / 1440);
      if (extraDays > 1) {
        queryTo.setDate(queryTo.getDate() + extraDays);
      }

      // 4. Fetch busy (confirmed) bookings via RPC
      const busySlots = await getBusySlots(selectedProduct.id, queryFrom, queryTo);
      const busyRanges = busySlots.map((b) => ({
        start: new Date(b.start_at).getTime(),
        end: new Date(b.end_at).getTime(),
      }));

      // 5. Build the full set of availability windows for the surrounding days
      //    (needed for isSlotFullyCoveredByAvailability when slots span midnight)
      const allAbsWindows = buildAbsoluteAvailabilityWindows(
        selectedProduct.availability,
        selectedDate,
        extraDays + 1
      );

      // 6. Generate candidate slots
      const now = new Date();
      const minStart = new Date(now.getTime() + MIN_ADVANCE_MINUTES * 60_000);
      const slots: { start: Date; end: Date }[] = [];
      const seenStartTimes = new Set<number>();

      for (const aw of absWindows) {
        let cursor = aw.start.getTime();
        const windowEnd = aw.end.getTime();

        while (cursor < windowEnd) {
          const slotStart = cursor;
          const slotEnd = cursor + durationMs;

          // Filter 1: Must be at least MIN_ADVANCE_MINUTES in the future
          if (slotStart < minStart.getTime()) {
            cursor += SLOT_STEP_MINUTES * 60_000;
            continue;
          }

          // Filter 2: No duplicate start times
          if (seenStartTimes.has(slotStart)) {
            cursor += SLOT_STEP_MINUTES * 60_000;
            continue;
          }

          // Filter 3: Entire slot must be covered by availability windows
          if (!isSlotFullyCoveredByAvailability(slotStart, slotEnd, allAbsWindows)) {
            cursor += SLOT_STEP_MINUTES * 60_000;
            continue;
          }

          // Filter 4: Must not overlap any existing booking
          if (rangesOverlap(slotStart, slotEnd, busyRanges)) {
            cursor += SLOT_STEP_MINUTES * 60_000;
            continue;
          }

          seenStartTimes.add(slotStart);
          slots.push({ start: new Date(slotStart), end: new Date(slotEnd) });

          cursor += SLOT_STEP_MINUTES * 60_000;
        }
      }

      // 7. Sort chronologically
      slots.sort((a, b) => a.start.getTime() - b.start.getTime());
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

      // Close the sheet and pass confirmation data to parent
      const bookingData: BookingConfirmationData = {
        productName: selectedProduct.name || 'Bokning',
        productInfo: selectedProduct.info || null,
        startAt: selectedTimeSlot.start,
        endAt: selectedTimeSlot.end,
        durationMinutes: selectedDuration!,
      };
      handleClose();
      onBooked(bookingData);
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
            {step === 'duration' && (selectedProduct ? `Välj längd – ${selectedProduct.name}` : 'Välj längd')}
            {step === 'date' && 'Välj datum'}
            {step === 'time' && `Lediga tider ${selectedDate.toLocaleDateString('sv-SE')}`}
            {step === 'confirm' && 'Bekräfta bokning'}
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
              {selectedProduct.durations.map(d => (
                <TouchableOpacity 
                  key={d.id} 
                  style={styles.optionCard}
                  onPress={() => handleDurationSelect(d.minutes)}
                >
                  <Feather name="clock" size={24} color="#2563eb" />
                  <Text style={styles.optionText}>{formatDuration(d.minutes)}</Text>
                  <Feather name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 'date' && (
            <View style={styles.stepContainer}>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                availability={selectedProduct?.availability || []}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleDateConfirm}>
                <Text style={styles.primaryBtnText}>Fortsätt</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'time' && (
            <View style={styles.stepContainer}>
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
                  <Text style={styles.confirmValue}>{selectedDuration ? formatDuration(selectedDuration) : ''}</Text>
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
