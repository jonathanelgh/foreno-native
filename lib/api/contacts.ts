import { Contact } from '../../types/database';
import { supabase } from '../supabase';

export async function getOrganizationContacts(organizationId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }

  return data || [];
}

export async function createContact(contact: {
  organization_id: string;
  name: string;
  email?: string;
  phone?: string;
  description?: string;
  contact_type: 'user' | 'external';
  user_id?: string;
  display_order?: number;
}): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .insert([contact])
    .select()
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    throw error;
  }

  return data;
}

export async function updateContact(
  contactId: string,
  updates: Partial<{
    name: string;
    email: string;
    phone: string;
    description: string;
    display_order: number;
    is_active: boolean;
  }>
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', contactId)
    .select()
    .single();

  if (error) {
    console.error('Error updating contact:', error);
    throw error;
  }

  return data;
}

export async function deleteContact(contactId: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ is_active: false })
    .eq('id', contactId);

  if (error) {
    console.error('Error deleting contact:', error);
    throw error;
  }
} 