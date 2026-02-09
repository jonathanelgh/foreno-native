import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MembershipWithOrganization, Organization, UserProfile } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  memberships: MembershipWithOrganization[];
  activeOrganization: Organization | null;
  loading: boolean;
  isAdmin: boolean;
  isStyrelse: boolean;
  isMedlem: boolean;
  userRole: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<MembershipWithOrganization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          setUserProfile(null);
          setMemberships([]);
          setActiveOrganization(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      // Load user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setUserProfile(profile);

      // Load memberships with organization data
      const { data: membershipData } = await supabase
        .from('memberships')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      const membershipsWithOrg = membershipData?.map(membership => ({
        ...membership,
        organization: membership.organization as Organization
      })) || [];

      setMemberships(membershipsWithOrg);

      // Load user preferences to get active organization
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('id', userId)
        .single();

      // Set active organization
      if (preferences?.active_organization_id) {
        const activeOrg = membershipsWithOrg.find(
          m => m.organization_id === preferences.active_organization_id
        )?.organization;
        if (activeOrg) {
          setActiveOrganization(activeOrg);
        } else if (membershipsWithOrg.length > 0) {
          // Fallback to first organization if preference is invalid
          setActiveOrganization(membershipsWithOrg[0].organization);
        }
      } else if (membershipsWithOrg.length > 0) {
        // Set first organization as active if no preference
        setActiveOrganization(membershipsWithOrg[0].organization);
        // Save this preference
        await supabase
          .from('user_preferences')
          .upsert({
            id: userId,
            active_organization_id: membershipsWithOrg[0].organization_id,
          });
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Build the edge function redirect URL with our app's deep link info
      const appUrl = Linking.createURL('auth-callback');
      console.log('App deep link URL:', appUrl);

      // Parse the app URL to extract scheme and host for the edge function
      let redirectScheme = 'exp';
      let redirectHost = '';
      try {
        // exp://192.168.1.100:8081/--/auth-callback
        if (appUrl.startsWith('forenonative://')) {
          redirectScheme = 'forenonative';
        } else if (appUrl.startsWith('exp://')) {
          const afterScheme = appUrl.replace('exp://', '');
          const hostEnd = afterScheme.indexOf('/');
          redirectHost = hostEnd >= 0 ? afterScheme.substring(0, hostEnd) : afterScheme;
        }
      } catch {}

      // Use the HTTPS edge function as the OAuth redirect target
      // Supabase will accept this since it's a proper HTTPS URL
      const edgeFunctionRedirect = `https://krhzxvquzbhhkogxldat.supabase.co/functions/v1/auth-redirect?redirect_scheme=${redirectScheme}&redirect_host=${encodeURIComponent(redirectHost)}`;

      console.log('OAuth redirect URI:', edgeFunctionRedirect);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: edgeFunctionRedirect,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Ingen inloggningslänk mottogs från Supabase');

      // Open in system browser (Safari).
      // Flow: Google auth → Supabase callback → Edge function (HTTPS) → App deep link
      await Linking.openURL(data.url);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };


  const signOut = async () => {
    try {
      // Clear push token from user profile so they stop receiving notifications
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          await supabase
            .from('user_profiles')
            .update({ expo_push_token: null })
            .eq('id', currentUser.id);
        }
      } catch (tokenError) {
        console.error('Error clearing push token:', tokenError);
        // Continue with sign out even if this fails
      }

      // Clear specific keys instead of all AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(key => 
        key.includes('supabase') || 
        key.includes('auth') ||
        key.includes('session')
      );
      
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        // Even if Supabase signOut fails, we've cleared local storage
        // so the user will be logged out locally
      }
    } catch (error) {
      console.error('Error during sign out:', error);
      // Don't throw - we want to log out locally even if there's an error
    }
  };

  const switchOrganization = async (organizationId: string) => {
    if (!user) return;

    const newActiveOrg = memberships.find(
      m => m.organization_id === organizationId
    )?.organization;

    if (newActiveOrg) {
      setActiveOrganization(newActiveOrg);

      // Save preference
      await supabase
        .from('user_preferences')
        .upsert({
          id: user.id,
          active_organization_id: organizationId,
        });
    }
  };

  const refreshMemberships = async () => {
    if (!user) return;
    await loadUserData(user.id);
  };

  const refreshUserProfile = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profile) setUserProfile(profile);
  };

  // Get current user's role for the active organization
  const currentMembership = memberships.find(
    m => m.organization_id === activeOrganization?.id
  );
  
  const userRole = currentMembership?.role || null;
  const isAdmin = userRole === 'admin';
  const isStyrelse = userRole === 'styrelse';
  const isMedlem = userRole === 'medlem';

  const value: AuthContextType = {
    session,
    user,
    userProfile,
    memberships,
    activeOrganization,
    loading,
    isAdmin,
    isStyrelse,
    isMedlem,
    userRole,
    signIn,
    signInWithGoogle,
    signOut,
    switchOrganization,
    refreshMemberships,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 