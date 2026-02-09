import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { supabase } from '../lib/supabase';

// ── Types ──

type TicketStatus = 'open' | 'in_progress' | 'closed';

interface SupportTicket {
  id: string;
  organization_id: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

// ── Status helpers ──

type StatusConfig = {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: 'life-buoy' | 'clock' | 'check-circle';
};

const STATUS_CONFIG: Record<TicketStatus, StatusConfig> = {
  open: {
    label: 'Öppet',
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
    icon: 'life-buoy',
  },
  in_progress: {
    label: 'Pågår',
    bg: '#eff6ff',
    text: '#2563eb',
    border: '#bfdbfe',
    icon: 'clock',
  },
  closed: {
    label: 'Avslutat',
    bg: '#ecfdf5',
    text: '#059669',
    border: '#a7f3d0',
    icon: 'check-circle',
  },
};

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as TicketStatus] ?? STATUS_CONFIG.open;
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

// ── Status Badge (read-only) ──

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

// ── Filter Dropdown ──

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Alla statusar' },
  { value: 'open', label: 'Öppet' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'closed', label: 'Avslutat' },
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
          style={dropdownStyles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={dropdownStyles.menu}>
            <Text style={dropdownStyles.menuTitle}>Filtrera status</Text>
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  dropdownStyles.menuItem,
                  opt.value === value && dropdownStyles.menuItemActive,
                ]}
                onPress={() => {
                  setOpen(false);
                  onChange(opt.value);
                }}
              >
                <Text style={[dropdownStyles.menuItemText, { color: '#374151' }]}>
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

const dropdownStyles = StyleSheet.create({
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

// ── FAQ Accordion Item ──

function FAQItem({
  faq,
  expanded,
  onToggle,
}: {
  faq: FAQ;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={faqItemStyles.container}>
      <TouchableOpacity
        style={faqItemStyles.questionRow}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={faqItemStyles.question}>{faq.question}</Text>
        <Feather
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
          color="#6b7280"
        />
      </TouchableOpacity>
      {expanded && (
        <View style={faqItemStyles.answerContainer}>
          <Text style={faqItemStyles.answer}>{faq.answer}</Text>
        </View>
      )}
    </View>
  );
}

const faqItemStyles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 21,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 0,
  },
  answer: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
});

// ══════════════════════════════════════
// ══  Main Screen
// ══════════════════════════════════════

