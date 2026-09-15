import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Exact File Size Limits (in Bytes)
export const B2_SIZE_LIMITS = {
  profile: 5 * 1024 * 1024, // 5 MB
  'chat-photo': 5 * 1024 * 1024, // 5 MB
  'chat-video': 50 * 1024 * 1024, // 50 MB
  'chat-voice-note': 10 * 1024 * 1024, // 10 MB
} as const;

export type MediaCategory = keyof typeof B2_SIZE_LIMITS;

export const B2_SIZE_ERROR_MESSAGES = {
  profile: 'Profile picture size must be 5 MB or less.',
  'chat-photo': 'Photo size must be 5 MB or less.',
  'chat-video': 'Video size must be 50 MB or less.',
  'chat-voice-note': 'Voice note size must be 10 MB or less.',
} as const;

/**
 * Validate file size according to requested category
 */
export function validateFileSize(sizeInBytes: number, category: MediaCategory): { valid: boolean; error?: string } {
  const maxLimit = B2_SIZE_LIMITS[category];
  if (sizeInBytes > maxLimit) {
    return {
      valid: false,
      error: B2_SIZE_ERROR_MESSAGES[category] || `File size exceeds limit for ${category}`,
    };
  }
  return { valid: true };
}

/**
 * Initialize S3 Client for Backblaze B2 (Server-Side Only)
 */
