import { Avatar } from '../../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import type { Conversation, DirectConversation, OrganizationConversation } from '../../types/database';

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

function getLastMessageAt(item: ListItem): string | null {
  return item.type === 'direct'
    ? (item.conversation as Conversation).last_message_at
    : (item.conversation as OrganizationConversation).last_message_at;
}

function sortByLastMessage(a: ListItem, b: ListItem): number {
  const at = getLastMessageAt(a);
  const bt = getLastMessageAt(b);
  if (!at) return 1;
  if (!bt) return -1;
  return new Date(bt).getTime() - new Date(at).getTime();
}

const UNREAD_REFRESH_INTERVAL_MS = 20000;

/** Sort items: pinned org conversations stay at top in original order, rest sorted by last message */
function sortItemsWithPinned(a: ListItem, b: ListItem): number {
  const aPinned = a.type === 'organization' &&
    ((a.conversation as OrganizationConversation).type === 'all_members' ||
     (a.conversation as OrganizationConversation).type === 'board_admin');
  const bPinned = b.type === 'organization' &&
    ((b.conversation as OrganizationConversation).type === 'all_members' ||
     (b.conversation as OrganizationConversation).type === 'board_admin');

  if (aPinned && !bPinned) return -1;
  if (!aPinned && bPinned) return 1;
  if (aPinned && bPinned) return 0; // keep original order for pinned

  return sortByLastMessage(a, b);
}

