import { Avatar } from '../../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NewConversationModal } from '../../components/NewConversationModal';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCount } from '../../contexts/UnreadCountContext';
import {
  getConversationsForUser,
  getOrganizationConversationsForUser,
  getOrganizationMemberUserIds,
  getPinnedOrganizationConversations,
} from '../../lib/api/messages';
import type { Conversation, OrganizationConversation } from '../../types/database';

type ListItem =
  | { type: 'direct'; conversation: Conversation & { other_user?: { id: string; first_name: string | null; last_name: string | null; profile_image_url: string | null } | null, listing?: { id: string; title: string; image_url: string | null } | null } }
  | { type: 'organization'; conversation: OrganizationConversation };

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Igår';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function displayName(other: { first_name: string | null; last_name: string | null } | null): string {
  if (!other) return 'Okänd';
  const first = other.first_name?.trim() || '';
  const last = other.last_name?.trim() || '';
  return [first, last].filter(Boolean).join(' ') || 'Okänd';
}

const UNREAD_REFRESH_INTERVAL_MS = 20000;

export default function MessagesScreen() {
  const { user, activeOrganization, loading: authLoading } = useAuth();
  const { getUnreadCount, refreshUnreadCounts } = useUnreadCount();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (!activeOrganization) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const orgId = activeOrganization.id;
      const [direct, pinnedOrgConversations, userOrgConversations, orgMemberIds] = await Promise.all([
        getConversationsForUser(user.id),
        getPinnedOrganizationConversations(orgId),
        getOrganizationConversationsForUser(orgId, user.id),
        getOrganizationMemberUserIds(orgId),
      ]);

      const pinnedIds = new Set(pinnedOrgConversations.map((c) => c.id));
      const restOrgConversations = userOrgConversations.filter((c) => !pinnedIds.has(c.id));

      const otherUserId = (c: Conversation) =>
        c.participant1_id === user.id ? c.participant2_id : c.participant1_id;
      const directInOrg = direct.filter((c) => orgMemberIds.has(otherUserId(c)));
      const directItems: ListItem[] = directInOrg.map((c) => ({ type: 'direct', conversation: c }));
      const restOrgItems: ListItem[] = restOrgConversations.map((c) => ({
        type: 'organization',
        conversation: c,
      }));

      const pinnedOrg: ListItem[] = pinnedOrgConversations.map((c) => ({
        type: 'organization',
        conversation: c,
      }));

      const getLastMessageAt = (item: ListItem) =>
        item.type === 'direct'
          ? (item.conversation as Conversation).last_message_at
          : (item.conversation as OrganizationConversation).last_message_at;

      const rest = [...restOrgItems, ...directItems].sort((a, b) => {
        const at = getLastMessageAt(a);
        const bt = getLastMessageAt(b);
        if (!at) return 1;
        if (!bt) return -1;
        return new Date(bt).getTime() - new Date(at).getTime();
      });

      const merged: ListItem[] = [...pinnedOrg, ...rest];
      setItems(merged);
      await refreshUnreadCounts();
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte ladda meddelanden');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, activeOrganization?.id, refreshUnreadCounts]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id && activeOrganization?.id) refreshUnreadCounts();
    }, [user?.id, activeOrganization?.id, refreshUnreadCounts])
  );

  useEffect(() => {
    if (!user?.id) return;
    refreshIntervalRef.current = setInterval(refreshUnreadCounts, UNREAD_REFRESH_INTERVAL_MS);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [user?.id, refreshUnreadCounts]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onPress = (item: ListItem) => {
    const type = item.type === 'direct' ? 'direct' : 'organization';
    router.push({ pathname: `/conversation/${item.conversation.id}`, params: { type } });
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    const isDirect = item.type === 'direct';
    const conv = item.conversation;
    const unread = getUnreadCount(isDirect ? 'direct' : 'organization', conv.id);
    const lastMessage = 'last_message' in conv ? conv.last_message : null;
    const lastAt = 'last_message_at' in conv ? conv.last_message_at : null;
    const orgConv = !isDirect && (conv as OrganizationConversation);
    const title = isDirect
      ? displayName((conv as Conversation & { other_user?: { first_name: string | null; last_name: string | null } }).other_user ?? null)
      : orgConv.name;
    const isPinnedOrgType = orgConv?.type === 'all_members' || orgConv?.type === 'board_admin';
    const subtitle = !isDirect && !isPinnedOrgType ? (orgConv.type === 'group' ? 'Grupp' : orgConv.type || 'Konversation') : null;

    const directConv = isDirect && (conv as Conversation & { other_user?: { profile_image_url?: string | null }, listing?: { title: string } | null });
    const profileImageUrl = isDirect ? directConv?.other_user?.profile_image_url : null;
    const listing = isDirect ? directConv?.listing : null;

    return (
      <TouchableOpacity style={styles.row} onPress={() => onPress(item)} activeOpacity={0.7}>
        <View style={styles.avatarContainer}>
          {isDirect ? (
            <Avatar 
              url={listing?.image_url || profileImageUrl} 
              size={48} 
              style={styles.avatarImage} 
              containerStyle={styles.avatar}
              name={title}
            />
          ) : (
            <View style={styles.avatar}>
              <Feather name={isDirect ? 'user' : 'users'} size={22} color="#6b7280" />
            </View>
          )}
          {listing && (
            <View style={styles.listingBadge}>
              <Feather name="shopping-bag" size={10} color="#ffffff" />
            </View>
          )}
        </View>
        
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <View style={styles.titleContainer}>
              <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
              {listing && (
                <View style={styles.listingTag}>
                  <Text style={styles.listingTagText}>ANNONS</Text>
                </View>
              )}
            </View>
            <View style={styles.metaContainer}>
              {unread > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
              <Text style={styles.rowTime}>{formatTime(lastAt)}</Text>
            </View>
          </View>
          
          {listing ? (
            <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
          ) : subtitle ? (
            <Text style={styles.rowSubtitle}>{subtitle}</Text>
          ) : null}
          
          {lastMessage ? (
            <Text style={styles.rowPreview} numberOfLines={2}>{lastMessage}</Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={18} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  const headerRight = activeOrganization ? (
    <TouchableOpacity
      style={styles.headerRightBtn}
      onPress={() => setShowNewConversationModal(true)}
    >
      <Feather name="edit-3" size={22} color="#2563eb" />
    </TouchableOpacity>
  ) : null;

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meddelanden</Text>
          {headerRight}
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
        <NewConversationModal
          visible={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
          onStartConversation={() => load()}
        />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meddelanden</Text>
          {headerRight}
        </View>
        <View style={styles.content}>
          <Feather name="message-circle" size={56} color="#9ca3af" />
          <Text style={styles.emptyTitle}>Inga meddelanden</Text>
          <Text style={styles.emptyDescription}>
            Meddelanden och konversationer visas här när de finns.
          </Text>
        </View>
        <NewConversationModal
          visible={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
          onStartConversation={() => load()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meddelanden</Text>
        {headerRight}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.conversation.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      />
      <NewConversationModal
        visible={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onStartConversation={() => load()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerRightBtn: {
    padding: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  listingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#22c55e', // Green color for listing badge
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
  },
  listingTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listingTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'uppercase',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444', // Red color for unread badge
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  listingTitle: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '500',
    marginBottom: 2,
  },
  rowTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 4,
  },
  rowPreview: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
