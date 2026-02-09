import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceItem, ListingStatus } from '../types/marketplace';
import {
  getUserMarketplaceItems,
  updateListingStatus,
  deleteListing,
} from '../lib/api/marketplace';
import { ProductImage } from '../components/ProductImage';

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ListingStatus, { label: string; color: string; bg: string; icon: string }> = {
  published: { label: 'Publicerad', color: '#059669', bg: '#ecfdf5', icon: 'check-circle' },
  sold: { label: 'Såld', color: '#dc2626', bg: '#fef2f2', icon: 'tag' },
  expired: { label: 'Utgången', color: '#d97706', bg: '#fffbeb', icon: 'clock' },
  hidden: { label: 'Dold', color: '#6b7280', bg: '#f3f4f6', icon: 'eye-off' },
};

const TRANSACTION_LABELS: Record<string, string> = {
  sell: 'Säljes',
  buy: 'Köpes',
  give: 'Skänkes',
};

// ── Main screen ─────────────────────────────────────────────────────────────

export default function MyListingsScreen() {
  const router = useRouter();
  const { session, activeOrganization } = useAuth();

  const [listings, setListings] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Action sheet
  const [selectedListing, setSelectedListing] = useState<MarketplaceItem | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────

  const fetchListings = useCallback(async () => {
    if (!activeOrganization || !session?.user?.id) return;
    try {
      const data = await getUserMarketplaceItems(activeOrganization.id, session.user.id);
      setListings(data);
    } catch (e) {
      console.error('Error fetching my listings:', e);
    }
  }, [activeOrganization, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchListings().finally(() => setLoading(false));
    }, [fetchListings])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const openActions = (item: MarketplaceItem) => {
    setSelectedListing(item);
    setShowActionSheet(true);
  };

  const openStatusChange = () => {
    setShowActionSheet(false);
    setShowStatusModal(true);
  };

  const openDeleteConfirm = () => {
    setShowActionSheet(false);
    setShowDeleteConfirm(true);
  };

  const handleViewListing = () => {
    if (!selectedListing) return;
    setShowActionSheet(false);
    router.push({ pathname: `/listing/${selectedListing.id}` });
  };

  // ── Status change ───────────────────────────────────────────────────────

  const handleStatusChange = async (status: ListingStatus) => {
    if (!selectedListing) return;
    try {
      await updateListingStatus(selectedListing.id, status);
      setShowStatusModal(false);
      setSelectedListing(null);
      await fetchListings();
    } catch (e) {
      console.error('Error updating status:', e);
      Alert.alert('Fel', 'Kunde inte uppdatera status.');
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedListing) return;
    setDeleting(true);
    try {
      await deleteListing(selectedListing.id);
      setShowDeleteConfirm(false);
      setSelectedListing(null);
      await fetchListings();
    } catch (e) {
      console.error('Error deleting listing:', e);
      Alert.alert('Fel', 'Kunde inte ta bort annonsen.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render listing card ─────────────────────────────────────────────────

  const getExpiryText = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Utgången';
    return `${diffDays} dagar kvar`;
  };

  const renderListingItem = ({ item }: { item: MarketplaceItem }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.published;
    const imagePath = item.listing_images?.[0]?.path || null;
    const bucket = item.listing_images?.[0]?.bucket || 'listing_images';
    const expiryText = getExpiryText(item.expires_at);

    return (
      <TouchableOpacity
        style={styles.listingCard}
        onPress={() => openActions(item)}
        activeOpacity={0.7}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {imagePath ? (
            <ProductImage path={imagePath} bucket={bucket} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Feather name="image" size={24} color="#9ca3af" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </View>

          <Text style={styles.cardPrice}>
            {item.price != null && item.price > 0
              ? `${item.price.toLocaleString('sv-SE')} kr`
              : item.transaction_type === 'give' ? 'Gratis' : 'Pris ej angivet'}
          </Text>

          <View style={styles.cardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>

            <Text style={styles.cardType}>{TRANSACTION_LABELS[item.transaction_type] || item.transaction_type}</Text>
            {expiryText && (
              <Text style={[styles.cardDate, expiryText === 'Utgången' && { color: '#dc2626' }]}>
                {expiryText}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Header ──────────────────────────────────────────────────────────────

  const headerOptions = {
    title: 'Mina annonser',
    headerBackTitle: '',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: '#fff' },
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
  };

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingItem}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Inga annonser</Text>
              <Text style={styles.emptyText}>Du har inte skapat några annonser ännu.</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/create-listing')}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.createButtonText}>Skapa annons</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Action Sheet Modal ─────────────────────────────────────────── */}
      <Modal visible={showActionSheet} transparent animationType="fade" onRequestClose={() => setShowActionSheet(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>{selectedListing?.title}</Text>

            <TouchableOpacity style={styles.actionItem} onPress={handleViewListing}>
              <Feather name="eye" size={20} color="#374151" />
              <Text style={styles.actionText}>Visa annons</Text>
            </TouchableOpacity>

            {selectedListing?.status !== 'expired' && (
              <>
                <TouchableOpacity style={styles.actionItem} onPress={openStatusChange}>
                  <Feather name="refresh-cw" size={20} color="#374151" />
                  <Text style={styles.actionText}>Ändra status</Text>
                </TouchableOpacity>

                <View style={styles.actionDivider} />

                <TouchableOpacity style={styles.actionItem} onPress={openDeleteConfirm}>
                  <Feather name="trash-2" size={20} color="#dc2626" />
                  <Text style={[styles.actionText, { color: '#dc2626' }]}>Ta bort annons</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowActionSheet(false)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Status Modal ───────────────────────────────────────────────── */}
      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.statusSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Ändra status</Text>

            {(Object.entries(STATUS_CONFIG) as [ListingStatus, typeof STATUS_CONFIG[ListingStatus]][])
              .filter(([status]) => status !== 'expired')
              .map(([status, config]) => {
                const isActive = selectedListing?.status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusOption, isActive && styles.statusOptionActive]}
                    onPress={() => handleStatusChange(status)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={[styles.statusOptionText, isActive && { fontWeight: '600' }]}>
                      {config.label}
                    </Text>
                    {isActive && <Feather name="check" size={18} color={Colors.light.tint} />}
                  </TouchableOpacity>
                );
              }
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <View style={styles.deleteSheet}>
            <Feather name="alert-triangle" size={40} color="#dc2626" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.deleteTitle}>Ta bort annons</Text>
            <Text style={styles.deleteMessage}>
              Är du säker på att du vill ta bort "{selectedListing?.title}"? Denna åtgärd kan inte ångras.
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancel}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.deleteCancelText}>Avbryt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteConfirmText}>
                  {deleting ? 'Tar bort...' : 'Ta bort'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // ── Listing card ────────────────────────────────────────────────────────
  listingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbnailContainer: {
    width: 100,
    height: 100,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 0,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardType: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 11,
    color: '#9ca3af',
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Modal overlay ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  // ── Action sheet ────────────────────────────────────────────────────────
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionText: {
    fontSize: 16,
    color: '#374151',
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },

  // ── Status sheet ────────────────────────────────────────────────────────
  statusSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  statusOptionActive: {
    backgroundColor: '#f0f9ff',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },

  // ── Delete confirmation ─────────────────────────────────────────────────
  deleteSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteConfirmBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