export default function MessagesScreen() {
  const { user, activeOrganization, loading: authLoading } = useAuth();
  const { getUnreadCount, refreshUnreadCounts } = useUnreadCount();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [orgSectionExpanded, setOrgSectionExpanded] = useState(true);
  const [listingSectionExpanded, setListingSectionExpanded] = useState(true);
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

      const rest = [...restOrgItems, ...directItems].sort(sortByLastMessage);

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

  // Reload conversation list & unread counts when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id && activeOrganization?.id) {
        load();
      }
    }, [user?.id, activeOrganization?.id, load])
  );

  useEffect(() => {
    if (!user?.id) return;
    refreshIntervalRef.current = setInterval(refreshUnreadCounts, UNREAD_REFRESH_INTERVAL_MS);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [user?.id, refreshUnreadCounts]);

  // Realtime: update conversation list when new messages arrive
  useEffect(() => {
    if (!user?.id || !activeOrganization?.id) return;

    const channel = supabase
      .channel(`msg-list-${activeOrganization.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const convId = row?.conversation_id as string | undefined;
          const content = (row?.content as string) ?? '';
          const createdAt = (row?.created_at as string) ?? new Date().toISOString();
          const imagePath = row?.image_path as string | null | undefined;
          if (!convId) return;

          const preview = imagePath ? '📷 Bild' : content;

          setItems((prev) => {
            const updated = prev.map((item) => {
              if (item.type === 'direct' && item.conversation.id === convId) {
                return {
                  ...item,
                  conversation: {
                    ...item.conversation,
                    last_message: preview,
                    last_message_at: createdAt,
                  },
                };
              }
              return item;
            });
            return updated.sort(sortItemsWithPinned);
          });
          refreshUnreadCounts();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'organization_messages' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const convId = row?.organization_conversation_id as string | undefined;
          const content = (row?.content as string) ?? '';
          const createdAt = (row?.created_at as string) ?? new Date().toISOString();
          const imagePath = row?.image_path as string | null | undefined;
          if (!convId) return;

          const preview = imagePath ? '📷 Bild' : content;

          setItems((prev) => {
            const updated = prev.map((item) => {
              if (item.conversation.id === convId) {
                return {
                  ...item,
                  conversation: {
                    ...item.conversation,
                    last_message: preview,
                    last_message_at: createdAt,
                  },
                };
              }
              return item;
            });
            return updated.sort(sortItemsWithPinned);
          });
          refreshUnreadCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeOrganization?.id, refreshUnreadCounts]);

  // ── Split into orgChats vs listingChats ──
  const { orgChats, listingChats } = useMemo(() => {
    const org: ListItem[] = [];
    const listing: ListItem[] = [];

    for (const c of items) {
      if (c.type === 'direct' && !!(c.conversation as DirectConversation).listing_id) {
        listing.push(c);
      } else {
        org.push(c);
      }
    }

    return { orgChats: org, listingChats: listing };
  }, [items]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onPress = (item: ListItem) => {
    const type = item.type === 'direct' ? 'direct' : 'organization';
    router.push({ pathname: `/conversation/${item.conversation.id}`, params: { type } });
  };

  // ── Render a single conversation row ──
  const renderConversationRow = (item: ListItem) => {
    const isDirect = item.type === 'direct';
    const conv = item.conversation;
    const unread = getUnreadCount(isDirect ? 'direct' : 'organization', conv.id);
    const lastMessage = 'last_message' in conv ? conv.last_message : null;
    const lastAt = 'last_message_at' in conv ? conv.last_message_at : null;
    const orgConv = !isDirect && (conv as OrganizationConversation);
    const title = isDirect
      ? displayName((conv as Conversation & { other_user?: { first_name: string | null; last_name: string | null } }).other_user ?? null)
      : orgConv ? orgConv.name : '';
    const isPinnedOrgType = orgConv && (orgConv.type === 'all_members' || orgConv.type === 'board_admin');
    const subtitle = !isDirect && !isPinnedOrgType ? (orgConv && orgConv.type === 'group' ? 'Grupp' : orgConv ? orgConv.type || 'Konversation' : null) : null;

    const directConv = isDirect && (conv as Conversation & { other_user?: { profile_image_url?: string | null }, listing?: { title: string; image_url: string | null } | null });
    const profileImageUrl = isDirect ? directConv && directConv.other_user?.profile_image_url : null;
    const listing = isDirect ? directConv && directConv.listing : null;

    return (
      <TouchableOpacity
        key={`${item.type}-${conv.id}`}
        style={styles.row}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
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
              <Feather name="users" size={22} color="#6b7280" />
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

  // ── Collapsible section header ──
  const renderSectionHeader = (
    title: string,
    count: number,
    expanded: boolean,
    onToggle: () => void,
    unreadTotal: number,
  ) => (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.sectionHeaderLeft}>
        <Feather
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
          color="#6b7280"
        />
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      </View>
      {unreadTotal > 0 && (
        <View style={styles.sectionUnread}>
          <Text style={styles.sectionUnreadText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Count unread for a set of items ──
  const getUnreadTotal = (chatItems: ListItem[]) => {
    let total = 0;
    for (const item of chatItems) {
      const isDirect = item.type === 'direct';
      total += getUnreadCount(isDirect ? 'direct' : 'organization', item.conversation.id);
    }
    return total;
  };

  const headerRight = activeOrganization ? (
    <TouchableOpacity
      style={styles.headerRightBtn}
      onPress={() => setShowNewConversationModal(true)}
    >
      <Feather name="edit-3" size={22} color="#2563eb" />
    </TouchableOpacity>
  ) : null;

  // ── Loading state ──
  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Meddelanden</Text>
            {activeOrganization && (
              <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
            )}
          </View>
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

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Meddelanden</Text>
            {activeOrganization && (
              <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
            )}
          </View>
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

  // ── Build flat data for FlatList with section headers ──
  type SectionHeaderItem = {
    kind: 'section-header';
    key: string;
    title: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    unreadTotal: number;
  };
  type ConversationItem = { kind: 'conversation'; key: string; item: ListItem };
  type FlatItem = SectionHeaderItem | ConversationItem;

  const flatData: FlatItem[] = [];

  // Organisation section
  const orgName = activeOrganization?.name || 'Förening';
  const orgUnread = getUnreadTotal(orgChats);
  flatData.push({
    kind: 'section-header',
    key: 'section-org',
    title: orgName,
    count: orgChats.length,
    expanded: orgSectionExpanded,
    onToggle: () => setOrgSectionExpanded((prev) => !prev),
    unreadTotal: orgUnread,
  });
  if (orgSectionExpanded) {
    for (const item of orgChats) {
      flatData.push({ kind: 'conversation', key: `${item.type}-${item.conversation.id}`, item });
    }
  }

  // Köp & Sälj section (only if there are listing chats)
  if (listingChats.length > 0) {
    const listingUnread = getUnreadTotal(listingChats);
    flatData.push({
      kind: 'section-header',
      key: 'section-listing',
      title: 'Köp & Sälj',
      count: listingChats.length,
      expanded: listingSectionExpanded,
      onToggle: () => setListingSectionExpanded((prev) => !prev),
      unreadTotal: listingUnread,
    });
    if (listingSectionExpanded) {
      for (const item of listingChats) {
        flatData.push({ kind: 'conversation', key: `${item.type}-${item.conversation.id}`, item });
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Meddelanden</Text>
          {activeOrganization && (
            <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
          )}
        </View>
        {headerRight}
      </View>
      <FlatList<FlatItem>
        data={flatData}
        keyExtractor={(item) => item.key}
        renderItem={({ item: flatItem }) => {
          if (flatItem.kind === 'section-header') {
            return renderSectionHeader(
              flatItem.title,
              flatItem.count,
              flatItem.expanded,
              flatItem.onToggle,
              flatItem.unreadTotal,
            );
          }
          return renderConversationRow(flatItem.item);
        }}
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
  headerRightBtn: {
    padding: 8,
  },
  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    marginLeft: 8,
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  sectionUnread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionUnreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  // ── Conversation row ──
  listContent: {
    paddingBottom: 8,
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
    backgroundColor: '#22c55e',
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
    backgroundColor: '#ef4444',
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
