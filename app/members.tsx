import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import {
  CategoryAssignment,
  MemberCategory,
  OrganizationMember,
  createCategory,
  deleteCategory,
  deleteInvitation,
  getActiveMembers,
  getCategoryAssignments,
  getMemberCategories,
  getOrganizationMembers,
  inviteMember,
  removeMember,
  updateCategory,
  updateCategoryAssignments,
  updateMemberRole,
} from '../lib/api/members';

// ── Constants ──

type RoleKey = 'admin' | 'styrelse' | 'medlem';
type StatusKey = 'active' | 'invited' | 'removed';

const ROLE_CONFIG: Record<RoleKey, { label: string; icon: string; color: string }> = {
  admin: { label: 'Administratör', icon: 'award', color: '#ca8a04' },
  styrelse: { label: 'Styrelse', icon: 'shield', color: '#2563eb' },
  medlem: { label: 'Medlem', icon: 'user-check', color: '#059669' },
};

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string; text: string }> = {
  active: { label: 'Aktiv', bg: '#dcfce7', text: '#166534' },
  invited: { label: 'Inbjuden', bg: '#fef9c3', text: '#854d0e' },
  removed: { label: 'Borttagen', bg: '#fee2e2', text: '#991b1b' },
};

const BOARD_TITLES = [
  'Ordförande',
  'Vice ordförande',
  'Sekreterare',
  'Kassör',
  'Ledamot',
  'Suppleant',
  'Revisor',
  'Revisorsuppleant',
];

const ADMIN_BOARD_TITLES = [...BOARD_TITLES, 'VD', 'Verksamhetschef', 'Föreningsadministratör'];

// ── Helpers ──

