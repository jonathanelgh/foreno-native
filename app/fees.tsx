import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { FeeWithPayment, formatCurrency, getStatusColor, getStatusText, getUserFees } from '../lib/api/fees';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { Document } from '../types/database';

export default function FeesScreen() {
  const router = useRouter();
  const { user, activeOrganization } = useAuth();
  const [fees, setFees] = useState<FeeWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadFees = async () => {
    if (!user || !activeOrganization) return;
    try {
      const data = await getUserFees(activeOrganization.id, user.id);
      setFees(data);
    } catch (error) {
      console.error('Error loading fees:', error);
      Alert.alert('Fel', 'Kunde inte ladda avgifter');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, [user, activeOrganization]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFees();
  };

  const handleViewInvoice = (fee: FeeWithPayment) => {
    if (!fee.payment?.invoice_pdf_path) {
      Alert.alert('Fel', 'Ingen faktura tillgänglig för denna avgift');
      return;
    }

    // Construct a partial document object for the preview modal
    // The modal uses file_url or file_path to load content
    const invoiceDoc: any = {
      id: fee.id,
      title: fee.title || 'Faktura',
      file_name: fee.payment.invoice_pdf_file_name || `faktura_${fee.id}.pdf`,
      // We pass the path directly, the modal handles bucket logic. 
      // But modal defaults to 'documents' bucket. 
      // If invoice bucket is different, we might need to handle that.
      // Assuming 'documents' bucket for now based on typical setup, 
      // or we can pass a full signed URL if we fetch it here.
      // Wait, DocumentPreviewModal expects a Document object.
      // It tries to parse bucket from file_url if available.
      // Or defaults to 'documents'.
      // Fee payment has invoice_pdf_bucket.
      
      // Let's construct a "fake" file_url that the modal can parse if needed,
      // OR rely on the modal using file_path and default bucket if we can't change bucket.
      // Looking at DocumentPreviewModal:
      // "let bucket: string = 'documents';"
      // "if (document.file_url) { const urlMatch = ... bucket = urlMatch[1]; }"
      
      // So if we provide a file_url like string that contains the bucket, it might work.
      // Or we can modify DocumentPreviewModal to accept bucket.
      // But for now, let's try to pass the path and hope it's in 'documents' or we can trick it.
      
      // Actually, let's look at the data. Invoice bucket is likely 'documents'.
      // If fee.payment.invoice_pdf_bucket is set, we should respect it.
      // We can pass a constructed URL: https://.../bucket/path
      
      file_url: `https://project.supabase.co/storage/v1/object/public/${fee.payment.invoice_pdf_bucket || 'documents'}/${fee.payment.invoice_pdf_path}`,
      file_path: fee.payment.invoice_pdf_path,
      file_type: 'application/pdf'
    };

    setSelectedDocument(invoiceDoc);
    setShowPreview(true);
  };

  const renderItem = ({ item }: { item: FeeWithPayment }) => {
    // Calculate due date (assuming start_date + 30 days if not specified in payment)
    // Or use payment due_date if exists
    const dueDate = item.payment?.due_date || (item.start_date ? new Date(new Date(item.start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null);
    const status = item.payment?.status;
    const statusColor = getStatusColor(status, dueDate);
    const statusText = getStatusText(status, dueDate);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDate}>
              Förfallodatum: {dueDate ? new Date(dueDate).toLocaleDateString('sv-SE') : 'Ej angivet'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}> 
              <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Fakturanummer</Text>
            <Text style={styles.value}>
              {item.invoice_number || `#${item.id.slice(0, 8).toUpperCase()}`}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Belopp</Text>
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.downloadButton}
            onPress={() => handleViewInvoice(item)}
          >
            <Feather name="eye" size={18} color="#2563eb" />
            <Text style={styles.downloadButtonText}>Visa faktura</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Mina fakturor</Text>
            {activeOrganization && (
              <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <View style={styles.content}>
          <FlatList
            data={fees}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="file-text" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>Inga fakturor hittades</Text>
              </View>
            }
          />
        </View>
      )}

      <DocumentPreviewModal
        visible={showPreview}
        document={selectedDocument}
        onClose={() => {
          setShowPreview(false);
          setSelectedDocument(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 13,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardBody: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  downloadButtonText: {
    marginLeft: 8,
    color: '#2563eb',
    fontWeight: '500',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});
