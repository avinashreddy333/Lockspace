/**
 * Zero-Knowledge Crypto Utilities
 * 
 * SECURITY MODEL:
 * - All encryption/decryption happens client-side only
 * - Passwords never leave the browser
 * - Server only stores encrypted blobs
 * - No password recovery possible (by design)
 * 
 * KEY HIERARCHY:
 * 1. Workspace Password → Workspace Key (via PBKDF2)
 * 2. Folder Password → Folder Key (via PBKDF2)
 * 3. File Key = Random AES-256 key, wrapped with Folder Key
 * 
 * ALGORITHMS:
 * - Key Derivation: PBKDF2-SHA256 (600,000 iterations for security)
 * - Encryption: AES-256-GCM
 * - Hashing: SHA-256
 */

// Constants
const PBKDF2_ITERATIONS = 600000; // High iteration count for brute-force resistance
const SALT_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const KEY_LENGTH = 256; // AES-256

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return generateRandomBytes(SALT_LENGTH);
}

/**
 * Generate a random IV for AES-GCM encryption
 */
export function generateIV(): Uint8Array {
  return generateRandomBytes(IV_LENGTH);
}

/**
 * Convert string to Uint8Array using UTF-8 encoding
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string using UTF-8 decoding
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert Uint8Array to Base64 string for storage
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/**
 * Convert Base64 string back to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash data using SHA-256
 * Used for creating identifiers from passwords (not for key derivation)
 */
export async function sha256Hash(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(hashBuffer);
}

/**
 * Create a deterministic ID from a password (for workspace identification)
 * This allows finding a workspace without revealing the password
 */
export async function createWorkspaceId(password: string): Promise<string> {
  const passwordBytes = stringToBytes(password);
  // Double hash to prevent length extension attacks
  const firstHash = await sha256Hash(passwordBytes);
  const secondHash = await sha256Hash(firstHash);
  return bytesToBase64(secondHash);
}

/**
 * Derive an encryption key from a password using PBKDF2
 * 
 * Security notes:
 * - Uses 600,000 iterations (OWASP 2023 recommendation)
 * - Salt prevents rainbow table attacks
 * - Returns a CryptoKey object that can only be used for AES operations
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordBytes = stringToBytes(password);
  
  // Import password as a key for PBKDF2
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    true, // extractable for key wrapping
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
  
  return derivedKey;
}

/**
 * Generate a random AES-256 key for file encryption
 */
export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    true, // extractable for wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to raw bytes (for wrapping)
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

/**
 * Import raw bytes as a CryptoKey
 */
export async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * Returns: { iv, ciphertext } both as Uint8Array
 * 
 * Security notes:
 * - GCM provides authenticated encryption (integrity + confidentiality)
 * - IV must be unique for each encryption with same key
 * - IV can be stored alongside ciphertext (not secret)
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: CryptoKey
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = generateIV();
  
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    plaintext as BufferSource
  );
  
  return {
    iv,
    ciphertext: new Uint8Array(ciphertext),
  };
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * Throws if:
 * - Wrong key
 * - Data has been tampered with
 * - IV doesn't match
 */
export async function decrypt(
  ciphertext: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    ciphertext as BufferSource
  );
  
  return new Uint8Array(plaintext);
}

/**
 * Encrypt a string and return Base64-encoded result
 */
export async function encryptString(
  plaintext: string,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const plaintextBytes = stringToBytes(plaintext);
  const { iv, ciphertext } = await encrypt(plaintextBytes, key);
  
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * Decrypt a Base64-encoded ciphertext to string
 */
export async function decryptString(
  ciphertext: string,
  key: CryptoKey,
  iv: string
): Promise<string> {
  const ciphertextBytes = base64ToBytes(ciphertext);
  const ivBytes = base64ToBytes(iv);
  const plaintextBytes = await decrypt(ciphertextBytes, key, ivBytes);
  
  return bytesToString(plaintextBytes);
}

/**
 * Wrap (encrypt) a file key with a folder key
 * This allows the file key to be stored encrypted
 */
export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ iv: string; wrappedKey: string }> {
  const iv = generateIV();
  
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    }
  );
  
  return {
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
  };
}

/**
 * Unwrap (decrypt) a file key using a folder key
 */
export async function unwrapKey(
  wrappedKey: string,
  unwrappingKey: CryptoKey,
  iv: string
): Promise<CryptoKey> {
  const wrappedKeyBytes = base64ToBytes(wrappedKey);
  const ivBytes = base64ToBytes(iv);
  
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBytes as BufferSource,
    unwrappingKey,
    {
      name: 'AES-GCM',
      iv: ivBytes as BufferSource,
    },
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a file's contents
 * Returns all data needed to store and later decrypt the file
 */
export async function encryptFile(
  fileData: ArrayBuffer,
  folderKey: CryptoKey
): Promise<{
  iv: string;
  ciphertext: string;
  wrappedKey: string;
  keyIv: string;
}> {
  // Generate a unique key for this file
  const fileKey = await generateFileKey();
  
  // Encrypt the file contents with the file key
  const { iv, ciphertext } = await encrypt(new Uint8Array(fileData), fileKey);
  
  // Wrap the file key with the folder key
  const { iv: keyIv, wrappedKey } = await wrapKey(fileKey, folderKey);
  
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    wrappedKey,
    keyIv,
  };
}

/**
 * Decrypt a file's contents
 */
export async function decryptFile(
  ciphertext: string,
  iv: string,
  wrappedKey: string,
  keyIv: string,
  folderKey: CryptoKey
): Promise<ArrayBuffer> {
  // Unwrap the file key using the folder key
  const fileKey = await unwrapKey(wrappedKey, folderKey, keyIv);
  
  // Decrypt the file contents
  const decrypted = await decrypt(
    base64ToBytes(ciphertext),
    fileKey,
    base64ToBytes(iv)
  );
  
  return decrypted.buffer as ArrayBuffer;
}

/**
 * Artificial delay for failed password attempts
 * This slows down brute-force attacks
 */
export function artificialDelay(ms: number = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verify password strength (client-side validation)
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
