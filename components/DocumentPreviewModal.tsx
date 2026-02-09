import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking } from 'react-native';

// Optional sharing - will be used if available
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // Sharing not available
}
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { Document } from '../types/database';
import { getDocumentUrl } from '../lib/api/documents';
import { isImageFile } from '../lib/storage';
import { supabase } from '../lib/supabase';

interface DocumentPreviewModalProps {
  visible: boolean;
  document: Document | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ visible, document, onClose }: DocumentPreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible && document) {
      loadFileUrl();
    } else {
      setFileUrl(null);
      setError(null);
      setLoading(true);
    }
  }, [visible, document]);

  const loadFileUrl = async () => {
    if (!document) return;

    try {
      setLoading(true);
      setError(null);

      let url: string;
      
      // Always use signed URLs for RLS-protected buckets
      // Extract the path from file_url if it's a full URL, or use file_path
      let filePath: string | null = null;
      let bucket: string = 'documents';

      if (document.file_path) {
        filePath = document.file_path;
      } else if (document.file_url) {
        // Extract path from full URL if it exists
        // URL format: https://project.supabase.co/storage/v1/object/public/bucket/path
        const urlMatch = document.file_url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
        if (urlMatch) {
          bucket = urlMatch[1];
          filePath = urlMatch[2];
        } else if (!document.file_url.startsWith('http')) {
          // If file_url is not a full URL, treat it as a path
          filePath = document.file_url;
        } else {
          // If it's a full URL but we can't parse it, try to create signed URL from file_path
          // or use the URL directly as fallback
          if (document.file_path) {
            filePath = document.file_path;
          } else {
            // Last resort: use the URL directly (might fail with RLS)
            url = document.file_url;
          }
        }
      }

      // Create signed URL if we have a path
      if (filePath && !url) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (error) {
          console.error('Error creating signed URL:', error);
          throw error;
        }

        url = data.signedUrl;
      }

      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid file URL');
      }

      setFileUrl(url);
    } catch (error: any) {
      console.error('Error loading file URL:', error);
      console.error('Document data:', {
        file_url: document.file_url,
        file_path: document.file_path,
        file_name: document.file_name
      });
      setError(error.message || 'Kunde inte ladda filen');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fileUrl || !document) return;

    try {
      const fileName = document.file_name || document.title || 'document';
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

      // Download file to cache directory
      const fileUri = FileSystem.cacheDirectory + sanitizedFileName;
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);

      // Try to use sharing if available
      if (Sharing) {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: document.file_type || 'application/pdf',
              dialogTitle: 'Spara fil',
            });
            return;
          }
        } catch (shareError) {
          console.log('Sharing not available, using fallback');
        }
      }

      // Fallback: open the file URL directly for download
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Framgång', 'Filen har laddats ner');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Fel', 'Kunde inte ladda ner filen');
    }
  };

  const isImage = document?.file_type ? isImageFile(document.file_type) : false;
  const fileName = document?.title || document?.file_name || 'Dokument';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Top Banner */}
        <View style={styles.banner}>
          <TouchableOpacity
            style={styles.bannerButton}
            onPress={onClose}
          >
            <Feather name="x" size={24} color="#1f2937" />
          </TouchableOpacity>
          
          <View style={styles.bannerTitleContainer}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {fileName}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.bannerButton}
            onPress={handleDownload}
            disabled={!fileUrl || loading}
          >
            <Feather name="download" size={24} color={fileUrl && !loading ? "#2563eb" : "#9ca3af"} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Laddar fil...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && fileUrl && (
            <>
              {isImage ? (
                <Image
                  source={{ uri: fileUrl }}
                  style={styles.image}
                  contentFit="contain"
                  transition={200}
                />
              ) : (
                <WebView
                  source={{ uri: fileUrl }}
                  style={styles.webview}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#2563eb" />
                    </View>
                  )}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('WebView error: ', nativeEvent);
                    setError('Kunde inte visa filen');
                  }}
                />
              )}
            </>
          )}
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  bannerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});
