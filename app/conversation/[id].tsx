import { Avatar } from '../../components/Avatar';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GroupChatModal } from '../../components/GroupChatModal';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCount } from '../../contexts/UnreadCountContext';
import {
  getDirectConversationHeader,
  getMessages,
  getOrganizationConversationById,
  getOrganizationMessages,
  markConversationMessagesRead,
  sendMessage,
  sendOrganizationMessage,
} from '../../lib/api/messages';
import { supabase } from '../../lib/supabase';
import { getMessageImageUrl, uploadMessageImage } from '../../lib/storage';
import type { Message, OrganizationMessage } from '../../types/database';

type MessageWithUrl = (Message | OrganizationMessage) & { image_url?: string | null };

function formatMessageTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function displaySender(sender: { first_name: string | null; last_name: string | null } | null): string {
  if (!sender) return 'Okänd';
  const first = sender.first_name?.trim() || '';
  const last = sender.last_name?.trim() || '';
  return [first, last].filter(Boolean).join(' ') || 'Okänd';
}

export default function ConversationScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'direct' | 'organization' }>();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { setConversationRead } = useUnreadCount();
  const [messages, setMessages] = useState<MessageWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [headerTitle, setHeaderTitle] = useState<string>('');
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [listing, setListing] = useState<{ id: string; title: string; image_url: string | null } | null>(null);
  const [orgConversationCreatedBy, setOrgConversationCreatedBy] = useState<string | null>(null);
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const listRef = useRef<FlatList>(null);

  const isDirect = type === 'direct';

  // Always navigate back to the messages list, regardless of how user arrived
  const goToMessages = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/(tabs)/messages');
  };

  const loadHeader = useCallback(async () => {
    if (!id || !user?.id) return;
    try {
      if (isDirect) {
        const header = await getDirectConversationHeader(id, user.id);
        if (header) {
          setHeaderTitle(header.name);
          setHeaderImageUrl(header.profileImageUrl);
          setListing(header.listing || null);
        } else {
          setHeaderTitle('Meddelande');
        }
        setOrgConversationCreatedBy(null);
      } else {
        const header = await getOrganizationConversationById(id);
        if (header) {
          setHeaderTitle(header.name);
          setOrgConversationCreatedBy(header.created_by);
        } else {
          setHeaderTitle('Gruppkonversation');
          setOrgConversationCreatedBy(null);
        }
        setListing(null);
      }
    } catch {
      setHeaderTitle(isDirect ? 'Meddelande' : 'Gruppkonversation');
      setOrgConversationCreatedBy(null);
      setListing(null);
    }
  }, [id, isDirect, user?.id]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const list = isDirect
        ? await getMessages(id)
        : await getOrganizationMessages(id);
      const withUrls = await Promise.all(
        (list as MessageWithUrl[]).map(async (m) => {
          if (m.image_bucket && m.image_path) {
            try {
              const url = await getMessageImageUrl(m.image_bucket, m.image_path);
              return { ...m, image_url: url };
            } catch {
              return { ...m, image_url: null };
            }
          }
          return { ...m, image_url: null };
        })
      );
      setMessages(withUrls);
      if (id) {
        markConversationMessagesRead(id, isDirect ? 'direct' : 'org');
        setConversationRead(isDirect ? 'direct' : 'organization', id);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte ladda meddelanden');
    } finally {
      setLoading(false);
    }
  }, [id, isDirect, user?.id, setConversationRead]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadHeader();
  }, [loadHeader]);

  // Realtime: when a new message arrives in this open conversation, append it and mark as read
  useEffect(() => {
    if (!id) return;
    const table = isDirect ? 'messages' : 'organization_messages';
    const filterCol = isDirect ? 'conversation_id' : 'organization_conversation_id';
    
    // Use a unique channel name to avoid "subscribe called multiple times" error
    // if the component remounts quickly or multiple instances exist.
    const channelName = `conv-${id}-${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `${filterCol}=eq.${id}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          const msgId = row?.id as string | undefined;
          const senderId = row?.sender_id as string | undefined;
          const content = (row?.content as string) ?? '';
          const createdAt = (row?.created_at as string) ?? new Date().toISOString();
          const imageBucket = row?.image_bucket as string | null | undefined;
          const imagePath = row?.image_path as string | null | undefined;
          if (!msgId) return;
          
          let imageUrl: string | null = null;
          if (imageBucket && imagePath) {
            try {
              imageUrl = await getMessageImageUrl(imageBucket, imagePath);
            } catch {
              // keep null
            }
          }
          const newMsg: MessageWithUrl = {
            id: msgId,
            sender_id: senderId ?? '',
            content,
            created_at: createdAt,
            image_bucket: imageBucket ?? null,
            image_path: imagePath ?? null,
            image_file_name: (row?.image_file_name as string) ?? null,
            ...(isDirect ? { conversation_id: id } : { organization_conversation_id: id }),
            sender: null,
            image_url: imageUrl,
          } as MessageWithUrl;

          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
          markConversationMessagesRead(id, isDirect ? 'direct' : 'org');
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isDirect]);

  const send = async () => {
    const text = input.trim();
    if (!text || !user?.id) return;
    setInput('');
    setSending(true);
    try {
      if (isDirect) {
        const msg = await sendMessage(id!, user.id, text);
        const withUrl: MessageWithUrl = { ...msg, sender: null, image_url: null };
        if (msg.image_bucket && msg.image_path) {
          try {
            withUrl.image_url = await getMessageImageUrl(msg.image_bucket, msg.image_path);
          } catch {}
        }
        setMessages((prev) => {
          if (prev.some(m => m.id === withUrl.id)) return prev;
          return [...prev, withUrl];
        });
      } else {
        const profileId = userProfile?.id ?? user.id;
        const msg = await sendOrganizationMessage(id!, profileId, text);
        const withUrl: MessageWithUrl = { ...msg, sender: { first_name: userProfile?.first_name ?? null, last_name: userProfile?.last_name ?? null }, image_url: null };
        if (msg.image_bucket && msg.image_path) {
          try {
            withUrl.image_url = await getMessageImageUrl(msg.image_bucket, msg.image_path);
          } catch {}
        }
        setMessages((prev) => {
          if (prev.some(m => m.id === withUrl.id)) return prev;
          return [...prev, withUrl];
        });
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte skicka meddelande');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const pickImageAndSend = async () => {
    if (!user?.id) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Behörighet krävs', 'Tillåt åtkomst till bilder för att ladda upp.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const fileName = asset.fileName ?? `image_${Date.now()}.jpg`;
      setSending(true);
      const conversationType = isDirect ? 'direct' : 'organization';
      const { bucket, path, fileName: savedName } = await uploadMessageImage(asset.uri, fileName, conversationType);
      const caption = input.trim();
      if (isDirect) {
        const msg = await sendMessage(id!, user.id, caption, { bucket, path, fileName: savedName });
        const withUrl: MessageWithUrl = { ...msg, sender: null, image_url: null };
        try {
          withUrl.image_url = await getMessageImageUrl(msg.image_bucket!, msg.image_path!);
        } catch {}
        setMessages((prev) => {
          if (prev.some(m => m.id === withUrl.id)) return prev;
          return [...prev, withUrl];
        });
      } else {
        const profileId = userProfile?.id ?? user.id;
        const msg = await sendOrganizationMessage(id!, profileId, caption, { bucket, path, fileName: savedName });
        const withUrl: MessageWithUrl = { ...msg, sender: { first_name: userProfile?.first_name ?? null, last_name: userProfile?.last_name ?? null }, image_url: null };
        try {
          withUrl.image_url = await getMessageImageUrl(msg.image_bucket!, msg.image_path!);
        } catch {}
        setMessages((prev) => {
          if (prev.some(m => m.id === withUrl.id)) return prev;
          return [...prev, withUrl];
        });
      }
      setInput('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte ladda upp bild');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: MessageWithUrl }) => {
    const isMine = isDirect
      ? (item as Message).sender_id === user?.id
      : (item as OrganizationMessage).sender_id === (userProfile?.id ?? user?.id);
    const senderName = isMine ? 'Du' : displaySender((item as Message & { sender?: { first_name: string | null; last_name: string | null } }).sender ?? null);
    const hasImage = !!(item.image_url ?? (item.image_path && item.image_bucket));

    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {hasImage && item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.bubbleImage} resizeMode="cover" />
          ) : null}
          {item.content ? (
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
              {item.content}
            </Text>
          ) : null}
          <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeOther]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
        {!isDirect && (
          <Text style={[styles.messageSender, isMine && styles.messageSenderMine]} numberOfLines={1}>
            {senderName}
          </Text>
        )}
        {isDirect && !isMine && (
          <Text style={styles.messageSender} numberOfLines={1}>{senderName}</Text>
        )}
      </View>
    );
  };

  if (!id || !type) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goToMessages} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Konversation</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToMessages} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color="#1f2937" />
        </TouchableOpacity>
        {isDirect ? (
          <Avatar 
            url={listing?.image_url || headerImageUrl} 
            size={36} 
            style={styles.headerAvatar} 
            containerStyle={{ marginRight: 10 }}
            name={headerTitle}
          />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Feather name="users" size={20} color="#6b7280" />
          </View>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle || (isDirect ? 'Meddelande' : 'Gruppkonversation')}
          </Text>
          {listing && (
            <View style={styles.listingContainer}>
              <View style={styles.listingTag}>
                <Text style={styles.listingTagText}>ANNONS</Text>
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
            </View>
          )}
        </View>
        {!isDirect && (
          <TouchableOpacity
            onPress={() => setShowGroupChatModal(true)}
            style={styles.headerMenuBtn}
            hitSlop={8}
          >
            <Feather name="more-vertical" size={22} color="#1f2937" />
          </TouchableOpacity>
        )}
      </View>

      {!isDirect && id && user?.id && (
        <GroupChatModal
          visible={showGroupChatModal}
          onClose={() => setShowGroupChatModal(false)}
          conversationId={id}
          currentUserId={user.id}
          createdBy={orgConversationCreatedBy}
          chatName={headerTitle}
          onChatNameUpdated={setHeaderTitle}
          onLeave={goToMessages}
        />
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.attachBtn, sending && styles.attachBtnDisabled]}
              onPress={pickImageAndSend}
              disabled={sending}
            >
              <Feather name="image" size={22} color={sending ? '#9ca3af' : PRIMARY_BLUE} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Skriv meddelande..."
              placeholderTextColor="#9ca3af"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={send}
              disabled={!input.trim() || sending}
            >
              <Feather name="send" size={20} color={input.trim() && !sending ? '#ffffff' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#2563eb';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  listingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  listingTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  listingTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  listingTitle: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '500',
    flex: 1,
  },
  headerMenuBtn: {
    padding: 8,
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  messageRow: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageSender: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    marginLeft: 4,
  },
  messageSenderMine: {
    marginLeft: 0,
    marginRight: 4,
    alignSelf: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
  },
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
  },
  bubbleMine: {
    backgroundColor: PRIMARY_BLUE,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bubbleText: {
    fontSize: 15,
  },
  bubbleTextMine: {
    color: '#ffffff',
  },
  bubbleTextOther: {
    color: '#1f2937',
  },
  bubbleTime: {
    fontSize: 11,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.8)',
  },
  bubbleTimeOther: {
    color: '#9ca3af',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  attachBtnDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 15,
    color: '#1f2937',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
