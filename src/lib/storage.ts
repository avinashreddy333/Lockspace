/**
 * Zero-Knowledge Storage Layer
 * FULL VERSION — Workspace + Folder + File support
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

/* ========================= TYPES ========================= */

export interface EncryptedWorkspace {
  id: string;
  salt: string;
  metadata: { iv: string; ciphertext: string };
  createdAt: number;
}

export interface EncryptedFolder {
  id: string;
  workspaceId: string;
  salt: string;
  metadata: { iv: string; ciphertext: string };
  createdAt: number;
}

export interface EncryptedFile {
  id: string;
  folderId: string;
  metadata: { iv: string; ciphertext: string };
  content: {
    iv: string;
    ciphertext: string;
    wrappedKey: string;
    keyIv: string;
  };
  size: number;
  mimeType: string;
  createdAt: number;
}

/* ========================= WORKSPACE ========================= */

export async function createWorkspace(password: string, name: string) {
  const id = await createWorkspaceId(password);
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  const metadata = await encryptString(name, key);

  const workspace: EncryptedWorkspace = {
    id,
    salt: bytesToBase64(salt),
    metadata,
    createdAt: Date.now(),
  };

  await supabase.from('encrypted_workspaces').insert({
    id,
    salt: workspace.salt,
    metadata_iv: metadata.iv,
    metadata_ciphertext: metadata.ciphertext,
    created_at: workspace.createdAt,
  });

  return { workspace, key };
}

export async function unlockWorkspace(password: string) {
  const id = await createWorkspaceId(password);

  const { data } = await supabase
    .from('encrypted_workspaces')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) return null;

  const salt = base64ToBytes(data.salt);
  const key = await deriveKeyFromPassword(password, salt);
  const name = await decryptString(data.metadata_ciphertext, key, data.metadata_iv);

  return {
    workspace: {
      id: data.id,
      salt: data.salt,
      metadata: {
        iv: data.metadata_iv,
        ciphertext: data.metadata_ciphertext,
      },
      createdAt: data.created_at,
    },
    key,
    name,
  };
}

export async function workspaceExists(password: string) {
  const id = await createWorkspaceId(password);

  const { data } = await supabase
    .from('encrypted_workspaces')
    .select('id')
    .eq('id', id)
    .single();

  return !!data;
}

/* ========================= FOLDERS ========================= */

export async function createFolder(workspaceId: string, password: string, name: string) {
  const id = crypto.randomUUID();
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  const metadata = await encryptString(name, key);

  await supabase.from('encrypted_folders').insert({
    id,
    workspace_id: workspaceId,
    salt: bytesToBase64(salt),
    metadata_iv: metadata.iv,
    metadata_ciphertext: metadata.ciphertext,
    created_at: Date.now(),
  });

  return {
    folder: {
      id,
      workspaceId,
      salt: bytesToBase64(salt),
      metadata,
      createdAt: Date.now(),
    },
    key,
  };
}

export async function getWorkspaceFolders(workspaceId: string): Promise<EncryptedFolder[]> {
  const { data, error } = await supabase
    .from('encrypted_folders')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error || !data) return [];

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

export async function unlockFolder(folderId: string, password: string) {
  const { data, error } = await supabase
    .from('encrypted_folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (error || !data) return null;

  const salt = base64ToBytes(data.salt);
  const key = await deriveKeyFromPassword(password, salt);

  const name = await decryptString(
    data.metadata_ciphertext,
    key,
    data.metadata_iv
  );

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

  return { folder, key, name };
}

export async function deleteFolder(folderId: string) {
  await supabase.from('encrypted_folders').delete().eq('id', folderId);
}

/* ========================= FILES ========================= */

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function uploadFile(folderId: string, folderKey: CryptoKey, file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large");
  }

  const id = crypto.randomUUID();
  const fileData = await file.arrayBuffer();
  const metadata = await encryptString(file.name, folderKey);
  const content = await encryptFile(fileData, folderKey);

  await supabase.from('encrypted_files').insert({
    id,
    folder_id: folderId,
    metadata_iv: metadata.iv,
    metadata_ciphertext: metadata.ciphertext,
    content_iv: content.iv,
    content_ciphertext: content.ciphertext,
    content_wrapped_key: content.wrappedKey,
    content_key_iv: content.keyIv,
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
    created_at: Date.now(),
  });

  return {
    id,
    folderId,
    metadata,
    content,
    size: file.size,
    mimeType: file.type,
    createdAt: Date.now(),
  };
}

export async function getFolderFiles(folderId: string): Promise<EncryptedFile[]> {
  const { data, error } = await supabase
    .from('encrypted_files')
    .select('*')
    .eq('folder_id', folderId);

  if (error || !data) return [];

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
export async function downloadFile(fileId: string, folderKey: CryptoKey) {
  const { data } = await supabase
    .from('encrypted_files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (!data) return null;

  const filename = await decryptString(
    data.metadata_ciphertext,
    folderKey,
    data.metadata_iv
  );

  const decryptedData = await decryptFile(
    data.content_ciphertext,
    data.content_iv,
    data.content_wrapped_key,
    data.content_key_iv,
    folderKey
  );

  return {
    data: decryptedData,
    filename,
    mimeType: data.mime_type || 'application/octet-stream',
  };
}

export async function deleteFile(fileId: string) {
  await supabase.from('encrypted_files').delete().eq('id', fileId);
}

export async function decryptFileMetadata(file: any, folderKey: CryptoKey) {
  return decryptString(file.metadata_ciphertext, folderKey, file.metadata_iv);
}