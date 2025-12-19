/**
 * Zero-Knowledge Storage Layer
 * 
 * This module handles persistent storage of encrypted data using Lovable Cloud.
 * Server only stores encrypted blobs - all plaintext operations happen client-side.
 * 
 * SECURITY: Data is encrypted before being sent to the server.
 * The server never sees plaintext data.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  generateSalt,
  bytesToBase64,
  base64ToBytes,
  createWorkspaceId,
  deriveKeyFromPassword,
  encryptString,
  decryptString,
  encryptFile,
  decryptFile,
} from './crypto';

// Types for our data structures
export interface EncryptedWorkspace {
  id: string; // Derived from password hash
  salt: string; // For key derivation
  metadata: {
    iv: string;
    ciphertext: string; // Encrypted workspace name
  };
  createdAt: number;
}

export interface EncryptedFolder {
  id: string;
  workspaceId: string;
  salt: string;
  metadata: {
    iv: string;
    ciphertext: string; // Encrypted folder name
  };
  createdAt: number;
}

export interface EncryptedFile {
  id: string;
  folderId: string;
  metadata: {
    iv: string;
    ciphertext: string; // Encrypted filename
  };
  content: {
    iv: string;
    ciphertext: string;
    wrappedKey: string;
    keyIv: string;
  };
  size: number;
  mimeType: string; // Can be stored unencrypted
  createdAt: number;
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  password: string,
  name: string
): Promise<{ workspace: EncryptedWorkspace; key: CryptoKey }> {
  // Generate workspace ID from password
  const id = await createWorkspaceId(password);
  
  // Generate salt for key derivation
  const salt = generateSalt();
  
  // Derive key from password
  const key = await deriveKeyFromPassword(password, salt);
  
  // Encrypt workspace name
  const metadata = await encryptString(name, key);
  
  const workspace: EncryptedWorkspace = {
    id,
    salt: bytesToBase64(salt),
    metadata,
    createdAt: Date.now(),
  };
  
  // Store workspace in database
  const { error } = await supabase
    .from('encrypted_workspaces')
    .insert({
      id: workspace.id,
      salt: workspace.salt,
      metadata_iv: workspace.metadata.iv,
      metadata_ciphertext: workspace.metadata.ciphertext,
      created_at: workspace.createdAt,
    });
  
  if (error) {
    throw new Error(`Failed to create workspace: ${error.message}`);
  }
  
  return { workspace, key };
}

/**
 * Unlock (access) an existing workspace
 */
export async function unlockWorkspace(
  password: string
): Promise<{ workspace: EncryptedWorkspace; key: CryptoKey; name: string } | null> {
  const id = await createWorkspaceId(password);
  
  const { data, error } = await supabase
    .from('encrypted_workspaces')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  const workspace: EncryptedWorkspace = {
    id: data.id,
    salt: data.salt,
    metadata: {
      iv: data.metadata_iv,
      ciphertext: data.metadata_ciphertext,
    },
    createdAt: data.created_at,
  };
  
  try {
    const salt = base64ToBytes(workspace.salt);
    const key = await deriveKeyFromPassword(password, salt);
    const name = await decryptString(
      workspace.metadata.ciphertext,
      key,
      workspace.metadata.iv
    );
    
    return { workspace, key, name };
  } catch {
    // Wrong password or corrupted data
    return null;
  }
}

/**
 * Check if a workspace exists for a given password
 */
export async function workspaceExists(password: string): Promise<boolean> {
  const id = await createWorkspaceId(password);
  
  const { data } = await supabase
    .from('encrypted_workspaces')
    .select('id')
    .eq('id', id)
    .single();
  
  return !!data;
}

/**
 * Create a new folder within a workspace
 */
export async function createFolder(
  workspaceId: string,
  folderPassword: string,
  folderName: string
): Promise<{ folder: EncryptedFolder; key: CryptoKey }> {
  const id = crypto.randomUUID();
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(folderPassword, salt);
  const metadata = await encryptString(folderName, key);
  
  const folder: EncryptedFolder = {
    id,
    workspaceId,
    salt: bytesToBase64(salt),
    metadata,
    createdAt: Date.now(),
  };
  
  const { error } = await supabase
    .from('encrypted_folders')
    .insert({
      id: folder.id,
      workspace_id: folder.workspaceId,
      salt: folder.salt,
      metadata_iv: folder.metadata.iv,
      metadata_ciphertext: folder.metadata.ciphertext,
      created_at: folder.createdAt,
    });
  
  if (error) {
    throw new Error(`Failed to create folder: ${error.message}`);
  }
  
  return { folder, key };
}

/**
 * Get all folders for a workspace (still encrypted)
 */
export async function getWorkspaceFolders(workspaceId: string): Promise<EncryptedFolder[]> {
  const { data, error } = await supabase
    .from('encrypted_folders')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  if (error || !data) {
    return [];
  }
  
  return data.map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    salt: row.salt,
    metadata: {
      iv: row.metadata_iv,
      ciphertext: row.metadata_ciphertext,
    },
    createdAt: row.created_at,
  }));
}

/**
 * Unlock a folder
 */
