import { Document } from '../../types/database';
import { supabase } from '../supabase';

export type Folder = {
  id: string;
  name: string;
  description: string | null;
  parent_folder_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

export async function getOrganizationFolders(organizationId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching folders:', error);
    throw error;
  }

  return data || [];
}

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
  // Use signed URL for RLS-protected buckets
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }

  return data.signedUrl;
}

export async function createFolder(
  organizationId: string,
  name: string,
  parentFolderId: string | null,
  userId: string
): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      organization_id: organizationId,
      name,
      parent_folder_id: parentFolderId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    throw error;
  }

  return data;
}

export async function createDocument(
  organizationId: string,
  filePath: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  folderId: string | null,
  userId: string,
  title?: string
): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      organization_id: organizationId,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      folder_id: folderId,
      uploaded_by: userId,
      title: title || fileName,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating document:', error);
    throw error;
  }

  return data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
}

export async function moveDocument(documentId: string, newFolderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ folder_id: newFolderId })
    .eq('id', documentId);

  if (error) {
    console.error('Error moving document:', error);
    throw error;
  }
}

export async function moveFolder(folderId: string, newParentFolderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ parent_folder_id: newParentFolderId })
    .eq('id', folderId);

  if (error) {
    console.error('Error moving folder:', error);
    throw error;
  }
}

