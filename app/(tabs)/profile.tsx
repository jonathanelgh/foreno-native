import { Avatar } from '../../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const {
    user,
    userProfile,
    memberships,
    activeOrganization,
    signOut,
    switchOrganization,
  } = useAuth();
  
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const activeMembership = memberships.find(
    (m) => m.organization_id === activeOrganization?.id
  );
  const isAdminOrStyrelse =
    activeMembership?.role === 'admin' || activeMembership?.role === 'styrelse';

  // Sync push notifications toggle with DB value
  useEffect(() => {
    if (userProfile) {
      setPushNotifications(userProfile.push_notifications !== false);
    }
  }, [userProfile]);

  const handleSignOut = () => {
    Alert.alert(
      'Logga ut',
      'Är du säker på att du vill logga ut?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Logga ut',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert('Fel', 'Kunde inte logga ut');
            }
          },
        },
      ]
    );
  };

  const handleOrganizationSwitch = async (organizationId: string) => {
    if (organizationId === activeOrganization?.id) {
      setShowOrgModal(false);
      return;
    }

    setSwitching(true);
    try {
      await switchOrganization(organizationId);
      setShowOrgModal(false);
      Alert.alert('Framgång', 'Organisationen har bytts');
    } catch (error) {
      Alert.alert('Fel', 'Kunde inte byta organisation');
    } finally {
      setSwitching(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'Radera konto') return;

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) {
        console.error('Delete account error:', error);
        Alert.alert('Fel', 'Kunde inte radera kontot. Försök igen senare.');
        return;
      }

      setShowDeleteModal(false);
      await signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Delete account error:', err);
      Alert.alert('Fel', 'Ett oväntat fel uppstod.');
    } finally {
      setDeleting(false);
    }
  };

  const getUserDisplayName = () => {
    if (userProfile?.first_name || userProfile?.last_name) {
      return `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();
    }
    return user?.email || 'Användare';
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administratör';
      case 'styrelse':
        return 'Styrelsemedlem';
      case 'medlem':
        return 'Medlem';
      default:
        return role;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            <Avatar 
              url={userProfile?.profile_image_url} 
              size={80} 
              style={styles.profileImage}
              name={getUserDisplayName()}
              placeholderColor="#2563eb"
            />
        </View>
        
        <Text style={styles.userName}>{getUserDisplayName()}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.organizationCard}
          onPress={() => setShowOrgModal(true)}
          disabled={memberships.length <= 1}
        >
          <View>
            <Text style={styles.organizationName}>
              {activeOrganization?.name || 'Ingen organisation vald'}
            </Text>
            {activeOrganization && (
              <Text style={styles.organizationInfo}>
                {activeOrganization.type && `${activeOrganization.type} • `}
                {activeOrganization.city}
              </Text>
            )}
          </View>
          {memberships.length > 1 && (
            <Text style={styles.organizationChevron}>›</Text>
          )}
        </TouchableOpacity>

        {/* Menu Items */}
        <Text style={styles.menuTitle}>Meny</Text>
        <View style={styles.menuGrid}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/contacts')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="users" size={22} color="#2563eb" />
              <Text style={styles.menuItemText}>Kontakter</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/members')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="user" size={22} color="#2563eb" />
              <Text style={styles.menuItemText}>Medlemmar</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/events')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="calendar" size={22} color="#2563eb" />
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemText}>Kalender</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/bookings')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="calendar" size={22} color="#2563eb" />
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemText}>Bokning</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/marketplace')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="shopping-bag" size={22} color="#2563eb" />
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemText}>Köp & sälj</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/fees')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="credit-card" size={22} color="#2563eb" />
              <Text style={styles.menuItemText}>Betalningar</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/felanmalningar')}
          >
            <View style={styles.menuItemContainer}>
              <Feather name="alert-triangle" size={22} color="#2563eb" />
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemText}>Felanmälan</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inställningar</Text>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/my-details')}
        >
          <View style={styles.settingItemLeft}>
            <Feather name="edit-3" size={20} color="#1f2937" />
            <Text style={styles.settingItemText}>Mina uppgifter</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {isAdminOrStyrelse && (
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Linking.openURL('https://foreno.se/dashboard/settings')}
          >
            <View style={styles.settingItemLeft}>
              <Feather name="settings" size={20} color="#1f2937" />
              <Text style={styles.settingItemText}>Organisationsinställningar</Text>
            </View>
            <Feather name="external-link" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={async () => {
            if (!user?.email) return;
            try {
              await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: 'foreno://reset-password',
              });
              Alert.alert('Info', 'Ett e-postmeddelande för återställning av lösenord har skickats.');
            } catch (error) {
              Alert.alert('Fel', 'Kunde inte skicka återställningslänk.');
            }
          }}
        >
          <View style={styles.settingItemLeft}>
            <Feather name="lock" size={20} color="#1f2937" />
            <Text style={styles.settingItemText}>Byt lösenord</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/support')}
        >
          <View style={styles.settingItemLeft}>
            <Feather name="help-circle" size={20} color="#1f2937" />
            <Text style={styles.settingItemText}>Support</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <View style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <Feather name="bell" size={20} color="#1f2937" />
            <Text style={styles.settingItemText}>Pushnotiser</Text>
          </View>
          <Switch
            value={pushNotifications}
            onValueChange={async (value) => {
              setPushNotifications(value);
              if (user?.id) {
                const { error } = await supabase
                  .from('user_profiles')
                  .update({ push_notifications: value })
                  .eq('id', user.id);
                if (error) {
                  console.error('Error updating push notifications:', error);
                  setPushNotifications(!value); // revert on failure
                }
              }
            }}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={pushNotifications ? '#2563eb' : '#f3f4f6'}
          />
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Om Föreno</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.foreno.se/terms')}
        >
          <View style={styles.settingItemLeft}>
            <Feather name="file-text" size={20} color="#1f2937" />
            <Text style={styles.settingItemText}>Allmänna villkor</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.foreno.se/privacy')}
        >
          <View style={styles.settingItemLeft}>
            <Feather name="shield" size={20} color="#1f2937" />
            <Text style={styles.settingItemText}>Sekretess</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Logga ut</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() => {
            setDeleteConfirmText('');
            setShowDeleteModal(true);
          }}
        >
          <Text style={styles.deleteAccountButtonText}>Radera konto</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deletePopup}>
            <View style={styles.deleteHeader}>
              <Feather name="alert-triangle" size={24} color="#dc2626" />
              <Text style={styles.deleteTitle}>Radera konto</Text>
            </View>

            <Text style={styles.deleteMessage}>
              Detta kommer att permanent radera ditt konto och all tillhörande data. Denna åtgärd kan inte ångras.
            </Text>

            <Text style={styles.deleteInstructions}>
              Skriv <Text style={styles.deleteBold}>Radera konto</Text> nedan för att bekräfta:
            </Text>

            <TextInput
              style={styles.deleteInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Radera konto"
              placeholderTextColor="#d1d5db"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.deleteFooter}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteCancelText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmBtn,
                  (deleteConfirmText !== 'Radera konto' || deleting) && styles.deleteConfirmBtnDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== 'Radera konto' || deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Radera</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Organization Selection Modal */}
      <Modal
        visible={showOrgModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrgModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Aktiv förening</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowOrgModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Stäng</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
            {memberships.map((membership) => (
              <TouchableOpacity
                key={membership.id}
                style={[
                  styles.modalOption,
                  membership.organization_id === activeOrganization?.id &&
                    styles.modalOptionActive,
                ]}
                onPress={() => handleOrganizationSwitch(membership.organization_id!)}
                disabled={switching}
              >
                <View style={styles.modalOptionContent}>
                  <Text style={[
                    styles.modalOptionText,
                    membership.organization_id === activeOrganization?.id &&
                      styles.modalOptionTextActive,
                  ]}>
                    {membership.organization.name}
                  </Text>
                  <Text style={styles.modalOptionSubtext}>
                    {getRoleDisplayName(membership.role)}
                  </Text>
                </View>
                {membership.organization_id === activeOrganization?.id && (
                  <Text style={styles.modalOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            {switching && (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#2563eb" />
                <Text style={styles.modalLoadingText}>Byter organisation...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748b',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  organizationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  organizationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  organizationInfo: {
    fontSize: 14,
    color: '#64748b',
  },
  organizationChevron: {
    fontSize: 20,
    color: '#9ca3af',
  },
  organizationSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 24,
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  menuItem: {
    width: '50%',
    padding: 6,
    marginBottom: 12,
  },
  menuItemContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  menuItemComingSoon: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 12,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 12,
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  signOutButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  deleteAccountButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deletePopup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
  },
  deleteMessage: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  deleteInstructions: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
  },
  deleteBold: {
    fontWeight: '700',
    color: '#1f2937',
  },
  deleteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    marginBottom: 20,
  },
  deleteFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  deleteConfirmBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  modalCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalOptionActive: {
    backgroundColor: '#dbeafe',
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  modalOptionTextActive: {
    color: '#2563eb',
  },
  modalOptionSubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  modalOptionCheck: {
    fontSize: 18,
    color: '#2563eb',
    fontWeight: 'bold',
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalLoadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#64748b',
  },
});
