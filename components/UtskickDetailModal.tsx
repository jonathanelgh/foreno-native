import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface UtskickDetailModalProps {
  visible: boolean;
  utskick: any;
  onClose: () => void;
}

export function UtskickDetailModal({ visible, utskick, onClose }: UtskickDetailModalProps) {
  if (!utskick) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  const handleFileDownload = async () => {
    if (utskick.file_url) {
      try {
        const supported = await Linking.canOpenURL(utskick.file_url);
        if (supported) {
          await Linking.openURL(utskick.file_url);
        } else {
          Alert.alert('Fel', 'Kan inte öppna denna filtyp');
        }
      } catch (error) {
        Alert.alert('Fel', 'Kunde inte öppna filen');
      }
    }
  };

  const stripHtml = (html: string) => {
    return html?.replace(/<[^>]*>/g, '') || '';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Information</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={styles.title}>{utskick.title}</Text>
          
          {/* Date */}
          <View style={styles.dateContainer}>
            <Feather name="clock" size={16} color="#6b7280" />
            <Text style={styles.date}>
              {formatDate(utskick.published_at || utskick.created_at)}
            </Text>
          </View>

          {/* Image */}
          {utskick.image_url && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: utskick.image_url }} 
                style={styles.image}
                contentFit="cover"
              />
            </View>
          )}

          {/* Content */}
          {utskick.content && (
            <View style={styles.contentSection}>
              <Text style={styles.content}>
                {stripHtml(utskick.content)}
              </Text>
            </View>
          )}

          {/* File Attachment */}
          {utskick.file_url && (
            <TouchableOpacity
              style={styles.attachment}
              onPress={handleFileDownload}
            >
              <View style={styles.attachmentIcon}>
                <Feather name="file-text" size={24} color="#2563eb" />
              </View>
              <View style={styles.attachmentInfo}>
                <Text style={styles.attachmentTitle}>
                  {utskick.file_name || 'Bifogad fil'}
                </Text>
                <Text style={styles.attachmentSubtitle}>Tryck för att öppna</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
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
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    marginHorizontal: 20,
    marginTop: 20,
    lineHeight: 34,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 6,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  imageContainer: {
    marginBottom: 24,
    marginHorizontal: 20,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  contentSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  content: {
    fontSize: 16,
    lineHeight: 26,
    color: '#374151',
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  attachmentSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});


