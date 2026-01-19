import React, { useCallback, useEffect, useState } from 'react';
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
import { CreateEventSheet } from '../../components/CreateEventSheet';
import { EventDetailModal } from '../../components/EventDetailModal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types/database';

type FilterType = 'kommande' | 'tidigare' | 'alla';

export default function EventsScreen() {
  const { activeOrganization, isAdmin, isStyrelse } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('kommande');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!activeOrganization) return;

    try {
      let query = supabase
        .from('events')
        .select('*')
        .eq('organization_id', activeOrganization.id);

      const today = new Date().toISOString().split('T')[0];

      // Apply filter
      if (filter === 'kommande') {
        query = query.gte('event_date', today).order('event_date', { ascending: true });
      } else if (filter === 'tidigare') {
        query = query.lt('event_date', today).order('event_date', { ascending: false });
      } else {
        // 'alla' - show all events, ordered by date (newest first for past, oldest first for future)
        query = query.order('event_date', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading events:', error);
        Alert.alert('Fel', 'Kunde inte ladda aktiviteter');
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Fel', 'Ett oväntat fel uppstod');
    }
  }, [activeOrganization, filter]);

  useEffect(() => {
    loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    const dayNames = [
      'söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'
    ];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName} ${day} ${month} ${year}`;
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    
    // Convert time string to readable format
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };

  const formatCalendarMonth = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN',
      'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'
    ];
    return monthNames[date.getMonth()];
  };

  const formatCalendarDay = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate().toString();
  };

  const formatCalendarWeekday = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['SÖN', 'MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR'];
    return weekdays[date.getDay()];
  };

  const formatEventTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    const eventDate = new Date(dateString);
    return (
      today.getDate() === eventDate.getDate() &&
      today.getMonth() === eventDate.getMonth() &&
      today.getFullYear() === eventDate.getFullYear()
    );
  };

  const isTomorrow = (dateString: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const eventDate = new Date(dateString);
    return (
      tomorrow.getDate() === eventDate.getDate() &&
      tomorrow.getMonth() === eventDate.getMonth() &&
      tomorrow.getFullYear() === eventDate.getFullYear()
    );
  };

  const getDateLabel = (dateString: string) => {
    if (isToday(dateString)) return 'Idag';
    if (isTomorrow(dateString)) return 'Imorgon';
    return formatDate(dateString);
  };

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => {
        setSelectedEvent(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.calendarDateContainer}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarMonth}>{formatCalendarMonth(item.event_date)}</Text>
        </View>
        <View style={styles.calendarBody}>
          <Text style={styles.calendarDay}>{formatCalendarDay(item.event_date)}</Text>
          <Text style={styles.calendarWeekday}>{formatCalendarWeekday(item.event_date)}</Text>
        </View>
      </View>

      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {(item.start_time || item.location) && (
          <View style={styles.eventMetaRow}>
            {item.start_time && (
              <View style={styles.eventMetaItem}>
                <Text style={styles.eventMetaIcon}>🕒</Text>
                <Text style={styles.eventMetaText}>
                  {formatEventTime(item.start_time)}
                  {item.end_time && ` - ${formatEventTime(item.end_time)}`}
                </Text>
              </View>
            )}
            {item.location && (
              <View style={styles.eventMetaItem}>
                <Text style={styles.eventMetaIcon}>📍</Text>
                <Text style={styles.eventMetaText} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>
        )}

      </View>
    </TouchableOpacity>
  );

  const handleCreateEvent = () => {
    setShowCreateSheet(true);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Laddar aktiviteter...</Text>
        </View>
      );
    }

    if (!activeOrganization) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Ingen organisation vald</Text>
          <Text style={styles.stateDescription}>
            Välj en organisation för att se kalendern.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.contentInner}>
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563eb']}
            />
          }
          ListEmptyComponent={
            <View style={styles.stateContainer}>
              <Text style={styles.stateTitle}>
                {filter === 'kommande' && 'Inga kommande aktiviteter'}
                {filter === 'tidigare' && 'Inga tidigare aktiviteter'}
                {filter === 'alla' && 'Inga aktiviteter'}
              </Text>
              <Text style={styles.stateDescription}>
                Dra nedåt för att uppdatera.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Kalender</Text>
            {activeOrganization && (
              <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
            )}
          </View>
          {(isAdmin || isStyrelse) && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateEvent}
            >
              <Text style={styles.createButtonText}>+ Ny</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.headerFilters, (isAdmin || isStyrelse) && styles.headerFiltersWithAction]}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'kommande' && styles.filterButtonActive]}
            onPress={() => setFilter('kommande')}
          >
            <Text style={[styles.filterButtonText, filter === 'kommande' && styles.filterButtonTextActive]}>Kommande</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'tidigare' && styles.filterButtonActive]}
            onPress={() => setFilter('tidigare')}
          >
            <Text style={[styles.filterButtonText, filter === 'tidigare' && styles.filterButtonTextActive]}>Tidigare</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'alla' && styles.filterButtonActive]}
            onPress={() => setFilter('alla')}
          >
            <Text style={[styles.filterButtonText, filter === 'alla' && styles.filterButtonTextActive]}>Alla</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <EventDetailModal
        event={selectedEvent}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      <CreateEventSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSuccess={() => {
          loadEvents();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
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
  headerFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
    paddingBottom: 0,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 0,
    alignItems: 'center',
  },
  filterButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#2563eb',
  },
  createButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerActionContainer: {
    marginLeft: 16,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentInner: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  calendarDateContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    minWidth: 60,
    overflow: 'hidden',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  calendarHeader: {
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  calendarMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  calendarBody: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 3,
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
  },
  calendarDay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    lineHeight: 28,
  },
  calendarWeekday: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  eventContent: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 6,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 20,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  eventMetaIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  eventMetaText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 1,
  },
  eventDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingTop: 50, // Add space for status bar
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  headerFiltersWithAction: {
    marginTop: 8,
  },
});
