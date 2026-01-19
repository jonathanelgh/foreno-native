import { Database } from '../../types/database';
import { supabase } from "../supabase";

type Utskick = Database['public']['Tables']['utskick']['Row'];
type UtskickInsert = Database['public']['Tables']['utskick']['Insert'];

export const getUtskickFeed = async (
  organizationId: string,
  limit: number = 20,
  offset: number = 0
): Promise<any[]> => {
  const { data, error } = await supabase
    .from("utskick")
    .select(`
      *,
      polls (
        id,
        question,
        options,
        expires_at
      )
    `)
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
};

export const getRecentUtskick = async (
  organizationId: string
): Promise<any[]> => {
  return getUtskickFeed(organizationId, 5, 0);
};

export async function createUtskick(utskick: Omit<UtskickInsert, 'id' | 'created_at' | 'updated_at'>): Promise<Utskick> {
  const { data, error } = await supabase
    .from('utskick')
    .insert({
      ...utskick,
      published_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating utskick:', error);
    throw new Error('Kunde inte skapa utskick');
  }

  return data;
} 