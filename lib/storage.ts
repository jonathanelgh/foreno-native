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

/** Bucket for chat message images (same as utskick images; paths use direct/ or org/ prefix). */
export const MESSAGE_IMAGES_BUCKET = 'utskick-images';

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

export interface MessageImageUploadResult {
  bucket: string;
  path: string;
  fileName: string;
}

export async function uploadMessageImage(
  uri: string,
  fileName: string,
  conversationType: 'direct' | 'organization'
): Promise<MessageImageUploadResult> {
  try {
    const { data: fileBytes, mimeType } = await uriToUint8Array(uri);
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9.-]/g, '_');
    const prefix = conversationType === 'direct' ? 'direct' : 'org';
    const filePath = `${prefix}/${timestamp}_${safeFileName}`;

    const { data, error } = await supabase.storage
      .from(MESSAGE_IMAGES_BUCKET)
      .upload(filePath, fileBytes, {
        contentType: mimeType || 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Message image upload error:', error);
      throw new Error('Kunde inte ladda upp bild');
    }

    return {
      bucket: MESSAGE_IMAGES_BUCKET,
      path: data.path,
      fileName: safeFileName,
    };
  } catch (error) {
    console.error('Error uploading message image:', error);
    throw error;
  }
}

export async function getMessageImageUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) {
    console.error('Error creating message image URL:', error);
    throw error;
  }
  return data.signedUrl;
}

export async function getInvoiceUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) {
    console.error('Error creating invoice URL:', error);
    throw error;
  }
  return data.signedUrl;
}

export async function downloadFile(url: string, fileName: string, mimeType: string = 'application/pdf'): Promise<void> {
  try {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileUri = FileSystem.cacheDirectory + sanitizedFileName;
    
    const downloadResult = await FileSystem.downloadAsync(url, fileUri);
    
    // Try to share/open
    let Sharing: any = null;
    try {
      Sharing = require('expo-sharing');
    } catch (e) {}

    if (Sharing && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: mimeType,
        dialogTitle: 'Spara fil',
      });
    } else {
      // Fallback
      throw new Error('Sharing not available');
    }
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

export async function uploadDocument(
  uri: string,
  bucket: 'documents' | 'meeting-files',
  fileName: string,
  organizationId: string,
  providedMimeType?: string
): Promise<UploadResult> {
  try {
    const { data: fileBytes, mimeType: detectedMimeType } = await uriToUint8Array(uri);

    // Use provided mime type, or detected, or detect from filename
    const mimeType = providedMimeType || detectedMimeType || getMimeTypeFromFileName(fileName);

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${organizationId}/${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBytes, {
        contentType: mimeType,
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

export function getMimeTypeFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Other
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv',
  };
  
  return mimeTypes[extension] || 'application/pdf'; // Default to PDF if unknown
} 