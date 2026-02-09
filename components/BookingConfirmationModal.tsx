import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Duration formatting (same as CreateBookingSheet) ──

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

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Animated checkmark ──

function AnimatedCheckmark() {
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ring fade in
    Animated.timing(ringOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Ring pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 0.95,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Checkmark pop-in with delay
    setTimeout(() => {
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      Animated.spring(checkScale, {
        toValue: 1,
        damping: 8,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    }, 200);
  }, []);

  return (
    <View style={checkStyles.container}>
      <Animated.View
        style={[
          checkStyles.ring,
          { transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />
      <Animated.View
        style={[
          checkStyles.iconCircle,
          { transform: [{ scale: checkScale }], opacity: checkOpacity },
        ]}
      >
        <Feather name="check" size={32} color="#ffffff" />
      </Animated.View>
    </View>
  );
}

const checkStyles = StyleSheet.create({
  container: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#22c55e',
    opacity: 0.4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Props ──

export type BookingConfirmationData = {
  productName: string;
  productInfo?: string | null;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
};

interface BookingConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  /** Navigate to "My Bookings" tab. If omitted, the primary button is hidden. */
  onViewMyBookings?: () => void;
  /** Booking data to display */
  booking: BookingConfirmationData | null;
  /** When true, shows the confirmation header (checkmark + title). When false, shows a read-only detail view. */
  isConfirmation?: boolean;
}

// ── Component ──

export function BookingConfirmationModal({
  visible,
  onClose,
  onViewMyBookings,
  booking,
  isConfirmation = true,
}: BookingConfirmationModalProps) {
  if (!booking) return null;

  const durationStr = formatDuration(booking.durationMinutes);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.popup}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={12}
          >
            <Feather name="x" size={22} color="#6b7280" />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header area */}
            {isConfirmation ? (
              <View style={styles.headerArea}>
                <AnimatedCheckmark />
                <Text style={styles.title}>Bokning bekräftad</Text>
                <Text style={styles.subtitle}>
                  Din bokning är skapad och sparad.
                </Text>
              </View>
            ) : (
              <View style={styles.headerArea}>
                <View style={styles.detailIconCircle}>
                  <Feather name="calendar" size={28} color="#2563eb" />
                </View>
                <Text style={styles.title}>Bokningsdetaljer</Text>
              </View>
            )}

            {/* Booking details card */}
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Objekt</Text>
                <Text style={styles.detailValue}>{booking.productName}</Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Start</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(booking.startAt)}
                </Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Slut</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(booking.endAt)}
                </Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Varaktighet</Text>
                <Text style={styles.detailValue}>{durationStr}</Text>
              </View>
            </View>

            {/* Product info card (conditional) */}
            {booking.productInfo ? (
              <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Feather name="info" size={16} color="#2563eb" />
                  <Text style={styles.infoTitle}>Information</Text>
                </View>
                <Text style={styles.infoText}>{booking.productInfo}</Text>
              </View>
            ) : null}

            {/* Action buttons */}
            <View style={styles.actions}>
              {onViewMyBookings && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    onClose();
                    onViewMyBookings();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>
                    Visa mina bokningar
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>Stäng</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  popup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 28,
  },
  // Header
  headerArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
  },
  detailIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  // Details card
  detailsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  // Info card
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  // Actions
  actions: {
    marginTop: 8,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
