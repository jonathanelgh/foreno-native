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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  FelanmalningWithCreator,
  createFelanmalning,
  deleteFelanmalning,
  getFelanmalningar,
  updateFelanmalningStatus,
} from '../lib/api/felanmalningar';
import type { FelanmalningStatus } from '../types/database';

// ── Status helpers ──

type StatusConfig = {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: 'alert-triangle' | 'clock' | 'check-circle';
};

const STATUS_CONFIG: Record<FelanmalningStatus, StatusConfig> = {
  received: {
    label: 'Mottagen',
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
    icon: 'alert-triangle',
  },
  in_progress: {
    label: 'Pågår',
    bg: '#eff6ff',
    text: '#2563eb',
    border: '#bfdbfe',
    icon: 'clock',
  },
  completed: {
    label: 'Klar',
    bg: '#ecfdf5',
    text: '#059669',
    border: '#a7f3d0',
    icon: 'check-circle',
  },
};

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as FelanmalningStatus] ?? STATUS_CONFIG.received;
}

function creatorDisplayName(
  creator: FelanmalningWithCreator['creator']
): string {
  if (!creator) return 'Okänd användare';
  const first = creator.first_name?.trim() || '';
  const last = creator.last_name?.trim() || '';
  const name = [first, last].filter(Boolean).join(' ');
  return name || creator.email || 'Okänd användare';
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateLong(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) +
    ', ' +
    d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  );
}

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <View
      style={[
        badgeStyles.badge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
    >
      <Feather name={cfg.icon} size={12} color={cfg.text} />
      <Text style={[badgeStyles.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  text: { fontSize: 12, fontWeight: '600' },
});

// ── Status Picker (inline for admins) ──

const ALL_STATUSES: FelanmalningStatus[] = [
  'received',
  'in_progress',
  'completed',
];

function StatusPicker({
  current,
  onChange,
}: {
  current: string;
  onChange: (s: FelanmalningStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = getStatusConfig(current);

  return (
    <View>
      <TouchableOpacity
        style={[
          pickerStyles.trigger,
          { backgroundColor: cfg.bg, borderColor: cfg.border },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Feather name={cfg.icon} size={12} color={cfg.text} />
        <Text style={[pickerStyles.triggerText, { color: cfg.text }]}>
          {cfg.label}
        </Text>
        <Feather name="chevron-down" size={12} color={cfg.text} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={pickerStyles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={pickerStyles.menu}>
            <Text style={pickerStyles.menuTitle}>Ändra status</Text>
            {ALL_STATUSES.map((s) => {
              const c = getStatusConfig(s);
              const isActive = s === current;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    pickerStyles.menuItem,
                    isActive && pickerStyles.menuItemActive,
                  ]}
                  onPress={() => {
                    setOpen(false);
                    if (s !== current) onChange(s);
                  }}
                >
                  <Feather name={c.icon} size={16} color={c.text} />
                  <Text style={[pickerStyles.menuItemText, { color: c.text }]}>
                    {c.label}
                  </Text>
                  {isActive && (
                    <Feather name="check" size={16} color={c.text} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  triggerText: { fontSize: 12, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    width: '100%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 10,
  },
  menuItemActive: { backgroundColor: '#f9fafb' },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '500' },
});

// ── Filter Dropdown ──

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Alla statusar' },
  { value: 'received', label: 'Mottagen' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'completed', label: 'Klar' },
];

function FilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = FILTER_OPTIONS.find((o) => o.value === value);

  return (
    <View>
      <TouchableOpacity
        style={filterStyles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Feather name="filter" size={16} color="#6b7280" />
        <Text style={filterStyles.triggerText}>
          {current?.label || 'Alla statusar'}
        </Text>
        <Feather name="chevron-down" size={16} color="#6b7280" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={pickerStyles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={pickerStyles.menu}>
            <Text style={pickerStyles.menuTitle}>Filtrera status</Text>
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  pickerStyles.menuItem,
                  opt.value === value && pickerStyles.menuItemActive,
                ]}
                onPress={() => {
                  setOpen(false);
                  onChange(opt.value);
                }}
              >
                <Text
                  style={[
                    pickerStyles.menuItemText,
                    { color: '#374151' },
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.value === value && (
                  <Feather name="check" size={16} color="#2563eb" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const filterStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  triggerText: { fontSize: 14, color: '#374151', fontWeight: '500' },
});

// ══════════════════════════════════════
// ══  Main Screen
// ══════════════════════════════════════

export default function FelanmalanScreen() {
  const router = useRouter();
  const { user, activeOrganization, isAdmin, isStyrelse } = useAuth();
  const canManage = isAdmin || isStyrelse;

  // Data
  const [reports, setReports] = useState<FelanmalningWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedReport, setSelectedReport] =
    useState<FelanmalningWithCreator | null>(null);

  // Create form
  const [createSubject, setCreateSubject] = useState('');
  const [createText, setCreateText] = useState('');
  const [creating, setCreating] = useState(false);

  // Detail modal
  const [detailStatus, setDetailStatus] = useState<FelanmalningStatus>('received');
  const [savingStatus, setSavingStatus] = useState(false);

  // Delete modal
  const [deleting, setDeleting] = useState(false);

  // ── Data loading ──

  const loadReports = useCallback(async () => {
    if (!activeOrganization) return;
    try {
      let data = await getFelanmalningar(activeOrganization.id);
      // Members only see their own reports
      if (!canManage && user?.id) {
        data = data.filter((r) => r.created_by === user.id);
      }
      setReports(data);
    } catch {
      Alert.alert('Fel', 'Kunde inte ladda felanmälningar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOrganization?.id, canManage, user?.id]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  // ── Filtered list ──

  const filteredReports = useMemo(() => {
    let list = reports;

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const subject = r.subject?.toLowerCase() || '';
        const text = r.text?.toLowerCase() || '';
        const firstName = r.creator?.first_name?.toLowerCase() || '';
        const lastName = r.creator?.last_name?.toLowerCase() || '';
        const email = r.creator?.email?.toLowerCase() || '';
        return (
          subject.includes(q) ||
          text.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q) ||
          email.includes(q)
        );
      });
    }

    return list;
  }, [reports, statusFilter, searchQuery]);

  // ── Handlers ──

  const handleCreate = async () => {
    if (!createSubject.trim() || !createText.trim()) {
      Alert.alert('Fel', 'Fyll i ämne och beskrivning');
      return;
    }
    if (!activeOrganization || !user?.id) return;
    setCreating(true);
    try {
      await createFelanmalning(
        activeOrganization.id,
        createSubject,
        createText,
        user.id
      );
      setShowCreateModal(false);
      setCreateSubject('');
      setCreateText('');
      loadReports();
    } catch {
      Alert.alert('Fel', 'Kunde inte skapa felanmälan');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (
    report: FelanmalningWithCreator,
    newStatus: FelanmalningStatus
  ) => {
    try {
      await updateFelanmalningStatus(report.id, newStatus);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: newStatus } : r))
      );
    } catch {
      Alert.alert('Fel', 'Kunde inte uppdatera status');
    }
  };

  const handleOpenDetail = (report: FelanmalningWithCreator) => {
    setSelectedReport(report);
    setDetailStatus(report.status as FelanmalningStatus);
    setShowDetailModal(true);
  };

  const handleSaveDetailStatus = async () => {
    if (!selectedReport) return;
    setSavingStatus(true);
    try {
      await updateFelanmalningStatus(selectedReport.id, detailStatus);
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id ? { ...r, status: detailStatus } : r
        )
      );
      setShowDetailModal(false);
    } catch {
      Alert.alert('Fel', 'Kunde inte spara status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleOpenDelete = (report: FelanmalningWithCreator) => {
    setSelectedReport(report);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedReport) return;
    setDeleting(true);
    try {
      await deleteFelanmalning(selectedReport.id);
      setShowDeleteModal(false);
      setSelectedReport(null);
      loadReports();
    } catch {
      Alert.alert('Fel', 'Kunde inte ta bort felanmälan');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render helpers ──

  const renderReportItem = ({
    item,
  }: {
    item: FelanmalningWithCreator;
  }) => (
    <TouchableOpacity
      style={styles.reportCard}
      activeOpacity={canManage ? 0.7 : 1}
      onPress={() => canManage && handleOpenDetail(item)}
    >
      <View style={styles.reportTop}>
        <View style={styles.reportTitleArea}>
          <Text style={styles.reportSubject} numberOfLines={1}>
            {item.subject}
          </Text>
          <Text style={styles.reportPreview} numberOfLines={2}>
            {item.text}
          </Text>
        </View>
        {canManage ? (
          <StatusPicker
            current={item.status}
            onChange={(s) => handleStatusChange(item, s)}
          />
        ) : (
          <StatusBadge status={item.status} />
        )}
      </View>

      <View style={styles.reportBottom}>
        <View style={styles.reportMeta}>
          <Feather name="user" size={13} color="#9ca3af" />
          <Text style={styles.reportMetaText}>
            {creatorDisplayName(item.creator)}
          </Text>
        </View>
        <Text style={styles.reportDate}>
          {formatDateShort(item.created_at)}
        </Text>
      </View>

      {/* Admin action buttons */}
      {canManage && (
        <View style={styles.reportActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenDetail(item)}
            hitSlop={8}
          >
            <Feather name="eye" size={16} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenDelete(item)}
            hitSlop={8}
          >
            <Feather name="trash-2" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  // ══════════════════════════════════════
  // ══  JSX
  // ══════════════════════════════════════

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color="#2563eb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Felanmälan</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Skapa</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterBar}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök felanmälningar..."
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
        <FilterDropdown value={statusFilter} onChange={setStatusFilter} />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563eb']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="alert-triangle" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {searchQuery || statusFilter !== 'all'
                  ? 'Inga felanmälningar matchade filtren'
                  : 'Inga felanmälningar ännu'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== 'all'
                  ? 'Prova att ändra sökning eller filter'
                  : 'Tryck på "Skapa" för att rapportera ett problem'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Create Modal ── */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.popup}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Skapa felanmälan</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateSubject('');
                  setCreateText('');
                }}
              >
                <Feather name="x" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={modalStyles.body}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={modalStyles.label}>Ämne</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="Ange ämne för felanmälan"
                placeholderTextColor="#9ca3af"
                value={createSubject}
                onChangeText={setCreateSubject}
              />

              <Text style={modalStyles.label}>Beskrivning</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textarea]}
                placeholder="Beskriv problemet..."
                placeholderTextColor="#9ca3af"
                value={createText}
                onChangeText={setCreateText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={modalStyles.footer}>
              <TouchableOpacity
                style={modalStyles.secondaryBtn}
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateSubject('');
                  setCreateText('');
                }}
              >
                <Text style={modalStyles.secondaryBtnText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  modalStyles.primaryBtn,
                  creating && modalStyles.btnDisabled,
                ]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={modalStyles.primaryBtnText}>Skapa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal (Admin) ── */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.popup, { maxHeight: '90%' }]}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Felanmälan detaljer</Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
              >
                <Feather name="x" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView
                style={modalStyles.body}
                showsVerticalScrollIndicator={false}
              >
                {/* Status */}
                <Text style={modalStyles.label}>Status</Text>
                <View style={{ marginBottom: 16 }}>
                  {ALL_STATUSES.map((s) => {
                    const c = getStatusConfig(s);
                    const active = detailStatus === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          detailStyles.statusOption,
                          active && {
                            backgroundColor: c.bg,
                            borderColor: c.border,
                          },
                        ]}
                        onPress={() => setDetailStatus(s)}
                      >
                        <Feather
                          name={c.icon}
                          size={16}
                          color={active ? c.text : '#9ca3af'}
                        />
                        <Text
                          style={[
                            detailStyles.statusOptionText,
                            active && { color: c.text, fontWeight: '600' },
                          ]}
                        >
                          {c.label}
                        </Text>
                        {active && (
                          <Feather name="check" size={16} color={c.text} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Subject */}
                <Text style={modalStyles.label}>Ämne</Text>
                <View style={detailStyles.readonlyBox}>
                  <Text style={detailStyles.readonlyText}>
                    {selectedReport.subject}
                  </Text>
                </View>

                {/* Description */}
                <Text style={modalStyles.label}>Beskrivning</Text>
                <View
                  style={[detailStyles.readonlyBox, { minHeight: 120 }]}
                >
                  <Text style={detailStyles.readonlyText}>
                    {selectedReport.text}
                  </Text>
                </View>

                {/* Creator info */}
                <Text style={modalStyles.label}>Skapad av</Text>
                <View style={detailStyles.creatorCard}>
                  <View style={detailStyles.creatorRow}>
                    <Feather name="user" size={16} color="#6b7280" />
                    <Text style={detailStyles.creatorText}>
                      {creatorDisplayName(selectedReport.creator)}
                    </Text>
                  </View>
                  {selectedReport.creator?.email && (
                    <TouchableOpacity
                      style={detailStyles.creatorRow}
                      onPress={() =>
                        Linking.openURL(
                          `mailto:${selectedReport.creator!.email}`
                        )
                      }
                    >
                      <Feather name="mail" size={16} color="#2563eb" />
                      <Text
                        style={[
                          detailStyles.creatorText,
                          { color: '#2563eb' },
                        ]}
                      >
                        {selectedReport.creator.email}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {selectedReport.creator?.phone_number && (
                    <TouchableOpacity
                      style={detailStyles.creatorRow}
                      onPress={() =>
                        Linking.openURL(
                          `tel:${selectedReport.creator!.phone_number}`
                        )
                      }
                    >
                      <Feather name="phone" size={16} color="#2563eb" />
                      <Text
                        style={[
                          detailStyles.creatorText,
                          { color: '#2563eb' },
                        ]}
                      >
                        {selectedReport.creator.phone_number}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Created date */}
                <Text style={modalStyles.label}>Skapad</Text>
                <View style={detailStyles.readonlyBox}>
                  <Text style={detailStyles.readonlyText}>
                    {formatDateLong(selectedReport.created_at)}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={modalStyles.footer}>
              <TouchableOpacity
                style={modalStyles.secondaryBtn}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={modalStyles.secondaryBtnText}>Stäng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  modalStyles.primaryBtn,
                  savingStatus && modalStyles.btnDisabled,
                ]}
                onPress={handleSaveDetailStatus}
                disabled={savingStatus}
              >
                {savingStatus ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={modalStyles.primaryBtnText}>
                    Spara status
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.popup}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Ta bort felanmälan</Text>
              <TouchableOpacity
                onPress={() => setShowDeleteModal(false)}
              >
                <Feather name="x" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.body}>
              <Text style={deleteStyles.message}>
                Är du säker på att du vill ta bort felanmälan "
                {selectedReport?.subject}"? Denna åtgärd kan inte ångras.
              </Text>
            </View>

            <View style={modalStyles.footer}>
              <TouchableOpacity
                style={modalStyles.secondaryBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={modalStyles.secondaryBtnText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  deleteStyles.deleteBtn,
                  deleting && modalStyles.btnDisabled,
                ]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={deleteStyles.deleteBtnText}>Ta bort</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════
// ══  Styles
// ══════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Filters
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  // List
  listContent: { padding: 16, paddingBottom: 32 },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reportTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  reportTitleArea: { flex: 1 },
  reportSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  reportPreview: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  reportBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reportMetaText: { fontSize: 13, color: '#9ca3af' },
  reportDate: { fontSize: 13, color: '#9ca3af' },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  actionBtn: { padding: 6 },
  // Empty
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'center',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── Modal shared styles ──
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  popup: {
    backgroundColor: '#fff',
    borderRadius: 18,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#111827' },
  body: { paddingHorizontal: 20, paddingVertical: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
  },
  textarea: { minHeight: 130, textAlignVertical: 'top' },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  primaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});

// ── Detail modal specific ──
const detailStyles = StyleSheet.create({
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    gap: 10,
  },
  statusOptionText: { flex: 1, fontSize: 15, color: '#6b7280' },
  readonlyBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  readonlyText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  creatorCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  creatorText: { fontSize: 14, color: '#374151' },
});

// ── Delete modal specific ──
const deleteStyles = StyleSheet.create({
  message: { fontSize: 15, color: '#374151', lineHeight: 22 },
  deleteBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#dc2626',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
