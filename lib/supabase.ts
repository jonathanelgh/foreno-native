import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://krhzxvquzbhhkogxldat.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaHp4dnF1emJoaGtvZ3hsZGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4OTM3NjQsImV4cCI6MjA2NTQ2OTc2NH0.Yb4G7jrTBcg9UcDiNIUOsXWK96V9H3dfSyeic60oCw4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}); 