import crypto from 'crypto';

const GOOGLE_TOKEN_PREFIX = 'enc:v1:';
const DEFAULT_ENCRYPTION_KEY = 'base-dev-google-token-key-change-me-32';
const encryptionKeyMaterial =
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
  process.env.APP_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  DEFAULT_ENCRYPTION_KEY;

const encryptionKey = crypto.createHash('sha256').update(encryptionKeyMaterial).digest();

/**
 * Encrypt a token value using AES-256-GCM
 */
export const encryptToken = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (value.startsWith(GOOGLE_TOKEN_PREFIX)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${GOOGLE_TOKEN_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
};

/**
 * Decrypt a token value using AES-256-GCM
 */
export const decryptToken = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!value.startsWith(GOOGLE_TOKEN_PREFIX)) return value;

  const payload = Buffer.from(value.slice(GOOGLE_TOKEN_PREFIX.length), 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};