function getMemberName(member: OrganizationMember): string {
  if (member.profile) {
    const parts = [member.profile.first_name, member.profile.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  if (member.status === 'invited') return 'Inbjuden användare';
  return 'Namn ej angivet';
}

function getMemberEmail(member: OrganizationMember): string {
  return member.profile?.email || member.invited_email || '';
}

function getMemberPhone(member: OrganizationMember): string | null {
  return member.profile?.phone_number || null;
}

// ════════════════════════════════════════════
//  FILTER DROPDOWN
// ════════════════════════════════════════════

function FilterDropdown({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  icon: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label || '';
  const isActive = value !== 'all';

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <TouchableOpacity
        style={[styles.dropdown, isActive && styles.dropdownActive]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Feather
          name={icon as any}
          size={14}
          color={isActive ? Colors.light.tint : '#6b7280'}
        />
        <Text
          style={[styles.dropdownText, isActive && styles.dropdownTextActive]}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={isActive ? Colors.light.tint : '#9ca3af'}
        />
      </TouchableOpacity>

      {open && (
        <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          >
            <View style={styles.dropdownMenu}>
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.dropdownMenuItem, selected && styles.dropdownMenuItemActive]}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownMenuItemText,
                        selected && styles.dropdownMenuItemTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {selected && <Feather name="check" size={16} color={Colors.light.tint} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ════════════════════════════════════════════
//  ACTION MENU (bottom sheet style)
// ════════════════════════════════════════════

type ActionMenuOption = {
  label: string;
  icon: string;
  color?: string;
  onPress: () => void;
};

function ActionMenu({
  visible,
  onClose,
  title,
  options,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: ActionMenuOption[];
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={actionMenuStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={actionMenuStyles.sheet}>
          {title ? (
            <View style={actionMenuStyles.sheetHeader}>
              <Text style={actionMenuStyles.sheetTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ) : null}
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[
                actionMenuStyles.sheetOption,
                i === options.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
              activeOpacity={0.6}
            >
              <Feather name={opt.icon as any} size={18} color={opt.color || '#374151'} />
              <Text style={[actionMenuStyles.sheetOptionText, opt.color ? { color: opt.color } : null]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={actionMenuStyles.cancelRow} onPress={onClose}>
            <Text style={actionMenuStyles.cancelText}>Avbryt</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const actionMenuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  cancelRow: {
    marginTop: 6,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});

// ════════════════════════════════════════════
//  MAIN SCREEN
// ════════════════════════════════════════════

export default function MembersScreen() {
  const router = useRouter();
  const { user, activeOrganization, isAdmin, isStyrelse } = useAuth();
  const canManage = isAdmin || isStyrelse;

  // ── State ──
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [categories, setCategories] = useState<MemberCategory[]>([]);
  const [assignments, setAssignments] = useState<CategoryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters (admin/styrelse only)
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Tabs (admin only)
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
  const [actionMember, setActionMember] = useState<OrganizationMember | null>(null);
  const [actionGroup, setActionGroup] = useState<MemberCategory | null>(null);

  // Groups
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MemberCategory | null>(null);
  const [groupSearch, setGroupSearch] = useState('');

  // ── Data loading ──

  const loadData = useCallback(async () => {
    if (!activeOrganization) return;
    try {
      const [memberData, catData, assignData] = await Promise.all([
        canManage
          ? getOrganizationMembers(activeOrganization.id)
          : getActiveMembers(activeOrganization.id),
        canManage ? getMemberCategories(activeOrganization.id) : Promise.resolve([]),
        canManage ? getCategoryAssignments(activeOrganization.id) : Promise.resolve([]),
      ]);
      setMembers(memberData);
      setCategories(catData);
      setAssignments(assignData);
    } catch (e) {
      console.error('Error loading members:', e);
    }
  }, [activeOrganization, canManage]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Filtering ──

  const filteredMembers = useMemo(() => {
    let result = members;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => {
        const name = getMemberName(m).toLowerCase();
        const email = getMemberEmail(m).toLowerCase();
        const phone = getMemberPhone(m)?.toLowerCase() || '';
        return name.includes(q) || email.includes(q) || phone.includes(q);
      });
    }

    if (roleFilter !== 'all') {
      result = result.filter((m) => m.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }

    if (groupFilter !== 'all') {
      const memberIdsInGroup = assignments
        .filter((a) => a.category_id === groupFilter)
        .map((a) => a.membership_id);
      result = result.filter((m) => memberIdsInGroup.includes(m.id));
    }

    return result;
  }, [members, searchQuery, roleFilter, statusFilter, groupFilter, assignments]);

  // ── Member category badges for a member ──

  const getCategoriesForMember = useCallback(
    (membershipId: string) => {
      const catIds = assignments
        .filter((a) => a.membership_id === membershipId)
        .map((a) => a.category_id);
      return categories.filter((c) => catIds.includes(c.id));
    },
    [assignments, categories]
  );

  // ── Handlers ──

  const handleRemoveMember = (member: OrganizationMember) => {
    const isInvited = member.status === 'invited';
    const title = isInvited ? 'Ta bort inbjudan' : 'Ta bort medlem';
    const message = isInvited
      ? `Vill du ta bort inbjudan till ${getMemberEmail(member)}?`
      : `Vill du avsluta medlemskapet för ${getMemberName(member)}?`;

    Alert.alert(title, message, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: isInvited ? 'Ta bort' : 'Avsluta',
        style: 'destructive',
        onPress: async () => {
          const success = isInvited
            ? await deleteInvitation(member.id)
            : await removeMember(member.id);
          if (success) {
            loadData();
          } else {
            Alert.alert('Fel', 'Kunde inte utföra åtgärden.');
          }
        },
      },
    ]);
  };

  const handleEditPress = (member: OrganizationMember) => {
    setEditingMember(member);
    setShowEditModal(true);
  };

  // ── Groups tab data ──

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return categories;
    const q = groupSearch.toLowerCase();
    return categories.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [categories, groupSearch]);

  const getGroupMemberCount = useCallback(
    (categoryId: string) => {
      return assignments.filter((a) => a.category_id === categoryId).length;
    },
    [assignments]
  );

  const handleDeleteGroup = (group: MemberCategory) => {
    Alert.alert(
      'Ta bort grupp',
      `Är du säker på att du vill ta bort gruppen "${group.name}"? Medlemmar kommer att tas bort från gruppen.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteCategory(group.id);
            if (success) loadData();
            else Alert.alert('Fel', 'Kunde inte ta bort gruppen.');
          },
        },
      ]
    );
  };

  // ════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════

  const renderRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role as RoleKey] || ROLE_CONFIG.medlem;
    return (
      <View style={[styles.roleBadge, { backgroundColor: config.color + '15' }]}>
        <Feather name={config.icon as any} size={12} color={config.color} />
        <Text style={[styles.roleBadgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as StatusKey] || STATUS_CONFIG.active;
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusBadgeText, { color: config.text }]}>{config.label}</Text>
      </View>
    );
  };

  // ── Member row ──

  const renderMemberItem = ({ item: member }: { item: OrganizationMember }) => {
    const name = getMemberName(member);
    const email = getMemberEmail(member);
    const phone = getMemberPhone(member);
    const memberCats = getCategoriesForMember(member.id);

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberCardHeader}>
          <Avatar
            url={member.profile?.profile_image_url}
            size={44}
            name={name}
            placeholderColor="#eff6ff"
          />
          <View style={styles.memberCardInfo}>
            <Text style={styles.memberName} numberOfLines={1}>
              {name}
            </Text>
            {email ? (
              <Text style={styles.memberEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>

          {/* Action button (admin/styrelse) */}
          {canManage && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setActionMember(member)}
            >
              <Feather name="more-vertical" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Details row */}
        <View style={styles.memberDetails}>
          {phone ? (
            <TouchableOpacity
              style={styles.detailItem}
              onPress={() => Linking.openURL(`tel:${phone}`)}
              activeOpacity={0.6}
            >
              <Feather name="phone" size={13} color={Colors.light.tint} />
              <Text style={[styles.detailItemText, { color: Colors.light.tint }]}>{phone}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.detailItem}>
              <Feather name="phone" size={13} color="#d1d5db" />
              <Text style={[styles.detailItemText, { color: '#d1d5db' }]}>Ej angivet</Text>
            </View>
          )}

          {canManage && (
            <>
              {renderRoleBadge(member.role)}
              {renderStatusBadge(member.status)}
            </>
          )}
        </View>

        {/* Board title & group badges */}
        {canManage && (member.board_title || memberCats.length > 0) && (
          <View style={styles.badgeRow}>
            {member.board_title ? (
              <View style={styles.boardTitleBadge}>
                <Text style={styles.boardTitleText}>{member.board_title}</Text>
              </View>
            ) : null}
            {memberCats.map((cat) => (
              <View
                key={cat.id}
                style={[styles.categoryBadge, { backgroundColor: cat.color + '20', borderColor: cat.color + '40' }]}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={[styles.categoryBadgeText, { color: cat.color }]}>{cat.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Joined date for admin */}
        {canManage && member.joined_at && (
          <Text style={styles.joinedDate}>
            Gick med{' '}
            {new Date(member.joined_at).toLocaleDateString('sv-SE', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        )}
      </View>
    );
  };

  // ── Group row ──

  const renderGroupItem = ({ item: group }: { item: MemberCategory }) => {
    const memberCount = getGroupMemberCount(group.id);
    return (
      <View style={styles.memberCard}>
        <View style={styles.memberCardHeader}>
          <View style={[styles.groupColorDot, { backgroundColor: group.color }]} />
          <View style={styles.memberCardInfo}>
            <Text style={styles.memberName}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.memberEmail} numberOfLines={1}>
                {group.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.groupMemberCount}>
            <Feather name="users" size={13} color="#6b7280" />
            <Text style={styles.groupMemberCountText}>{memberCount}</Text>
          </View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActionGroup(group)}
          >
            <Feather name="more-vertical" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // (filter pills removed — using dropdowns instead)

  // ════════════════════════════════════════════
  //  MAIN RETURN
  // ════════════════════════════════════════════

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Medlemmar',
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                marginLeft: -8,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Feather name="chevron-left" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
          headerRight: () =>
            canManage ? (
              <TouchableOpacity
                onPress={() => {
                  if (activeTab === 'groups') {
                    setEditingGroup(null);
                    setShowGroupModal(true);
                  } else {
                    setShowInviteModal(true);
                  }
                }}
                style={{ padding: 8 }}
              >
                <Feather name="plus" size={24} color={Colors.light.tint} />
              </TouchableOpacity>
            ) : null,
        }}
      />

      {/* Tabs (admin only) */}
      {isAdmin && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.tabActive]}
            onPress={() => setActiveTab('members')}
          >
            <Feather
              name="users"
              size={16}
              color={activeTab === 'members' ? Colors.light.tint : '#6b7280'}
            />
            <Text
              style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}
            >
              Medlemmar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Feather
              name="tag"
              size={16}
              color={activeTab === 'groups' ? Colors.light.tint : '#6b7280'}
            />
            <Text
              style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}
            >
              Grupper
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <>
          {/* Search + Filters */}
          <View style={styles.filtersContainer}>
            {/* Search (visible to all) */}
            <View style={styles.searchRow}>
              <Feather name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Sök medlemmar..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropdowns (admin/styrelse only) */}
            {canManage && (
              <>
              <View style={styles.dropdownRow}>
                <FilterDropdown
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={[
                    { value: 'all', label: 'Alla roller' },
                    { value: 'admin', label: 'Administratörer' },
                    { value: 'styrelse', label: 'Styrelse' },
                    { value: 'medlem', label: 'Medlemmar' },
                  ]}
                  icon="users"
                />
                <FilterDropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Alla statusar' },
                    { value: 'active', label: 'Aktiva' },
                    { value: 'invited', label: 'Inbjudna' },
                    { value: 'removed', label: 'Borttagna' },
                  ]}
                  icon="filter"
                />
              </View>

              {/* Group filter dropdown (if groups exist) */}
              {categories.length > 0 && (
                <View style={styles.dropdownRow}>
                  <FilterDropdown
                    value={groupFilter}
                    onChange={setGroupFilter}
                    options={[
                      { value: 'all', label: 'Alla grupper' },
                      ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
                    ]}
                    icon="tag"
                  />
                </View>
              )}
              </>
            )}
          </View>

          {/* Member list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
            </View>
          ) : (
            <FlatList
              data={filteredMembers}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="users" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>
                    {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                      ? 'Inga medlemmar matchade filtren'
                      : 'Inga medlemmar ännu'}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* GROUPS TAB (admin only) */}
      {activeTab === 'groups' && isAdmin && (
        <>
          <View style={styles.filtersContainer}>
            <View style={styles.searchRow}>
              <Feather name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Sök grupper..."
                placeholderTextColor="#9ca3af"
                value={groupSearch}
                onChangeText={setGroupSearch}
              />
              {groupSearch.length > 0 && (
                <TouchableOpacity onPress={() => setGroupSearch('')}>
                  <Feather name="x" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredGroups}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="tag" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>
                  {groupSearch
                    ? `Inga grupper hittades för "${groupSearch}"`
                    : 'Inga grupper skapade än'}
                </Text>
                {!groupSearch && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingGroup(null);
                      setShowGroupModal(true);
                    }}
                  >
                    <Text style={styles.emptyLink}>Skapa första gruppen</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </>
      )}

      {/* ── INVITE MODAL ── */}
      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        organizationId={activeOrganization?.id || ''}
        onSuccess={() => {
          setShowInviteModal(false);
          loadData();
        }}
      />

      {/* ── EDIT MEMBER MODAL ── */}
      <EditMemberModal
        visible={showEditModal}
        member={editingMember}
        categories={categories}
        assignments={assignments}
        onClose={() => {
          setShowEditModal(false);
          setEditingMember(null);
        }}
        onSuccess={() => {
          setShowEditModal(false);
          setEditingMember(null);
          loadData();
        }}
        isAdmin={isAdmin}
      />

      {/* ── GROUP MODAL ── */}
      <GroupModal
        visible={showGroupModal}
        group={editingGroup}
        organizationId={activeOrganization?.id || ''}
        onClose={() => {
          setShowGroupModal(false);
          setEditingGroup(null);
        }}
        onSuccess={() => {
          setShowGroupModal(false);
          setEditingGroup(null);
          loadData();
        }}
      />

      {/* ── MEMBER ACTION MENU ── */}
      <ActionMenu
        visible={!!actionMember}
        onClose={() => setActionMember(null)}
        title={actionMember ? getMemberName(actionMember) : undefined}
        options={
          actionMember?.status === 'invited'
            ? [
                {
                  label: 'Ta bort inbjudan',
                  icon: 'user-x',
                  color: '#dc2626',
                  onPress: () => handleRemoveMember(actionMember!),
                },
              ]
            : [
                ...(isAdmin
                  ? [
                      {
                        label: 'Redigera medlem',
                        icon: 'edit-2',
                        onPress: () => handleEditPress(actionMember!),
                      },
                    ]
                  : []),
                {
                  label: 'Ta bort medlem',
                  icon: 'user-x',
                  color: '#dc2626',
                  onPress: () => handleRemoveMember(actionMember!),
                },
              ]
        }
      />

      {/* ── GROUP ACTION MENU ── */}
      <ActionMenu
        visible={!!actionGroup}
        onClose={() => setActionGroup(null)}
        title={actionGroup?.name}
        options={[
          {
            label: 'Redigera grupp',
            icon: 'edit-2',
            onPress: () => {
              setEditingGroup(actionGroup);
              setShowGroupModal(true);
            },
          },
          {
            label: 'Ta bort grupp',
            icon: 'trash-2',
            color: '#dc2626',
            onPress: () => handleDeleteGroup(actionGroup!),
          },
        ]}
      />
    </View>
  );
}

// ════════════════════════════════════════════
//  INVITE MODAL
// ════════════════════════════════════════════

function InviteModal({
  visible,
  onClose,
  organizationId,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('medlem');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setEmail('');
    setRole('medlem');
    onClose();
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      Alert.alert('', 'Ange en e-postadress.');
      return;
    }

    setSaving(true);
    const result = await inviteMember(organizationId, email.trim().toLowerCase(), role);
    setSaving(false);

    if (result.success) {
      Alert.alert('Inbjudan skickad', 'Inbjudan skapad och e-post skickad!');
      setEmail('');
      setRole('medlem');
      onSuccess();
    } else {
      Alert.alert('Fel', result.error || 'Kunde inte skapa inbjudan.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Bjud in ny medlem</Text>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body}>
            <Text style={modalStyles.label}>E-postadress</Text>
            <View style={modalStyles.inputRow}>
              <Feather name="mail" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput
                style={modalStyles.input}
                placeholder="medlem@exempel.se"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={modalStyles.label}>Roll</Text>
            <View style={modalStyles.roleOptions}>
              {(['medlem', 'styrelse', 'admin'] as const).map((r) => {
                const config = ROLE_CONFIG[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      modalStyles.roleOption,
                      role === r && { borderColor: Colors.light.tint, backgroundColor: '#eff6ff' },
                    ]}
                    onPress={() => setRole(r)}
                  >
                    <Feather name={config.icon as any} size={16} color={config.color} />
                    <Text style={modalStyles.roleOptionText}>{config.label}</Text>
                    {role === r && <Feather name="check" size={16} color={Colors.light.tint} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.cancelButton} onPress={handleClose}>
              <Text style={modalStyles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.primaryButton, saving && { opacity: 0.6 }]}
              onPress={handleInvite}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={modalStyles.primaryButtonText}>Skicka inbjudan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════
//  EDIT MEMBER MODAL
// ════════════════════════════════════════════

function EditMemberModal({
  visible,
  member,
  categories,
  assignments,
  onClose,
  onSuccess,
  isAdmin,
}: {
  visible: boolean;
  member: OrganizationMember | null;
  categories: MemberCategory[];
  assignments: CategoryAssignment[];
  onClose: () => void;
  onSuccess: () => void;
  isAdmin: boolean;
}) {
  const [role, setRole] = useState('');
  const [boardTitle, setBoardTitle] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setBoardTitle(member.board_title);
      setSelectedCategoryIds(
        assignments
          .filter((a) => a.membership_id === member.id)
          .map((a) => a.category_id)
      );
    }
  }, [member, assignments]);

  if (!member) return null;

  const name = getMemberName(member);
  const email = getMemberEmail(member);
  const phone = getMemberPhone(member);
  const boardTitleOptions = isAdmin ? ADMIN_BOARD_TITLES : BOARD_TITLES;
  const showBoardTitle = role === 'styrelse' || role === 'admin';

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const roleOk = await updateMemberRole(member.id, role, showBoardTitle ? boardTitle : null);
    if (isAdmin && categories.length > 0) {
      await updateCategoryAssignments(member.id, selectedCategoryIds, assignments);
    }
    setSaving(false);

    if (roleOk) {
      onSuccess();
    } else {
      Alert.alert('Fel', 'Kunde inte spara ändringar.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Redigera medlem</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body}>
            {/* User info card */}
            <View style={styles.editMemberCard}>
              <Avatar
                url={member.profile?.profile_image_url}
                size={48}
                name={name}
                placeholderColor="#eff6ff"
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.memberName}>{name}</Text>
                {email ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Feather name="mail" size={12} color="#9ca3af" />
                    <Text style={styles.memberEmail}>{email}</Text>
                  </View>
                ) : null}
                {phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Feather name="phone" size={12} color="#9ca3af" />
                    <Text style={styles.memberEmail}>{phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Role selection */}
            <Text style={modalStyles.label}>Roll</Text>
            <View style={modalStyles.roleOptions}>
              {(['medlem', 'styrelse', 'admin'] as const).map((r) => {
                const config = ROLE_CONFIG[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      modalStyles.roleOption,
                      role === r && { borderColor: Colors.light.tint, backgroundColor: '#eff6ff' },
                    ]}
                    onPress={() => setRole(r)}
                  >
                    <Feather name={config.icon as any} size={16} color={config.color} />
                    <Text style={modalStyles.roleOptionText}>{config.label}</Text>
                    {role === r && <Feather name="check" size={16} color={Colors.light.tint} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Board title (conditional) */}
            {showBoardTitle && (
              <>
                <Text style={modalStyles.label}>Styrelsepost / Titel</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 16 }}
                  contentContainerStyle={{ gap: 8 }}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      !boardTitle && styles.filterPillActive,
                    ]}
                    onPress={() => setBoardTitle(null)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        !boardTitle && styles.filterPillTextActive,
                      ]}
                    >
                      Ingen
                    </Text>
                  </TouchableOpacity>
                  {boardTitleOptions.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.filterPill,
                        boardTitle === t && styles.filterPillActive,
                      ]}
                      onPress={() => setBoardTitle(t)}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          boardTitle === t && styles.filterPillTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Category checkboxes (admin + groups exist) */}
            {isAdmin && categories.length > 0 && (
              <>
                <Text style={modalStyles.label}>Grupper</Text>
                {categories.map((cat) => {
                  const selected = selectedCategoryIds.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.categoryCheckRow}
                      onPress={() => toggleCategory(cat.id)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selected && { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
                        ]}
                      >
                        {selected && <Feather name="check" size={14} color="#fff" />}
                      </View>
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text style={styles.categoryCheckLabel}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Role info box */}
            <View style={styles.infoBox}>
              <Feather name="info" size={16} color={Colors.light.tint} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.infoBoxText}>
                  <Text style={{ fontWeight: '600' }}>Medlem:</Text> Kan se grundläggande
                  information
                </Text>
                <Text style={styles.infoBoxText}>
                  <Text style={{ fontWeight: '600' }}>Styrelse:</Text> Kan hantera medlemmar och
                  se rapporter
                </Text>
                <Text style={styles.infoBoxText}>
                  <Text style={{ fontWeight: '600' }}>Administratör:</Text> Full åtkomst till alla
                  funktioner
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
              <Text style={modalStyles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.primaryButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={modalStyles.primaryButtonText}>Spara ändringar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════
//  GROUP MODAL
// ════════════════════════════════════════════

function GroupModal({
  visible,
  group,
  organizationId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  group: MemberCategory | null;
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);

  const PRESET_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  ];

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || '');
      setColor(group.color || '#3B82F6');
    } else {
      setName('');
      setDescription('');
      setColor('#3B82F6');
    }
  }, [group, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('', 'Ange ett gruppnamn.');
      return;
    }

    setSaving(true);
    if (group) {
      const ok = await updateCategory(group.id, name.trim(), description.trim() || null, color);
      setSaving(false);
      if (ok) onSuccess();
      else Alert.alert('Fel', 'Kunde inte uppdatera gruppen.');
    } else {
      const result = await createCategory(
        organizationId,
        name.trim(),
        description.trim() || null,
        color
      );
      setSaving(false);
      if (result) onSuccess();
      else Alert.alert('Fel', 'Kunde inte skapa gruppen.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{group ? 'Redigera grupp' : 'Ny grupp'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body}>
            <Text style={modalStyles.label}>Namn</Text>
            <TextInput
              style={modalStyles.textInput}
              placeholder="Gruppnamn"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />

            <Text style={modalStyles.label}>Beskrivning</Text>
            <TextInput
              style={[modalStyles.textInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Valfri beskrivning..."
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={modalStyles.label}>Färg</Text>
            <View style={styles.colorPicker}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    color === c && styles.colorOptionSelected,
                  ]}
                  onPress={() => setColor(c)}
                >
                  {color === c && <Feather name="check" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <View style={[styles.categoryBadge, { backgroundColor: color + '20', borderColor: color + '40', alignSelf: 'flex-start', marginTop: 8 }]}>
              <View style={[styles.categoryDot, { backgroundColor: color }]} />
              <Text style={[styles.categoryBadgeText, { color }]}>{name || 'Förhandsgranskning'}</Text>
            </View>
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
              <Text style={modalStyles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.primaryButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={modalStyles.primaryButtonText}>
                  {group ? 'Uppdatera' : 'Skapa'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.light.tint,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },

  // Filters
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dropdownActive: {
    backgroundColor: Colors.light.tint + '10',
    borderColor: Colors.light.tint,
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  dropdownTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownMenuItemActive: {
    backgroundColor: Colors.light.tint + '08',
  },
  dropdownMenuItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dropdownMenuItemTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterPillActive: {
    backgroundColor: Colors.light.tint + '15',
    borderColor: Colors.light.tint,
  },
  filterPillText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
  },
  emptyLink: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '600',
  },

  // Member card
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  memberEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 1,
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  detailItemText: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Badges
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  boardTitleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  boardTitleText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  joinedDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 8,
  },

  // Action button
  actionButton: {
    padding: 6,
  },

  // Groups
  groupColorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  groupMemberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupMemberCountText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Edit modal extras
  editMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCheckLabel: {
    fontSize: 14,
    color: '#374151',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  },

  // Color picker
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  textInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    marginBottom: 20,
  },
  roleOptions: {
    gap: 8,
    marginBottom: 20,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  roleOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
