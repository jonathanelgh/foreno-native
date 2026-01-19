import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getEventAttendanceWithMembers, getMeetingDetails } from '../lib/api/events';
import { Event, MeetingDetails } from '../types/database';

interface EventDetailModalProps {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
}

type TabType = 'agenda' | 'documents' | 'notes';

const { height: screenHeight } = Dimensions.get('window');

export function EventDetailModal({ visible, event, onClose }: EventDetailModalProps) {
  const { user } = useAuth();
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails | null>(null);
  const [loadingMeetingDetails, setLoadingMeetingDetails] = useState(false);
  const [eventAttendance, setEventAttendance] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('agenda');

  useEffect(() => {
    if (event && visible) {
      if (event.event_type === 'meeting') {
        loadMeetingDetails();
      }
      loadEventAttendance();
    }
  }, [event, visible]);

  const loadMeetingDetails = async () => {
    if (!event) return;
    
    setLoadingMeetingDetails(true);
    try {
      const details = await getMeetingDetails(event.id);
      setMeetingDetails(details);
    } catch (error) {
      console.error('Error loading meeting details:', error);
    } finally {
      setLoadingMeetingDetails(false);
    }
  };

  const loadEventAttendance = async () => {
    if (!event || !event.organization_id) return;
    
    try {
      const attendance = await getEventAttendanceWithMembers(event.id, event.organization_id);
      setEventAttendance(attendance);
    } catch (error) {
      console.error('Error loading event attendance:', error);
    }
  };


  if (!event) return null;

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

  const formatTime = (timeString: string) => {
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

  const isPastEvent = (dateString: string) => {
    const today = new Date();
    const eventDate = new Date(dateString);
    return eventDate < today;
  };

  const handleDocumentPress = async (fileUrl: string | null) => {
    if (fileUrl) {
      try {
        await Linking.openURL(fileUrl);
      } catch (error) {
        console.error('Error opening document:', error);
        Alert.alert('Fel', 'Kunde inte öppna dokumentet.');
      }
    }
  };

  const getAttendanceStatusColor = (status: string | null) => {
    switch (status) {
      case 'attending': return '#10b981';
      case 'not_attending': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getAttendanceStatusText = (status: string | null) => {
    switch (status) {
      case 'attending': return 'Kommer';
      case 'not_attending': return 'Kommer ej';
      default: return 'Ej anmäld';
    }
  };

  const addToGoogleCalendar = async () => {
    if (!event) return;

    try {
      // Parse date and time
      const eventDate = new Date(event.event_date);
      const startTime = event.start_time ? event.start_time.split(':') : ['09', '00'];
      const endTime = event.end_time ? event.end_time.split(':') : ['10', '00'];

      const startDate = new Date(eventDate);
      startDate.setHours(parseInt(startTime[0]), parseInt(startTime[1]), 0, 0);

      const endDate = new Date(eventDate);
      endDate.setHours(parseInt(endTime[0]), parseInt(endTime[1]), 0, 0);

      // Format dates for Google Calendar (YYYYMMDDTHHmmss format in UTC)
      const formatGoogleDate = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
      };

      const startDateStr = formatGoogleDate(startDate);
      const endDateStr = formatGoogleDate(endDate);

      // Build Google Calendar URL
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${startDateStr}/${endDateStr}`,
        details: event.description || '',
        location: event.location || '',
        ctz: 'Europe/Stockholm',
      });

      const googleCalendarUrl = `https://www.google.com/calendar/render?${params.toString()}`;

      // Open Google Calendar
      const canOpen = await Linking.canOpenURL(googleCalendarUrl);
      if (canOpen) {
        await Linking.openURL(googleCalendarUrl);
      } else {
        Alert.alert('Fel', 'Kunde inte öppna Google Kalender.');
      }
    } catch (error) {
      console.error('Error opening Google Calendar:', error);
      Alert.alert('Fel', 'Kunde inte öppna Google Kalender.');
    }
  };

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'agenda': return 'list';
      case 'documents': return 'document-text';
      case 'notes': return 'create';
    }
  };

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case 'agenda': return 'Dagordning';
      case 'documents': return 'Dokument';
      case 'notes': return 'Anteckningar';
    }
  };

  const getTabCount = (tab: TabType) => {
    switch (tab) {
      case 'agenda': return meetingDetails?.agenda?.length || 0;
      case 'documents': return meetingDetails?.documents?.length || 0;
      case 'notes': return meetingDetails?.notes ? 1 : 0;
      default: return 0;
    }
  };

  const renderTabContent = () => {
    if (loadingMeetingDetails) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Laddar mötesdetaljer...</Text>
        </View>
      );
    }

    if (!meetingDetails) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="information-circle" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>Inga mötesdetaljer tillgängliga</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'agenda':
        return (
          <View style={styles.tabContent}>
            {meetingDetails.agenda.length > 0 ? (
              meetingDetails.agenda.map((item, index) => (
                <View key={item.id} style={styles.agendaCard}>
                  <View style={styles.agendaHeader}>
                    <View style={styles.agendaNumber}>
                      <Text style={styles.agendaNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.agendaContent}>
                      <View style={styles.agendaTitleRow}>
                        <Text style={styles.agendaTitle}>{item.title}</Text>
                        {item.duration_minutes && (
                          <View style={styles.durationBadge}>
                            <Ionicons name="time" size={12} color="#6b7280" />
                            <Text style={styles.durationText}>{item.duration_minutes}min</Text>
                          </View>
                        )}
                      </View>
                      {item.description && (
                        <Text style={styles.agendaDescription}>{item.description}</Text>
                      )}
                      {item.is_completed && (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          <Text style={styles.completedText}>Genomförd</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyTabContent}>
                <Ionicons name="list" size={48} color="#9ca3af" />
                <Text style={styles.emptyTabText}>Ingen dagordning tillgänglig</Text>
                <Text style={styles.emptyTabSubtext}>Dagordningspunkter kommer att visas här</Text>
              </View>
            )}
          </View>
        );

      case 'documents':
        return (
          <View style={styles.tabContent}>
            {meetingDetails.documents.length > 0 ? (
              meetingDetails.documents.map((doc, index) => (
                <TouchableOpacity
                  key={doc.id}
                  style={[styles.documentCard, { marginBottom: index < meetingDetails.documents.length - 1 ? 12 : 0 }]}
                  onPress={() => handleDocumentPress(doc.documents?.file_url)}
                >
                  <View style={styles.documentIcon}>
                    <Ionicons name="document-text" size={24} color="#2563eb" />
                  </View>
                  <View style={styles.documentContent}>
                    <Text style={styles.documentTitle}>
                      {doc.documents?.title || doc.documents?.file_name || 'Namnlöst dokument'}
                    </Text>
                    {doc.documents?.description && (
                      <Text style={styles.documentDescription}>
                        {doc.documents.description}
                      </Text>
                    )}
                    <View style={styles.documentMeta}>
                      <Text style={styles.documentType}>
                        {doc.documents?.file_type?.toUpperCase() || 'DOKUMENT'}
                      </Text>
                      {doc.documents?.file_size && (
                        <>
                          <Text style={styles.documentSize}> • </Text>
                          <Text style={styles.documentSize}>
                            {(doc.documents.file_size / 1024 / 1024).toFixed(1)} MB
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyTabContent}>
                <Ionicons name="document-text" size={48} color="#9ca3af" />
                <Text style={styles.emptyTabText}>Inga dokument tillgängliga</Text>
                <Text style={styles.emptyTabSubtext}>Dokument kommer att visas här när de läggs till</Text>
              </View>
            )}
          </View>
        );

      case 'notes':
        return (
          <View style={styles.tabContent}>
            {meetingDetails.notes && meetingDetails.notes.content ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesContent}>{meetingDetails.notes.content}</Text>
              </View>
            ) : (
              <View style={styles.emptyTabContent}>
                <Ionicons name="create" size={48} color="#9ca3af" />
                <Text style={styles.emptyTabText}>Inga anteckningar tillgängliga</Text>
                <Text style={styles.emptyTabSubtext}>Mötesanteckningar kommer att visas här</Text>
              </View>
            )}
          </View>
        );

    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Aktivitet</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Event Type Badge */}
          <View style={styles.badgeContainer}>
            <View style={[
              styles.eventTypeBadge,
              event.event_type === 'meeting' ? styles.meetingBadge : styles.activityBadge
            ]}>
              {event.event_type === 'meeting' ? (
                <>
                  <Ionicons name="people" size={14} color="#3b82f6" />
                  <Text style={[styles.eventTypeBadgeText, styles.meetingBadgeText]}>Möte</Text>
                </>
              ) : (
                <>
                  <Ionicons name="calendar" size={14} color="#16a34a" />
                  <Text style={[styles.eventTypeBadgeText, styles.activityBadgeText]}>Aktivitet</Text>
                </>
              )}
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Date and Time */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="calendar" size={20} color="#6b7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Datum</Text>
                <Text style={[styles.infoValue, isPastEvent(event.event_date) && styles.pastEventText]}>
                  {getDateLabel(event.event_date)}
                </Text>
              </View>
            </View>

            {(event.start_time || event.end_time) && (
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="time" size={20} color="#6b7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Tid</Text>
                  <Text style={styles.infoValue}>
                    {event.start_time && formatTime(event.start_time)}
                    {event.start_time && event.end_time && ' - '}
                    {event.end_time && formatTime(event.end_time)}
                  </Text>
                </View>
              </View>
            )}

            {event.location && (
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="location" size={20} color="#6b7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Plats</Text>
                  <Text style={styles.infoValue}>{event.location}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Beskrivning</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          )}

          {/* Add to Google Calendar Button */}
          <TouchableOpacity style={styles.addToCalendarButton} onPress={addToGoogleCalendar}>
            <View style={styles.addToCalendarContent}>
              <View style={styles.calendarIconContainer}>
                <Ionicons name="calendar-outline" size={22} color="#2563eb" />
              </View>
              <View style={styles.addToCalendarText}>
                <Text style={styles.addToCalendarTitle}>Lägg till i Google Kalender</Text>
                <Text style={styles.addToCalendarSubtitle}>Öppnas i Google Kalender</Text>
              </View>
              <Ionicons name="add-circle" size={24} color="#2563eb" />
            </View>
          </TouchableOpacity>

          {/* Meeting-specific content */}
          {event.event_type === 'meeting' && (
            <View style={styles.tabsContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.tabsHeader}
                contentContainerStyle={styles.tabsHeaderContent}
              >
                {(['agenda', 'documents', 'notes'] as TabType[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tab,
                      activeTab === tab && styles.activeTab
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Ionicons 
                      name={getTabIcon(tab)} 
                      size={16} 
                      color={activeTab === tab ? '#2563eb' : '#6b7280'} 
                    />
                    <Text style={[
                      styles.tabText,
                      activeTab === tab && styles.activeTabText
                    ]}>
                      {getTabLabel(tab)}
                    </Text>
                    {getTabCount(tab) > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{getTabCount(tab)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {renderTabContent()}
            </View>
          )}

          {/* Mandatory for */}
          {event.mandatory_for && event.mandatory_for.length > 0 && (
            <View style={styles.mandatorySection}>
              <Text style={styles.sectionTitle}>Obligatorisk för</Text>
              <View style={styles.mandatoryContainer}>
                {event.mandatory_for.map((role, index) => (
                  <View key={index} style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryBadgeText}>{role}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Past event indicator */}
          {isPastEvent(event.event_date) && (
            <View style={styles.pastEventBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.pastEventBannerText}>Denna aktivitet har genomförts</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  badgeContainer: {
    marginTop: 20,
    marginBottom: 8,
  },
  eventTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  meetingBadge: {
    backgroundColor: '#dbeafe',
  },
  activityBadge: {
    backgroundColor: '#dcfce7',
  },
  eventTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meetingBadgeText: {
    color: '#3b82f6',
  },
  activityBadgeText: {
    color: '#16a34a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
    lineHeight: 34,
  },
  infoSection: {
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  pastEventText: {
    color: '#6b7280',
  },
  descriptionSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  participantsSection: {
    marginBottom: 32,
  },
  participantsList: {
    marginTop: 12,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  participantInitial: {
    fontSize: 16,
    fontWeight: '600',
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  participantRole: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  participantStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  participantStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyParticipantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  emptyParticipantsText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 8,
  },
  tabsContainer: {
    marginBottom: 32,
  },
     tabsHeader: {
     marginBottom: 16,
   },
   tabsHeaderContent: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 8,
     paddingHorizontal: 16,
   },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
  },
  activeTab: {
    borderColor: '#2563eb',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#2563eb',
  },
  tabBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  tabContent: {
    padding: 16,
  },
  agendaCard: {
    marginBottom: 16,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  agendaNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  agendaNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  agendaContent: {
    flex: 1,
  },
  agendaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  agendaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  durationText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  agendaDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  completedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  documentDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  documentType: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  documentSize: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  notesCard: {
    padding: 16,
  },
  notesContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  emptyTabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
     emptyTabText: {
     fontSize: 16,
     color: '#6b7280',
     fontWeight: '500',
   },
   emptyTabSubtext: {
     fontSize: 14,
     color: '#9ca3af',
     marginTop: 8,
     textAlign: 'center',
   },
   emptyContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     padding: 32,
   },
   emptyText: {
     fontSize: 16,
     color: '#6b7280',
     fontWeight: '500',
     marginTop: 12,
   },
   attendeeCard: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between',
     padding: 16,
     backgroundColor: '#ffffff',
     borderRadius: 8,
     marginBottom: 8,
     borderWidth: 1,
     borderColor: '#f3f4f6',
   },
  attendanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 12,
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendeeInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  attendeeDetails: {
    flex: 1,
  },
  attendeeId: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  attendeeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    gap: 4,
  },
  attendeeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  mandatorySection: {
    marginBottom: 32,
  },
  mandatoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mandatoryBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mandatoryBadgeText: {
    fontSize: 14,
    color: '#d97706',
    fontWeight: '500',
  },
  pastEventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 32,
    gap: 8,
  },
  pastEventBannerText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  addToCalendarButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2563eb',
    marginBottom: 24,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addToCalendarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  calendarIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addToCalendarText: {
    flex: 1,
  },
  addToCalendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  addToCalendarSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
}); 