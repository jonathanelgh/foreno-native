import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateBookingSheet } from '../components/CreateBookingSheet';
import { ProductImage } from '../components/ProductImage';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookingWithProduct, 
  BookingProductWithDetails,
  cancelBooking, 
  getUserBookings, 
  getBookingProducts 
} from '../lib/api/bookings';

export default function BookingsScreen() {
  const router = useRouter();
  const { user, activeOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState<'book' | 'my_bookings'>('book');
  const [bookings, setBookings] = useState<BookingWithProduct[]>([]);
  const [products, setProducts] = useState<BookingProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [selectedProductForSheet, setSelectedProductForSheet] = useState<BookingProductWithDetails | null>(null);

  const loadData = async () => {
    if (!user || !activeOrganization) return;
    try {
      const [bookingsData, productsData] = await Promise.all([
        getUserBookings(activeOrganization.id, user.id),
        getBookingProducts(activeOrganization.id)
      ]);
      setBookings(bookingsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fel', 'Kunde inte ladda data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, activeOrganization]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleProductPress = (product: BookingProductWithDetails) => {
    setSelectedProductForSheet(product);
    setShowCreateSheet(true);
  };

  const handleCancel = (booking: BookingWithProduct) => {
    Alert.alert(
      'Avboka',
      'Är du säker på att du vill avboka?',
      [
        { text: 'Nej', style: 'cancel' },
        {
          text: 'Ja, avboka',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.id) return;
              await cancelBooking(booking.id, user.id);
              loadData(); // Refresh list
            } catch (error) {
              Alert.alert('Fel', 'Kunde inte avboka');
            }
          }
        }
      ]
    );
  };

  const renderProductItem = ({ item }: { item: BookingProductWithDetails }) => (
    <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)}>
      <ProductImage 
        path={item.image_path} 
        bucket={item.image_bucket} 
        containerStyle={styles.iconPlaceholder}
        style={styles.productImage}
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        {item.description && <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>}
      </View>
      <Feather name="chevron-right" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );

  const renderBookingItem = ({ item }: { item: BookingWithProduct }) => {
    const start = new Date(item.start_at);
    const end = new Date(item.end_at);
    const isCancelled = item.status === 'cancelled';
    const isPast = end < new Date();

    return (
      <View style={[styles.card, isCancelled && styles.cardCancelled]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isCancelled && styles.textCancelled]}>
            {item.booking_products?.name || 'Okänt objekt'}
          </Text>
          <View style={[
            styles.statusBadge, 
            isCancelled ? styles.statusCancelled : (isPast ? styles.statusPast : styles.statusActive)
          ]}>
            <Text style={[
              styles.statusText, 
              isCancelled ? styles.statusTextCancelled : (isPast ? styles.statusTextPast : styles.statusTextActive)
            ]}>
              {isCancelled ? 'Avbokad' : (isPast ? 'Avslutad' : 'Kommande')}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Feather name="calendar" size={16} color="#64748b" />
            <Text style={styles.value}>
              {start.toLocaleDateString('sv-SE')}
            </Text>
          </View>
          <View style={styles.row}>
            <Feather name="clock" size={16} color="#64748b" />
            <Text style={styles.value}>
              {start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {!isCancelled && !isPast && (
          <View style={styles.cardFooter}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => handleCancel(item)}
            >
              <Text style={styles.cancelButtonText}>Avboka</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Bokning</Text>
            {activeOrganization && (
              <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'book' && styles.activeTab]}
          onPress={() => setActiveTab('book')}
        >
          <Text style={[styles.tabText, activeTab === 'book' && styles.activeTabText]}>Boka</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'my_bookings' && styles.activeTab]}
          onPress={() => setActiveTab('my_bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'my_bookings' && styles.activeTabText]}>Mina bokningar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <View style={styles.content}>
          {activeTab === 'book' ? (
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="calendar" size={48} color="#9ca3af" />
                  <Text style={styles.emptyText}>Inga bokningsbara objekt hittades</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={bookings}
              renderItem={renderBookingItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="calendar" size={48} color="#9ca3af" />
                  <Text style={styles.emptyText}>Inga bokningar hittades</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      <CreateBookingSheet 
        visible={showCreateSheet} 
        onClose={() => {
          setShowCreateSheet(false);
          setSelectedProductForSheet(null);
        }}
        onSuccess={() => {
          loadData();
          setActiveTab('my_bookings'); // Switch to my bookings after booking
        }}
        initialProduct={selectedProductForSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 8,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#64748b',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
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
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardCancelled: {
    opacity: 0.7,
    backgroundColor: '#f9fafb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  textCancelled: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#d1fae5',
  },
  statusPast: {
    backgroundColor: '#f1f5f9',
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextPast: {
    color: '#64748b',
  },
  statusTextCancelled: {
    color: '#dc2626',
  },
  cardBody: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 12,
  },
  cardFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontWeight: '500',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
