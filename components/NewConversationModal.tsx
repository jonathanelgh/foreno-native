import { Avatar } from './Avatar';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  createOrganizationConversation,
  getOrganizationMembersForNewConversation,
  getOrCreateConversation,
  type OrgMemberForPicker,
} from '../lib/api/messages';

interface NewConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onStartConversation: (conversationId: string, type: 'direct' | 'organization') => void;
}

type Step = 'direct' | 'group';

function displayName(m: OrgMemberForPicker): string {
  const first = m.first_name?.trim() || '';
  const last = m.last_name?.trim() || '';
  return [first, last].filter(Boolean).join(' ') || 'Okänd';
}

function matchesSearch(m: OrgMemberForPicker, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const name = displayName(m).toLowerCase();
  const first = (m.first_name ?? '').toLowerCase();
  const last = (m.last_name ?? '').toLowerCase();
  return name.includes(q) || first.includes(q) || last.includes(q);
}

export function NewConversationModal({
  visible,
  onClose,
  onStartConversation,
}: NewConversationModalProps) {
  const { user, userProfile, activeOrganization } = useAuth();
  const [step, setStep] = useState<Step>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<OrgMemberForPicker[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const loadMembers = useCallback(async () => {
    if (!activeOrganization?.id) return;
    setLoadingMembers(true);
    try {
      const list = await getOrganizationMembersForNewConversation(activeOrganization.id);
      setMembers(list);
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte ladda medlemmar');
    } finally {
      setLoadingMembers(false);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    if (visible) {
      loadMembers();
    }
  }, [visible, loadMembers]);

  const handleClose = useCallback(() => {
    setStep('direct');
    setSearchQuery('');
    setGroupName('');
    setSelectedMemberIds(new Set());
    onClose();
  }, [onClose]);

  const handleBack = () => {
    if (step === 'group') {
      setStep('direct');
      setGroupName('');
      setSelectedMemberIds(new Set());
    } else {
      handleClose();
    }
  };

  const directMembers = useMemo(
    () => members.filter((m) => m.id !== user?.id),
    [members, user?.id]
  );
  const filteredDirectMembers = useMemo(
    () => directMembers.filter((m) => matchesSearch(m, searchQuery)),
    [directMembers, searchQuery]
  );
  const filteredMembersForGroup = useMemo(
    () =>
      members
        .filter((m) => m.id !== user?.id)
        .filter((m) => matchesSearch(m, searchQuery)),
    [members, searchQuery, user?.id]
  );

  const handleStartDirect = async (otherUserId: string) => {
    if (!user?.id) return;
    setLoadingAction(true);
    try {
      const conv = await getOrCreateConversation(user.id, otherUserId);
      handleClose();
      onStartConversation(conv.id, 'direct');
      router.push({ pathname: `/conversation/${conv.id}`, params: { type: 'direct' } });
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte starta konversation');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!activeOrganization?.id || !user?.id) return;
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Fel', 'Ange ett gruppnamn');
      return;
    }
    const memberIds = [...selectedMemberIds];
    if (!memberIds.includes(user.id)) memberIds.push(user.id);
    if (memberIds.length === 0) {
      Alert.alert('Fel', 'Välj minst en medlem');
      return;
    }
    setLoadingAction(true);
    try {
      const conv = await createOrganizationConversation(
        activeOrganization.id,
        name,
        memberIds
      );
      handleClose();
      onStartConversation(conv.id, 'organization');
      router.push({ pathname: `/conversation/${conv.id}`, params: { type: 'organization' } });
    } catch (e) {
      console.error(e);
      Alert.alert('Fel', 'Kunde inte skapa gruppchatt');
    } finally {
      setLoadingAction(false);
    }
  };

  const toggleMember = (id: string) => {
    if (id === user?.id) return;
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSelectedMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedMembersForChips = useMemo(
    () => members.filter((m) => selectedMemberIds.has(m.id)),
    [members, selectedMemberIds]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Feather name={step === 'direct' ? 'x' : 'arrow-left'} size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'direct' ? 'Ny konversation' : 'Ny gruppchatt'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Sök medlemmar..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Feather name="x-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {step === 'direct' && (
          <TouchableOpacity
            style={styles.gruppchattBtn}
            onPress={() => setStep('group')}
            activeOpacity={0.7}
          >
            <Feather name="users" size={20} color="#2563eb" style={styles.gruppchattBtnIcon} />
            <Text style={styles.gruppchattBtnText}>Gruppchatt</Text>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {step === 'direct' && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {loadingMembers ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : (
              <FlatList
                data={filteredDirectMembers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptySearchText}>
                    {searchQuery.trim() ? 'Inga medlemmar matchar sökningen' : 'Inga medlemmar'}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => handleStartDirect(item.id)}
                    disabled={loadingAction}
                    activeOpacity={0.7}
                  >
                    <Avatar 
                      url={item.profile_image_url} 
                      size={44} 
                      style={styles.memberAvatar} 
                      containerStyle={{ marginRight: 14 }}
                      name={displayName(item)}
                    />
                    <Text style={styles.memberName}>{displayName(item)}</Text>
                    {loadingAction ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Feather name="chevron-right" size={18} color="#9ca3af" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </KeyboardAvoidingView>
        )}

        {step === 'group' && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {selectedMembersForChips.length > 0 && (
              <View style={styles.chipsWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {selectedMembersForChips.map((m) => (
                    <View key={m.id} style={styles.chip}>
                      <Avatar 
                        url={m.profile_image_url} 
                        size={24} 
                        style={styles.chipAvatar} 
                        containerStyle={{ marginRight: 6 }}
                        name={displayName(m)}
                      />
                      <Text style={styles.chipName} numberOfLines={1}>
                        {displayName(m)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeSelectedMember(m.id)}
                        style={styles.chipRemove}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="x" size={14} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.groupNameWrap}>
              <Text style={styles.label}>Gruppnamn</Text>
              <TextInput
                style={styles.input}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="T.ex. Projektgrupp"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <Text style={styles.label}>Välj medlemmar</Text>
            {loadingMembers ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : (
              <ScrollView
                style={styles.groupList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {filteredMembersForGroup.map((m) => {
                  const isSelected = selectedMemberIds.has(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.memberRow}
                      onPress={() => toggleMember(m.id)}
                      activeOpacity={0.7}
                    >
                      <Avatar 
                        url={m.profile_image_url} 
                        size={44} 
                        style={styles.memberAvatar} 
                        containerStyle={{ marginRight: 14 }}
                        name={displayName(m)}
                      />
                      <Text style={styles.memberName}>{displayName(m)}</Text>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Feather name="check" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.groupFooter}>
              <TouchableOpacity
                style={[styles.createGroupBtn, loadingAction && styles.createGroupBtnDisabled]}
                onPress={handleCreateGroup}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createGroupBtnText}>Skapa gruppchatt</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  searchClear: {
    padding: 4,
  },
  gruppchattBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
  },
  gruppchattBtnIcon: {
    marginRight: 10,
  },
  gruppchattBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  chipsWrap: {
    marginBottom: 8,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 160,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  chipAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  chipName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e40af',
    flex: 1,
  },
  chipRemove: {
    padding: 2,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptySearchText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  memberNameMuted: {
    color: '#9ca3af',
  },
  memberBadge: {
    fontSize: 12,
    color: '#6b7280',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  groupNameWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  groupList: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  groupFooter: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  createGroupBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupBtnDisabled: {
    opacity: 0.7,
  },
  createGroupBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
