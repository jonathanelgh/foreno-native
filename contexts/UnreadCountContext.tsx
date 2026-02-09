import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { getConversationUnreadCounts } from '../lib/api/messages';
import { supabase } from '../lib/supabase';

type ConversationType = 'direct' | 'organization';

interface UnreadCountContextType {
  totalUnread: number;
  getUnreadCount: (type: ConversationType, conversationId: string) => number;
  refreshUnreadCounts: () => Promise<void>;
  setConversationRead: (type: ConversationType, conversationId: string) => void;
}

const UnreadCountContext = createContext<UnreadCountContextType | undefined>(undefined);

function key(type: ConversationType, conversationId: string): string {
  return `${type}-${conversationId}`;
}

export function UnreadCountProvider({ children }: { children: React.ReactNode }) {
  const { user, activeOrganization } = useAuth();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const totalUnread = useMemo(
    () => [...counts.values()].reduce((a, b) => a + b, 0),
    [counts]
  );

  const refreshUnreadCounts = useCallback(async () => {
    if (!user?.id) {
      setCounts(new Map());
      return;
    }
    try {
      const { counts: newCounts } = await getConversationUnreadCounts(
        user.id,
        activeOrganization?.id ?? undefined
      );
      setCounts(newCounts);
    } catch {
      setCounts(new Map());
    }
  }, [user?.id, activeOrganization?.id]);

  const setConversationRead = useCallback((type: ConversationType, conversationId: string) => {
    const k = key(type, conversationId);
    setCounts((prev) => {
      const n = prev.get(k) ?? 0;
      if (n === 0) return prev;
      const next = new Map(prev);
      next.set(k, 0);
      return next;
    });
  }, []);

  const getUnreadCount = useCallback(
    (type: ConversationType, conversationId: string): number => {
      return counts.get(key(type, conversationId)) ?? 0;
    },
    [counts]
  );

  useEffect(() => {
    if (user?.id) refreshUnreadCounts();
    else setCounts(new Map());
  }, [user?.id, refreshUnreadCounts]);

  // Real-time subscription for global unread counts
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('global-unread-counts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refreshUnreadCounts();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'organization_messages' },
        (payload) => {
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refreshUnreadCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshUnreadCounts]);

  // Listen for push notifications in foreground to trigger refresh
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      // When any notification is received in foreground, refresh counts
      refreshUnreadCounts();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshUnreadCounts]);

  // Refresh unread when app comes to foreground (doc: "on app resume")
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && user?.id) refreshUnreadCounts();
    });
    return () => sub.remove();
  }, [user?.id, refreshUnreadCounts]);

  const value: UnreadCountContextType = {
    totalUnread,
    getUnreadCount,
    refreshUnreadCounts,
    setConversationRead,
  };

  return (
    <UnreadCountContext.Provider value={value}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount(): UnreadCountContextType {
  const ctx = useContext(UnreadCountContext);
  if (ctx === undefined) {
    throw new Error('useUnreadCount must be used within UnreadCountProvider');
  }
  return ctx;
}

/** Safe version for tab bar etc.: returns zeros when provider is missing (avoids hook-order issues). */
export function useUnreadCountOptional(): UnreadCountContextType {
  const ctx = useContext(UnreadCountContext);
  if (ctx === undefined) {
    return {
      totalUnread: 0,
      getUnreadCount: () => 0,
      refreshUnreadCounts: async () => {},
      setConversationRead: () => {},
    };
  }
  return ctx;
}
