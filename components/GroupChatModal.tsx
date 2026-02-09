import { Avatar } from './Avatar';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getOrganizationConversationMembers,
  leaveOrganizationConversation,
  removeMemberFromOrganizationConversation,
  updateOrganizationConversationName,
  type OrganizationConversationMember,
} from '../lib/api/messages';

function displayName(m: { first_name: string | null; last_name: string | null }): string {
  const first = (m.first_name ?? '').trim();
  const last = (m.last_name ?? '').trim();
  return [first, last].filter(Boolean).join(' ') || 'Okänd';
}

export interface GroupChatModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string;
  createdBy: string | null;
  chatName: string;
  onChatNameUpdated: (name: string) => void;
  onLeave: () => void;
}

export function GroupChatModal({
  visible,
  onClose,
  conversationId,
  currentUserId,
  createdBy,
  chatName,
  onChatNameUpdated,
  onLeave,
}: GroupChatModalProps) {
  const [members, setMembers] = useState<OrganizationConversationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(chatName);

  const isCreator = createdBy === currentUserId;

  const loadMembers = useCallback(async () => {
    if (!conversationId || !visible) return;
    setLoading(true);
    try {
      const list = await getOrganizationConversationMembers(conversationId);
      setMembers(list);
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte ladda medlemmar');
    } finally {
      setLoading(false);
    }
  }, [conversationId, visible]);

  useEffect(() => {
    if (visible) {
      loadMembers();
      setDraftName(chatName);
      setEditingName(false);
    }
  }, [visible, conversationId, chatName, loadMembers]);

  const handleLeave = () => {
    Alert.alert(
      'Lämna chatt',
      'Vill du verkligen lämna denna gruppchatt?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Lämna',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await leaveOrganizationConversation(currentUserId, conversationId);
              onClose();
              onLeave();
            } catch (e) {
              console.error(e);
              Alert.alert('Fel', 'Kunde inte lämna chatten');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (member: OrganizationConversationMember) => {
    Alert.alert(
      'Ta bort medlem',
      `Ta bort ${displayName(member)} från chatten?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await removeMemberFromOrganizationConversation(conversationId, member.id);
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
            } catch (e) {
              console.error(e);
              Alert.alert('Fel', 'Kunde inte ta bort medlemmen');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === chatName) {
      setEditingName(false);
      setDraftName(chatName);
      return;
    }
    setActionLoading(true);
    try {
      await updateOrganizationConversationName(conversationId, trimmed);
      onChatNameUpdated(trimmed);
      setEditingName(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte uppdatera chattenamn');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gruppinfo</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Feather name="x" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Chattnamn</Text>
          {editingName && isCreator ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Namn på chatten"
                placeholderTextColor="#9ca3af"
                autoFocus
                editable={!actionLoading}
              />
              <TouchableOpacity
                style={[styles.saveNameBtn, actionLoading && styles.btnDisabled]}
                onPress={handleSaveName}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Feather name="check" size={20} color="#2563eb" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelEditBtn}
                onPress={() => {
                  setEditingName(false);
                  setDraftName(chatName);
                }}
                disabled={actionLoading}
              >
                <Feather name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={styles.chatName} numberOfLines={1}>
                {chatName}
              </Text>
              {isCreator && (
                <TouchableOpacity
                  onPress={() => setEditingName(true)}
                  style={styles.editNameBtn}
                  disabled={actionLoading}
                >
                  <Feather name="edit-2" size={18} color="#2563eb" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Medlemmar ({members.length})</Text>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              scrollEnabled={members.length > 8}
              style={styles.memberList}
              renderItem={({ item }) => {
                const isSelf = item.id === currentUserId;
                return (
                  <View style={styles.memberRow}>
                    <Avatar 
                      url={item.profile_image_url} 
                      size={40} 
                      style={styles.avatar} 
                      containerStyle={{ marginRight: 12 }}
                      name={displayName(item)}
                    />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {displayName(item)}
                      {isSelf ? ' (du)' : ''}
                    </Text>
                    {!isSelf && isCreator && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveMember(item)}
                        disabled={actionLoading}
                        hitSlop={8}
                      >
                        <Feather name="user-minus" size={18} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.leaveBtn, actionLoading && styles.leaveBtnDisabled]}
            onPress={handleLeave}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <>
                <Feather name="log-out" size={18} color="#dc2626" />
                <Text style={styles.leaveBtnText}>Lämna chatt</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeBtn: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  editNameBtn: {
    padding: 6,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  saveNameBtn: {
    padding: 10,
  },
  cancelEditBtn: {
    padding: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  memberList: {
    maxHeight: 280,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  removeBtn: {
    padding: 6,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 'auto',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  leaveBtnDisabled: {
    opacity: 0.6,
  },
  leaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});