export async function unlockFolder(
  folderId: string,
  password: string
): Promise<{ folder: EncryptedFolder; key: CryptoKey; name: string } | null> {
  const { data, error } = await supabase
    .from('encrypted_folders')
    .select('*')
    .eq('id', folderId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  const folder: EncryptedFolder = {
    id: data.id,
    workspaceId: data.workspace_id,
    salt: data.salt,
    metadata: {
      iv: data.metadata_iv,
      ciphertext: data.metadata_ciphertext,
    },
    createdAt: data.created_at,
  };
  
  try {
    const salt = base64ToBytes(folder.salt);
    const key = await deriveKeyFromPassword(password, salt);
    const name = await decryptString(
      folder.metadata.ciphertext,
      key,
      folder.metadata.iv
    );
    
    return { folder, key, name };
  } catch {
    return null;
  }
}

/**
 * Delete a folder and all its files
 */
export async function deleteFolder(folderId: string): Promise<void> {
  // Delete folder (files will cascade delete due to FK)
  const { error } = await supabase
    .from('encrypted_folders')
    .delete()
    .eq('id', folderId);
  
  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`);
  }
}

/**
 * Upload and encrypt a file
 */
export async function uploadFile(
  folderId: string,
  folderKey: CryptoKey,
  file: File
): Promise<EncryptedFile> {
  const id = crypto.randomUUID();
  
  // Read file contents
  const fileData = await file.arrayBuffer();
  
  // Encrypt filename
  const metadata = await encryptString(file.name, folderKey);
  
  // Encrypt file contents
  const content = await encryptFile(fileData, folderKey);
  
  const encryptedFile: EncryptedFile = {
    id,
    folderId,
    metadata,
    content,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    createdAt: Date.now(),
  };
  
  const { error } = await supabase
    .from('encrypted_files')
    .insert({
      id: encryptedFile.id,
      folder_id: encryptedFile.folderId,
      metadata_iv: encryptedFile.metadata.iv,
      metadata_ciphertext: encryptedFile.metadata.ciphertext,
      content_iv: encryptedFile.content.iv,
      content_ciphertext: encryptedFile.content.ciphertext,
      content_wrapped_key: encryptedFile.content.wrappedKey,
      content_key_iv: encryptedFile.content.keyIv,
      size: encryptedFile.size,
      mime_type: encryptedFile.mimeType,
      created_at: encryptedFile.createdAt,
    });
  
  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  return encryptedFile;
}

/**
 * Get all files in a folder (still encrypted)
 */
export async function getFolderFiles(folderId: string): Promise<EncryptedFile[]> {
  const { data, error } = await supabase
    .from('encrypted_files')
    .select('*')
    .eq('folder_id', folderId);
  
  if (error || !data) {
    return [];
  }
  
  return data.map(row => ({
    id: row.id,
    folderId: row.folder_id,
    metadata: {
      iv: row.metadata_iv,
      ciphertext: row.metadata_ciphertext,
    },
    content: {
      iv: row.content_iv,
      ciphertext: row.content_ciphertext,
      wrappedKey: row.content_wrapped_key,
      keyIv: row.content_key_iv,
    },
    size: row.size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }));
}

/**
 * Decrypt and download a file
 */
export async function downloadFile(
  fileId: string,
  folderKey: CryptoKey
): Promise<{ data: ArrayBuffer; filename: string; mimeType: string } | null> {
  const { data, error } = await supabase
    .from('encrypted_files')
    .select('*')
    .eq('id', fileId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  const file: EncryptedFile = {
    id: data.id,
    folderId: data.folder_id,
    metadata: {
      iv: data.metadata_iv,
      ciphertext: data.metadata_ciphertext,
    },
    content: {
      iv: data.content_iv,
      ciphertext: data.content_ciphertext,
      wrappedKey: data.content_wrapped_key,
      keyIv: data.content_key_iv,
    },
    size: data.size,
    mimeType: data.mime_type,
    createdAt: data.created_at,
  };
  
  try {
    // Decrypt filename
    const filename = await decryptString(
      file.metadata.ciphertext,
      folderKey,
      file.metadata.iv
    );
    
    // Decrypt file contents
    const fileData = await decryptFile(
      file.content.ciphertext,
      file.content.iv,
      file.content.wrappedKey,
      file.content.keyIv,
      folderKey
    );
    
    return { data: fileData, filename, mimeType: file.mimeType };
  } catch {
    return null;
  }
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<void> {
  const { error } = await supabase
    .from('encrypted_files')
    .delete()
    .eq('id', fileId);
  
  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Decrypt file metadata only (for displaying file list)
 */
export async function decryptFileMetadata(
  file: EncryptedFile,
  folderKey: CryptoKey
): Promise<string> {
  return decryptString(
    file.metadata.ciphertext,
    folderKey,
    file.metadata.iv
  );
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  workspaces: number;
  folders: number;
  files: number;
  totalSize: number;
}> {
  const [workspacesResult, foldersResult, filesResult] = await Promise.all([
    supabase.from('encrypted_workspaces').select('id', { count: 'exact', head: true }),
    supabase.from('encrypted_folders').select('id', { count: 'exact', head: true }),
    supabase.from('encrypted_files').select('size'),
  ]);
  
  const totalSize = filesResult.data?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;
  
  return {
    workspaces: workspacesResult.count || 0,
    folders: foldersResult.count || 0,
    files: filesResult.data?.length || 0,
    totalSize,
  };
}
