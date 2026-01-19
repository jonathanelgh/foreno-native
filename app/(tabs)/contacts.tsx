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
import { CreateContactSheet } from '../../components/CreateContactSheet';
import { useAuth } from '../../contexts/AuthContext';
import { getOrganizationContacts } from '../../lib/api/contacts';
import { Contact } from '../../types/database';

export default function ContactsScreen() {
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

  const getContactDisplayName = (contact: Contact) => {
    return contact.name;
  };

  const getContactEmail = (contact: Contact) => {
    return contact.email;
  };

  const getContactPhone = (contact: Contact) => {
    return contact.phone;
  };

  const renderContactItem = ({ item }: { item: Contact }) => {
    const displayName = getContactDisplayName(item);
    const email = getContactEmail(item);
    const phone = getContactPhone(item);

    return (
      <View style={styles.contactItem}>
        <View style={styles.contactHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#6b7280" />
            </View>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{displayName}</Text>
            {item.description && (
              <Text style={styles.contactDescription}>{item.description}</Text>
            )}
          </View>
        </View>

        {(email || phone) && (
          <View style={styles.contactActions}>
            {email && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEmail(email)}
              >
                <Ionicons name="mail" size={20} color="#3b82f6" />
                <Text style={styles.actionText}>{email}</Text>
              </TouchableOpacity>
            )}
            {phone && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCall(phone)}
              >
                <Ionicons name="call" size={20} color="#10b981" />
                <Text style={styles.actionText}>{phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

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
          <Ionicons name="business-outline" size={56} color="#9ca3af" />
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
          <Ionicons name="people-outline" size={56} color="#9ca3af" />
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Kontakter</Text>
          {activeOrganization && (
            <Text style={styles.headerSubtitle}>{activeOrganization.name}</Text>
          )}
        </View>
        {activeOrganization && isAdmin && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateContact}
          >
            <Text style={styles.createButtonText}>+ Ny</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <CreateContactSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSuccess={() => {
          loadContacts();
        }}
      />
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
  createButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    marginRight: 12,
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
    marginLeft: 8,
  },
}); 