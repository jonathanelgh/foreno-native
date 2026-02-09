import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AttendanceWithProfile } from '../types/database';

interface AttendeesModalProps {
  visible: boolean;
  onClose: () => void;
  attendance: AttendanceWithProfile[];
  currentUserId?: string;
}

type AttendanceTabType = 'attending' | 'not_attending' | 'no_response';

export function AttendeesModal({ visible, onClose, attendance, currentUserId }: AttendeesModalProps) {
  const [activeTab, setActiveTab] = useState<AttendanceTabType>('attending');

  const getAttendanceByStatus = (status: AttendanceTabType) => {
    switch (status) {
      case 'attending':
        return attendance.filter(a => a.status === 'attending');
      case 'not_attending':
        return attendance.filter(a => a.status === 'not_attending');
      case 'no_response':
        return attendance.filter(a => !a.status || a.status === null);
      default:
        return [];
    }
  };

  const getTabIcon = (tab: AttendanceTabType) => {
    switch (tab) {
      case 'attending': return 'checkmark-circle';
      case 'not_attending': return 'close-circle';
      case 'no_response': return 'help-circle';
    }
  };

  const getTabLabel = (tab: AttendanceTabType) => {
    switch (tab) {
      case 'attending': return 'Kommer';
      case 'not_attending': return 'Kommer ej';
      case 'no_response': return 'Ej svarat';
    }
  };

  const getTabColor = (tab: AttendanceTabType) => {
    switch (tab) {
      case 'attending': return '#10b981';
      case 'not_attending': return '#ef4444';
      case 'no_response': return '#6b7280';
    }
  };

  const getTabCount = (tab: AttendanceTabType) => {
    return getAttendanceByStatus(tab).length;
  };

  const renderAttendeeList = (attendees: AttendanceWithProfile[]) => {
    if (attendees.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="users" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>Inga deltagare i denna kategori</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.attendeeList}>
        {attendees.map((attendee, index) => {
          const firstName = attendee.user_profiles?.first_name || '';
          const lastName = attendee.user_profiles?.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          const displayName = fullName || 'Okänd användare';
          const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
          const isCurrentUser = attendee.user_id === currentUserId;
          
          return (
            <View key={attendee.id} style={styles.attendeeCard}>
              <View style={styles.attendeeInfo}>
                <View style={[
                  styles.attendeeAvatar,
                  { backgroundColor: getTabColor(activeTab) + '20' }
                ]}>
                  <Text style={[
                    styles.attendeeInitial,
                    { color: getTabColor(activeTab) }
                  ]}>
                    {initials}
                  </Text>
                </View>
                <View style={styles.attendeeDetails}>
                  <Text style={styles.attendeeName}>
                    {isCurrentUser ? 'Du' : displayName}
                  </Text>
                  {attendee.memberships?.board_title && (
                    <Text style={styles.attendeeRole}>{attendee.memberships.board_title}</Text>
                  )}
                </View>
              </View>
              {isCurrentUser && (
                <View style={styles.currentUserBadge}>
                  <Text style={styles.currentUserBadgeText}>Du</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
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
            <Text style={styles.headerTitle}>Deltagare</Text>
            <Text style={styles.headerSubtitle}>
              {attendance.length} personer inbjudna
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsRow}>
            {(['attending', 'not_attending', 'no_response'] as AttendanceTabType[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.activeTab,
                  { 
                    backgroundColor: activeTab === tab ? getTabColor(tab) + '10' : '#f9fafb',
                    borderTopWidth: 3,
                    borderTopColor: activeTab === tab ? getTabColor(tab) : 'transparent',
                  }
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Feather 
                  name={getTabIcon(tab)} 
                  size={14} 
                  color={activeTab === tab ? getTabColor(tab) : '#6b7280'} 
                />
                <Text style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                  { color: activeTab === tab ? getTabColor(tab) : '#6b7280' }
                ]}>
                  {getTabLabel(tab)}
                </Text>
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: activeTab === tab ? getTabColor(tab) : '#9ca3af' }
                ]}>
                  <Text style={styles.tabBadgeText}>{getTabCount(tab)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderAttendeeList(getAttendanceByStatus(activeTab))}
        </View>
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
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 0,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#f9fafb',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1f2937',
  },
  tabBadge: {
    backgroundColor: '#9ca3af',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  attendeeList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendeeInitial: {
    fontSize: 16,
    fontWeight: '600',
  },
  attendeeDetails: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  attendeeRole: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  currentUserBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentUserBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
}); 