export default function SupportScreen() {
  const router = useRouter();
  const { user, activeOrganization } = useAuth();

  // Data
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Create form
  const [createSubject, setCreateSubject] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // FAQ accordion
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // ── Data loading ──

  const loadTickets = useCallback(async () => {
    try {
      // RLS filters to only the user's own tickets for regular users
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading tickets:', error);
        return;
      }
      setTickets(data || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
    }
  }, []);

  const loadFaqs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading FAQs:', error);
        return;
      }
      setFaqs(data || []);
    } catch (err) {
      console.error('Error loading FAQs:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadTickets(), loadFaqs()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadTickets, loadFaqs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // ── Filtered tickets ──

  const filteredTickets = useMemo(() => {
    let list = tickets;

    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        const subject = t.subject?.toLowerCase() || '';
        const desc = t.description?.toLowerCase() || '';
        return subject.includes(q) || desc.includes(q);
      });
    }

    return list;
  }, [tickets, statusFilter, searchQuery]);

  // ── Handlers ──

  const handleCreate = async () => {
    if (!createSubject.trim() || !createDescription.trim()) {
      Alert.alert('Fel', 'Fyll i ämne och beskrivning');
      return;
    }
    if (!user?.id) return;

    setCreating(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        organization_id: activeOrganization?.id || null,
        subject: createSubject.trim(),
        description: createDescription.trim(),
        status: 'open',
        created_by: user.id,
      });

      if (error) {
        console.error('Error creating ticket:', error);
        Alert.alert('Fel', 'Kunde inte skapa ärende');
        return;
      }

      // Fire-and-forget notification
      supabase.functions
        .invoke('send-support-ticket-notification', {
          body: { subject: createSubject.trim(), description: createDescription.trim() },
        })
        .catch(() => {});

      setShowCreateModal(false);
      setCreateSubject('');
      setCreateDescription('');
      loadTickets();
    } catch {
      Alert.alert('Fel', 'Kunde inte skapa ärende');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
  };

  // ── Render ticket item ──

  const renderTicketItem = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={styles.ticketCard}
      activeOpacity={0.7}
      onPress={() => handleOpenDetail(item)}
    >
      <View style={styles.ticketTop}>
        <View style={styles.ticketTitleArea}>
          <Text style={styles.ticketSubject} numberOfLines={1}>
            {item.subject}
          </Text>
          <Text style={styles.ticketPreview} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.ticketBottom}>
        <Text style={styles.ticketDate}>{formatDateShort(item.created_at)}</Text>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => handleOpenDetail(item)}
          hitSlop={8}
        >
          <Feather name="eye" size={16} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // ── FAQ Section (rendered below list) ──

  const renderFaqSection = () => {
    if (faqs.length === 0) return null;

    return (
      <View style={styles.faqSection}>
        <View style={styles.faqHeader}>
          <Feather name="help-circle" size={20} color="#374151" />
          <Text style={styles.faqTitle}>Vanliga frågor</Text>
        </View>
        {faqs.map((faq) => (
          <FAQItem
            key={faq.id}
            faq={faq}
            expanded={expandedFaqId === faq.id}
            onToggle={() =>
              setExpandedFaqId(expandedFaqId === faq.id ? null : faq.id)
            }
          />
        ))}
      </View>
    );
  };

  // ══════════════════════════════════════
  // ══  JSX
  // ══════════════════════════════════════

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Support',
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Feather name="chevron-left" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={{ padding: 8 }}
            >
              <Feather name="plus" size={24} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Filters */}
      <View style={styles.filterBar}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök ärenden..."
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

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicketItem}
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
              <Feather name="life-buoy" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {searchQuery || statusFilter !== 'all'
                  ? 'Inga ärenden matchade filtren'
                  : 'Inga supportärenden ännu'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== 'all'
                  ? 'Prova att ändra sökning eller filter'
                  : 'Tryck på "+" för att skapa ett ärende'}
              </Text>
            </View>
          }
          ListFooterComponent={renderFaqSection}
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
              <Text style={modalStyles.title}>Skapa supportärende</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateSubject('');
                  setCreateDescription('');
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
                placeholder="Vad gäller ärendet?"
                placeholderTextColor="#9ca3af"
                value={createSubject}
                onChangeText={setCreateSubject}
              />

              <Text style={modalStyles.label}>Beskrivning</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textarea]}
                placeholder="Beskriv problemet eller din fråga..."
                placeholderTextColor="#9ca3af"
                value={createDescription}
                onChangeText={setCreateDescription}
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
                  setCreateDescription('');
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

      {/* ── Detail Modal (Read-only) ── */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.popup, { maxHeight: '85%' }]}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Supportärende</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Feather name="x" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView
                style={modalStyles.body}
                showsVerticalScrollIndicator={false}
              >
                {/* Status */}
                <Text style={modalStyles.label}>Status</Text>
                <View style={{ marginBottom: 16 }}>
                  <StatusBadge status={selectedTicket.status} />
                </View>

                {/* Subject */}
                <Text style={modalStyles.label}>Ämne</Text>
                <View style={detailStyles.readonlyBox}>
                  <Text style={detailStyles.readonlyText}>
                    {selectedTicket.subject}
                  </Text>
                </View>

                {/* Description */}
                <Text style={modalStyles.label}>Beskrivning</Text>
                <View style={[detailStyles.readonlyBox, { minHeight: 120 }]}>
                  <Text style={detailStyles.readonlyText}>
                    {selectedTicket.description}
                  </Text>
                </View>

                {/* Created date */}
                <Text style={modalStyles.label}>Skapad</Text>
                <View style={detailStyles.readonlyBox}>
                  <Text style={detailStyles.readonlyText}>
                    {formatDateLong(selectedTicket.created_at)}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={modalStyles.footer}>
              <TouchableOpacity
                style={[modalStyles.primaryBtn, { flex: 1 }]}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={modalStyles.primaryBtnText}>Stäng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════
// ══  Styles
// ══════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Filters
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
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
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  ticketTitleArea: { flex: 1 },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ticketPreview: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  ticketBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketDate: { fontSize: 13, color: '#9ca3af' },
  viewBtn: { padding: 6 },
  // FAQ Section
  faqSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
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
  readonlyBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  readonlyText: { fontSize: 15, color: '#374151', lineHeight: 22 },
});