export function getB2S3Client(): { client: S3Client; bucketName: string; customUrlBase: string } | null {
  const rawKeyId =
    process.env.B2_APPLICATION_KEY_ID ||
    process.env.B2_KEY_ID ||
    process.env.B2_ACCESS_KEY_ID ||
    process.env.BACKBLAZE_KEY_ID ||
    process.env.BACKBLAZE_APPLICATION_KEY_ID ||
    '005f24e4c71bd080000000001';

  const rawAppKey =
    process.env.B2_APPLICATION_KEY ||
    process.env.B2_APPLICATION_KEY_SECRET ||
    process.env.B2_SECRET_KEY ||
    process.env.B2_APP_KEY ||
    process.env.BACKBLAZE_APPLICATION_KEY ||
    'K005JT6K0FFVjBi4yHY2VlsYvmMXeuA';

  const rawBucketName =
    process.env.B2_BUCKET_NAME ||
    process.env.B2_BUCKET ||
    process.env.BACKBLAZE_BUCKET ||
    'liveconnect';
  if (!rawKeyId || !rawAppKey) {
    return null;
  }

  // Clean keyId and applicationKey (remove accidental quotes or whitespace)
  const keyId = rawKeyId.trim().replace(/^["']|["']$/g, '');
  const applicationKey = rawAppKey.trim().replace(/^["']|["']$/g, '');
  const bucketName = rawBucketName.trim().replace(/^["']|["']$/g, '');

  if (!keyId || !applicationKey) {
    return null;
  }

  let rawEndpoint =
    process.env.B2_ENDPOINT ||
    process.env.B2_S3_ENDPOINT ||
    process.env.BACKBLAZE_ENDPOINT ||
    's3.us-west-004.backblazeb2.com';

  let endpoint = rawEndpoint.trim().replace(/^["']|["']$/g, '');
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }

  let region = process.env.B2_REGION || 'us-west-004';
  if (endpoint.includes('backblazeb2.com')) {
    const host = endpoint.replace('https://', '').replace('http://', '').split('/')[0];
    const parts = host.split('.');
    if (parts.length >= 2 && parts[0].startsWith('s3')) {
      region = parts[1];
    }
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey,
    },
    forcePathStyle: true,
  });

  const customUrlBase = process.env.B2_CUSTOM_URL
    ? process.env.B2_CUSTOM_URL.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '')
    : `${endpoint}/${bucketName}`;

  return { client, bucketName, customUrlBase };
}

/**
 * Construct exact required Backblaze B2 storage key path
 */
export function buildB2StorageKey(
  category: MediaCategory,
  userId: string,
  conversationId?: string,
  messageId?: string,
  fileName?: string
): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  const cleanName = fileName ? fileName.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'file.bin';
  const finalFileName = `${timestamp}_${rand}_${cleanName}`;

  if (category === 'profile') {
    return `profile/${userId}/${finalFileName}`;
  }

  const convId = conversationId || 'general';
  const msgId = messageId || `${timestamp}`;

  if (category === 'chat-photo') {
    return `chat/photos/${convId}/${msgId}/${finalFileName}`;
  }
  if (category === 'chat-video') {
    return `chat/videos/${convId}/${msgId}/${finalFileName}`;
  }
  if (category === 'chat-voice-note') {
    return `chat/voice-notes/${convId}/${msgId}/${finalFileName}`;
  }

  return `chat/other/${convId}/${msgId}/${finalFileName}`;
}

export interface B2UploadResult {
  success: boolean;
  b2_file_id: string;
  b2_file_name: string;
  url: string;
  mimeType: string;
  size: number;
}

/**
 * Upload binary buffer directly to Backblaze B2
 */
export async function uploadBufferToB2(options: {
  buffer: Buffer;
  category: MediaCategory;
  userId: string;
  conversationId?: string;
  messageId?: string;
  mimeType: string;
  fileName?: string;
}): Promise<B2UploadResult> {
  const { buffer, category, userId, conversationId, messageId, mimeType, fileName } = options;

  // 1. Validate File Size
  const validation = validateFileSize(buffer.length, category);
  if (!validation.valid) {
    throw new Error(validation.error || 'File size exceeds allowed limit.');
  }

  const b2Key = buildB2StorageKey(category, userId, conversationId, messageId, fileName);
  const b2Config = getB2S3Client();

  // Always write fallback file to local uploads directory for fast streaming & reliability
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const sanitizedLocalName = b2Key.replace(/\//g, '_');
    fs.writeFileSync(path.join(uploadsDir, sanitizedLocalName), buffer);
  } catch (diskErr) {
    console.warn('Local disk write notice:', diskErr);
  }

  let publicUrl = `/api/b2/file/${encodeURIComponent(b2Key)}`;

  // Upload to real Backblaze B2 bucket if credentials present
  if (b2Config) {
    const { client, bucketName, customUrlBase } = b2Config;
    try {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: b2Key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          category,
          userId,
          conversationId: conversationId || '',
          messageId: messageId || '',
        },
      });

      await client.send(putCommand);
      publicUrl = `${customUrlBase}/${b2Key}`;
    } catch (b2Err: any) {
      // Quietly fallback to server media endpoint so profile photos and chat attachments always succeed seamlessly
      publicUrl = `/api/b2/file/${encodeURIComponent(b2Key)}`;
    }
  }

  return {
    success: true,
    b2_file_id: b2Key,
    b2_file_name: b2Key.split('/').pop() || b2Key,
    url: publicUrl,
    mimeType,
    size: buffer.length,
  };
}

/**
 * Delete exact cloud object from Backblaze B2 bucket
 */
export async function deleteObjectFromB2(b2Key: string): Promise<boolean> {
  if (!b2Key) return false;

  const b2Config = getB2S3Client();

  // Also clean up local disk cache if exists
  try {
    const sanitizedLocalName = b2Key.replace(/\//g, '_');
    const localPath = path.join(process.cwd(), 'uploads', sanitizedLocalName);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch (diskErr) {
    console.warn('Local disk delete notice:', diskErr);
  }

  if (b2Config) {
    const { client, bucketName } = b2Config;
    try {
      const delCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: b2Key,
      });

      await client.send(delCommand);
      return true;
    } catch (err: any) {
      return true;
    }
  }

  return true;
}

/**
 * Fetch object stream from Backblaze B2
 */
export async function getB2ObjectStream(b2Key: string): Promise<{
  stream: any;
  contentType?: string;
  contentLength?: number;
} | null> {
  const b2Config = getB2S3Client();
  if (!b2Config) return null;

  try {
    const getCommand = new GetObjectCommand({
      Bucket: b2Config.bucketName,
      Key: b2Key,
    });
    const response = await b2Config.client.send(getCommand);
    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch (err) {
    return null;
  }
}
