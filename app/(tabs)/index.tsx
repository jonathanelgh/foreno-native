import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { getUtskickFeed } from '@/lib/api/utskick';
import { getUserNote, saveUserNote } from '@/lib/api/notes';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { activeOrganization, user } = useAuth();
  const [latestUtskick, setLatestUtskick] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeOrganization) {
      loadLatestUtskick();
    }
  }, [activeOrganization]);

  useEffect(() => {
    if (user) {
      loadNote();
    }
  }, [user]);

  const loadLatestUtskick = async () => {
    try {
      setLoading(true);
      const data = await getUtskickFeed(activeOrganization!.id, 1, 0);
      if (data && data.length > 0) {
        setLatestUtskick(data[0]);
      }
    } catch (error) {
      console.error('Error loading latest utskick:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNote = async () => {
    if (!user) return;
    try {
      const userNote = await getUserNote(user.id);
      if (userNote) {
        setNote(userNote.content);
      }
    } catch (error) {
      console.error('Error loading note:', error);
    }
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSavingNote(true);
    saveTimeoutRef.current = setTimeout(async () => {
      if (user) {
        await saveUserNote(user.id, text);
        setSavingNote(false);
      }
    }, 1000);
  };

  const handleNewsPress = () => {
    router.push('/(tabs)/news');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
      'jul', 'aug', 'sep', 'okt', 'nov', 'dec'
    ];
    return `${date.getDate()} ${monthNames[date.getMonth()]}. ${date.getFullYear()}`;
  };

  const getAuthorName = (utskick: any) => {
    if (utskick.author) {
      return `${utskick.author.first_name} ${utskick.author.last_name}`;
    }
    return 'Okänd avsändare';
  };

  const stripHtml = (html: string) => {
    return html?.replace(/<[^>]*>/g, '') || '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Latest Information Card */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Senaste information</Text>
            <TouchableOpacity onPress={handleNewsPress} style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Visa alla</Text>
              <Feather name="arrow-right" size={16} color="#2563eb" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 20 }} />
          ) : latestUtskick ? (
            <TouchableOpacity 
              style={styles.newsItemBox}
              onPress={() => router.push({
                pathname: '/(tabs)/news',
                params: { highlightId: latestUtskick.id }
              })}
              activeOpacity={0.7}
            >
              <Text style={styles.newsTitle} numberOfLines={2}>{latestUtskick.title}</Text>
              <Text style={styles.newsContent} numberOfLines={3}>
                {stripHtml(latestUtskick.content)}
              </Text>
              <View style={styles.newsFooter}>
                <Text style={styles.newsMeta}>{getAuthorName(latestUtskick)}</Text>
                <Text style={styles.newsMeta}>{formatDate(latestUtskick.published_at)}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.newsItemBox}>
              <Text style={styles.newsContent}>Ingen information tillgänglig just nu.</Text>
            </View>
          )}
        </View>

        {/* Notepad Card */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="file-text" size={20} color="#2563eb" />
              <Text style={styles.cardTitle}>Anteckningsblock</Text>
            </View>
            {savingNote && <ActivityIndicator size="small" color="#9ca3af" />}
          </View>
          
          <View style={styles.notepadBox}>
            <TextInput
              style={styles.notepadInput}
              multiline
              placeholder="Skriv dina anteckningar här..."
              value={note}
              onChangeText={handleNoteChange}
              textAlignVertical="top"
            />
          </View>
          <Text style={styles.notepadFooter}>
            Anteckningarna sparas automatiskt och är endast synliga för dig.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingTop: 24,
    gap: 16,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  newsItemBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  newsContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newsMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },
  notepadBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 200,
    overflow: 'hidden',
  },
  notepadInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
    textAlignVertical: 'top',
  },
  notepadFooter: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
  },
});
