import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

export interface UploadResult {
  url: string;
  path: string;
}

async function uriToUint8Array(uri: string): Promise<{ data: Uint8Array; mimeType: string | undefined }> {
  const base64Data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binary = atob(base64Data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const mimeType = FileSystem.mimeTypeFromFilename?.(uri);

  return { data: bytes, mimeType };
}

export async function uploadImage(
  uri: string,
  bucket: 'utskick-images' | 'organization_logos',
  fileName: string
): Promise<UploadResult> {
  try {
    const { data: fileBytes, mimeType } = await uriToUint8Array(uri);

    // Create unique file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBytes, {
        contentType: mimeType || 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error('Kunde inte ladda upp bild');
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

export async function uploadDocument(
  uri: string,
  bucket: 'documents' | 'meeting-files',
  fileName: string,
  organizationId: string
): Promise<UploadResult> {
  try {
    const { data: fileBytes, mimeType } = await uriToUint8Array(uri);

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${organizationId}/${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBytes, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error('Kunde inte ladda upp fil');
    }

    return {
      url: data.path,
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}

export function getFileSize(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isDocumentFile(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  return allowedTypes.includes(mimeType);
} 