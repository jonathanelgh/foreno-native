import { Document } from '../../types/database';
import { supabase } from '../supabase';

export async function getOrganizationDocuments(organizationId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', organizationId)
    .is('event_id', null) // Only get organization-level documents, not meeting-specific ones
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }

  return data || [];
}

export async function getDocumentUrl(filePath: string): Promise<string> {
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

