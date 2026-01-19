import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOrganizationDocuments, getDocumentUrl } from '../../lib/api/documents';
import { useAuth } from '../../contexts/AuthContext';
import { Document } from '../../types/database';

export default function DocumentsScreen() {
  const { activeOrganization, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!activeOrganization) {
      setLoading(false);
      return;
    }
    
    try {
      const documentsData = await getOrganizationDocuments(activeOrganization.id);
      setDocuments(documentsData);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Fel', 'Kunde inte ladda dokument');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    if (!authLoading) {
      loadDocuments();
    }
  }, [authLoading, loadDocuments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const getFileIcon = (fileType: string | null, fileName: string | null) => {
    const extension = fileName?.split('.').pop()?.toLowerCase() || '';
    
    if (fileType?.startsWith('image/')) {
      return 'image';
    }
    
    switch (extension) {
      case 'pdf':
        return 'document-text';
      case 'doc':
      case 'docx':
        return 'document-text';
      case 'xls':
      case 'xlsx':
        return 'document';
      case 'ppt':
      case 'pptx':
        return 'document';
      case 'txt':
        return 'document-text';
      case 'zip':
      case 'rar':
        return 'archive';
      default:
        return 'document';
    }
  };

  const getFileTypeColor = (fileType: string | null, fileName: string | null) => {
    const extension = fileName?.split('.').pop()?.toLowerCase() || '';
    
    if (fileType?.startsWith('image/')) {
      return '#10b981'; // Green for images
    }
    
    switch (extension) {
      case 'pdf':
        return '#ef4444'; // Red for PDFs
      case 'doc':
      case 'docx':
        return '#2563eb'; // Blue for Word
      case 'xls':
      case 'xlsx':
        return '#10b981'; // Green for Excel
      case 'ppt':
      case 'pptx':
        return '#f59e0b'; // Orange for PowerPoint
      default:
        return '#6b7280'; // Gray for others
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Idag';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Igår';
    } else {
      const monthNames = [
        'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
        'jul', 'aug', 'sep', 'okt', 'nov', 'dec'
      ];
      return `${date.getDate()} ${monthNames[date.getMonth()]}`;
    }
  };

  const handleDocumentPress = async (document: Document) => {
    if (!document.file_url && !document.file_path) {
      Alert.alert('Fel', 'Ingen fil-URL tillgänglig');
      return;
    }

    try {
      let fileUrl: string;
      
      if (document.file_url) {
        // If file_url is already a full URL, use it
        fileUrl = document.file_url.startsWith('http') 
          ? document.file_url 
          : await getDocumentUrl(document.file_url);
      } else if (document.file_path) {
        fileUrl = await getDocumentUrl(document.file_path);
      } else {
        throw new Error('No file URL available');
      }

      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Fel', 'Kan inte öppna denna filtyp');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Fel', 'Kunde inte öppna dokumentet');
    }
  };

  const renderDocumentItem = ({ item }: { item: Document }) => {
    const fileName = item.title || item.file_name || 'Namnlöst dokument';
    const fileSize = formatFileSize(item.file_size);
    const uploadDate = formatDate(item.uploaded_at);
    const iconName = getFileIcon(item.file_type, item.file_name);
    const iconColor = getFileTypeColor(item.file_type, item.file_name);

    return (
      <TouchableOpacity
        style={styles.documentItem}
        onPress={() => handleDocumentPress(item)}
      >
        <View style={[styles.documentIcon, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={iconName as any} size={28} color={iconColor} />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.documentMeta}>
            {fileSize && (
              <Text style={styles.documentMetaText}>{fileSize}</Text>
            )}
            {fileSize && uploadDate && (
              <Text style={styles.documentMetaSeparator}> • </Text>
            )}
            {uploadDate && (
              <Text style={styles.documentMetaText}>{uploadDate}</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (authLoading || loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Laddar dokument...</Text>
        </View>
      );
    }

    if (!activeOrganization) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="folder-outline" size={56} color="#9ca3af" />
          <Text style={styles.stateTitle}>Ingen organisation vald</Text>
          <Text style={styles.stateDescription}>
            Du måste vara medlem i en organisation för att se dokument.
          </Text>
        </View>
      );
    }

    if (documents.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="document-outline" size={56} color="#9ca3af" />
          <Text style={styles.stateTitle}>Inga dokument</Text>
          <Text style={styles.stateDescription}>
            Det finns inga dokument för denna organisation än.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={documents}
        renderItem={renderDocumentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Dokument</Text>
          {activeOrganization && (
            <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
          )}
        </View>
      </View>

      <View style={styles.content}>{renderContent()}</View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
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
  content: {
    flex: 1,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  stateDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  listContainer: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentMetaText: {
    fontSize: 13,
    color: '#64748b',
  },
  documentMetaSeparator: {
    fontSize: 13,
    color: '#9ca3af',
  },
});


