import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
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
import { Colors } from '../constants/Colors';
import { CreateContactSheet } from '../components/CreateContactSheet';
import { useAuth } from '../contexts/AuthContext';
import { getOrganizationContacts } from '../lib/api/contacts';
import { Contact } from '../types/database';

export default function ContactsScreen() {
  const router = useRouter();
  const { activeOrganization, loading: authLoading, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!activeOrganization) {
      setLoading(false);
      return;
    }
    
    try {
      const contactsData = await getOrganizationContacts(activeOrganization.id);
      setContacts(contactsData);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Fel', 'Kunde inte ladda kontakter');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    if (!authLoading) {
      loadContacts();
    }
  }, [authLoading, loadContacts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const handleCall = (phone: string) => {
    const phoneUrl = `tel:${phone}`;
    Linking.canOpenURL(phoneUrl).then((supported) => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Fel', 'Kan inte öppna telefon-appen');
      }
    });
  };

  const handleEmail = (email: string) => {
    const emailUrl = `mailto:${email}`;
    Linking.canOpenURL(emailUrl).then((supported) => {
      if (supported) {
        Linking.openURL(emailUrl);
      } else {
        Alert.alert('Fel', 'Kan inte öppna e-post-appen');
      }
    });
  };

  const handleCreateContact = () => {
    setShowCreateSheet(true);
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactHeader}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={20} color="#6b7280" />
          </View>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.contactDescription}>{item.description}</Text>
          )}
        </View>
      </View>

      {(item.email || item.phone) && (
        <View style={styles.contactActions}>
          {item.email && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEmail(item.email!)}
            >
              <Feather name="mail" size={18} color="#3b82f6" />
              <Text style={styles.actionText}>{item.email}</Text>
            </TouchableOpacity>
          )}
          {item.phone && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCall(item.phone!)}
            >
              <Feather name="phone" size={18} color="#10b981" />
              <Text style={styles.actionText}>{item.phone}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (authLoading || loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Laddar kontakter...</Text>
        </View>
      );
    }

    if (!activeOrganization) {
      return (
        <View style={styles.stateContainer}>
          <Feather name="briefcase" size={56} color="#9ca3af" />
          <Text style={styles.stateTitle}>Ingen organisation vald</Text>
          <Text style={styles.stateDescription}>
            Du måste vara medlem i en organisation för att se kontakter.
          </Text>
        </View>
      );
    }

    if (contacts.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Feather name="users" size={56} color="#9ca3af" />
          <Text style={styles.stateTitle}>Inga kontakter</Text>
          <Text style={styles.stateDescription}>
            Det finns inga kontakter registrerade för denna organisation än.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={contacts}
        renderItem={renderContactItem}
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
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Kontakter',
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
          headerRight: () =>
            activeOrganization && isAdmin ? (
              <TouchableOpacity onPress={handleCreateContact} style={{ padding: 8 }}>
                <Feather name="plus" size={24} color={Colors.light.tint} />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <View style={styles.content}>{renderContent()}</View>

      <CreateContactSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSuccess={() => {
          loadContacts();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stateDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  contactItem: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
    lineHeight: 20,
  },
  contactActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
});
