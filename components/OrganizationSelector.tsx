import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface OrganizationSelectorProps {
  textColor?: string;
  iconColor?: string;
}

export function OrganizationSelector({ textColor = '#1f2937', iconColor = '#6b7280' }: OrganizationSelectorProps) {
  const { activeOrganization, memberships, switchOrganization } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  if (!activeOrganization || memberships.length <= 1) {
    return null;
  }

  const handleOrganizationSelect = async (organizationId: string) => {
    setModalVisible(false);
    await switchOrganization(organizationId);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="business" size={16} color="#2563eb" />
        </View>
        <Text style={[styles.organizationName, { color: textColor }]} numberOfLines={1}>
          {activeOrganization.name}
        </Text>
        <Ionicons name="chevron-down" size={16} color={iconColor} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Välj organisation</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {memberships.map((membership) => (
              <TouchableOpacity
                key={membership.organization_id}
                style={[
                  styles.organizationItem,
                  activeOrganization.id === membership.organization_id && styles.activeOrganizationItem
                ]}
                onPress={() => handleOrganizationSelect(membership.organization_id || '')}
              >
                <View style={styles.organizationInfo}>
                  <Text style={[
                    styles.organizationItemName,
                    activeOrganization.id === membership.organization_id && styles.activeOrganizationText
                  ]}>
                    {membership.organization.name}
                  </Text>
                  <Text style={styles.organizationRole}>
                    {membership.role === 'admin' ? 'Administratör' : 'Medlem'}
                    {membership.board_title && ` • ${membership.board_title}`}
                  </Text>
                </View>
                {activeOrganization.id === membership.organization_id && (
                  <Ionicons name="checkmark" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  organizationName: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
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
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  organizationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  activeOrganizationItem: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  organizationInfo: {
    flex: 1,
  },
  organizationItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  activeOrganizationText: {
    color: '#059669',
  },
  organizationRole: {
    fontSize: 14,
    color: '#6b7280',
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
}); 