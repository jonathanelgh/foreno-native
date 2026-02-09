import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { CreateUtskickSheet } from '../components/CreateUtskickSheet';
import { UtskickCard } from '../components/UtskickCard';
import { UtskickDetailModal } from '../components/UtskickDetailModal';
import { useAuth } from '../contexts/AuthContext';
import { getUtskickFeed } from '../lib/api/utskick';

export default function InformationScreen() {
  const router = useRouter();
  const { activeOrganization, isAdmin, isStyrelse } = useAuth();
  const [utskick, setUtskick] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedUtskick, setSelectedUtskick] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadUtskick = useCallback(async (refresh = false) => {
    if (!activeOrganization) return;

    try {
      const offset = refresh ? 0 : utskick.length;
      const newData = await getUtskickFeed(activeOrganization.id, 20, offset);

      if (refresh) {
        setUtskick(newData);
      } else {
        setUtskick((prev) => [...prev, ...newData]);
      }

      setHasMore(newData.length === 20);
    } catch (error) {
      console.error('Error loading utskick:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOrganization, utskick.length]);

  useEffect(() => {
    if (activeOrganization) {
      setUtskick([]);
      setLoading(true);
      loadUtskick(true);
    }
  }, [activeOrganization]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUtskick(true);
  }, [loadUtskick]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      loadUtskick(false);
    }
  }, [hasMore, loading, refreshing, loadUtskick]);

  const handleUtskickPress = (utskick: any) => {
    setSelectedUtskick(utskick);
    setShowDetailModal(true);
  };

  const renderUtskickItem = ({ item }: { item: any }) => (
    <UtskickCard utskick={item} onPress={() => handleUtskickPress(item)} />
  );

  const handleCreateUtskick = () => {
    setShowCreateSheet(true);
  };

  const renderContent = () => {
    if (loading && utskick.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Laddar information...</Text>
        </View>
      );
    }

    if (!activeOrganization) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Ingen organisation vald</Text>
          <Text style={styles.stateDescription}>
            Välj en organisation för att se aktuell information.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={utskick}
        renderItem={renderUtskickItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>Ingen information att visa</Text>
            <Text style={styles.stateDescription}>
              Dra nedåt för att uppdatera.
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore && utskick.length > 0 ? (
            <ActivityIndicator style={styles.footer} color="#2563eb" />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Information',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingHorizontal: 8, paddingVertical: 4, marginLeft: -8, justifyContent: 'center', alignItems: 'center' }}
            >
              <Feather name="chevron-left" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
          headerRight: (isAdmin || isStyrelse) ? () => (
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateUtskick}
            >
              <Text style={styles.createButtonText}>+ Nytt</Text>
            </TouchableOpacity>
          ) : undefined,
        }}
      />

      <View style={styles.content}>{renderContent()}</View>

      <CreateUtskickSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSuccess={() => {
          loadUtskick(true);
        }}
      />

      <UtskickDetailModal
        visible={showDetailModal}
        utskick={selectedUtskick}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedUtskick(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  createButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  listContainer: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
  },
});
