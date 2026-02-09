import { supabase } from '../supabase';
import type { Felanmalning, FelanmalningStatus } from '../../types/database';

// ── Types ──

export type FelanmalningWithCreator = Felanmalning & {
  creator?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
};

// ── Queries ──

/**
 * Get all felanmälningar for an organization.
 * Admins see all; members see only their own (filtered in the component
 * since RLS may handle it, but we filter client-side for safety).
 */
export async function getFelanmalningar(
  organizationId: string
): Promise<FelanmalningWithCreator[]> {
  const { data, error } = await supabase
    .from('felanmalningar')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching felanmälningar:', error);
    throw error;
  }

  const reports = (data || []) as Felanmalning[];

  // Fetch creator profiles
  const creatorIds = [...new Set(reports.map((r) => r.created_by))];
  if (creatorIds.length === 0) return reports.map((r) => ({ ...r, creator: null }));

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, phone_number')
    .in('id', creatorIds);

  // Also get emails from auth (user_profiles might not have email)
  // We'll use the creator_id to look up emails via a profiles join
  // For simplicity, store what we have from user_profiles
  const profileMap = new Map(
    (profiles || []).map((p) => [
      p.id,
      {
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        email: null as string | null,
        phone_number: p.phone_number ?? null,
      },
    ])
  );

  return reports.map((r) => ({
    ...r,
    creator: profileMap.get(r.created_by) ?? null,
  }));
}

// ── Mutations ──

export async function createFelanmalning(
  organizationId: string,
  subject: string,
  text: string,
  createdBy: string
): Promise<Felanmalning> {
  const { data, error } = await supabase
    .from('felanmalningar')
    .insert({
      organization_id: organizationId,
      subject: subject.trim(),
      text: text.trim(),
      status: 'received',
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating felanmälan:', error);
    throw error;
  }

  // Fire-and-forget notification
  try {
    await supabase.functions.invoke('send-felanmalning-notification', {
      body: { felanmalning_id: data.id },
    });
  } catch {
    // Silently ignore notification failures
  }

  return data as Felanmalning;
}

export async function updateFelanmalningStatus(
  id: string,
  status: FelanmalningStatus
): Promise<void> {
  const { error } = await supabase
    .from('felanmalningar')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error updating felanmälan status:', error);
    throw error;
  }
}

export async function deleteFelanmalning(id: string): Promise<void> {
  const { error } = await supabase
    .from('felanmalningar')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting felanmälan:', error);
    throw error;
  }
}
