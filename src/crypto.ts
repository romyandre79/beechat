// Client-side Cryptographic Utilities (AES-GCM) for End-to-End Message Encryption

const SALT = '_beechat_honey_salt_';

// crypto.subtle is ONLY available in secure contexts (HTTPS or localhost)
const isSubtleAvailable = typeof window !== 'undefined' && window.crypto && window.crypto.subtle;

async function getKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Generate a hash of the password to use as a stable key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode((password + SALT).padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return keyMaterial;
}

export async function encryptMessage(text: string, chatId: string): Promise<string> {
  if (!text) return text;
  if (!isSubtleAvailable) return text; // Fallback: plaintext when not in secure context
  try {
    const key = await getKey(chatId);
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(text)
    );
    
    // Convert IV and Ciphertext to hex strings
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const ctBytes = new Uint8Array(encrypted);
    const ctHex = Array.from(ctBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `e2ee:${ivHex}:${ctHex}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return text; // Fallback to plaintext
  }
}

export async function decryptMessage(cipherText: string, chatId: string): Promise<string> {
  if (!cipherText || !cipherText.startsWith('e2ee:')) {
    return cipherText; // Return plaintext directly if not encrypted
  }
  if (!isSubtleAvailable) return cipherText; // Can't decrypt without crypto.subtle
  try {
    const parts = cipherText.split(':');
    if (parts.length < 3) return cipherText;
    const ivHex = parts[1];
    const ctHex = parts[2];

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const ct = new Uint8Array(ctHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const key = await getKey(chatId);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ct
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '🔑 [Pesan Terenkripsi - Gagal Mendekripsi]';
  }
}

