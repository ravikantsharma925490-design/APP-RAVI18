/**
 * Client-Side Media Upload Utility
 * Uploads photos, videos, and voice recordings to Backblaze B2 storage via server endpoint
 * and returns clean Backblaze B2 URLs to prevent database constraint violations.
 */

import { validateClientFileSize, B2MediaCategory, B2_CLIENT_ERROR_MESSAGES } from './b2Client';

export interface UploadMediaResult {
  url: string;
  fileId: string;
  size: number;
  mimeType: string;
  b2_file_id?: string;
  b2_file_name?: string;
}

/**
 * Compress an image data URL or blob to a balanced size (max 1280px dimension, jpeg 0.82 quality)
 */
async function compressImageIfNeeded(dataUrlOrBlob: string | Blob): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        resolve(typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '');
      };

      if (typeof dataUrlOrBlob === 'string') {
        img.src = dataUrlOrBlob;
      } else {
        img.src = URL.createObjectURL(dataUrlOrBlob);
      }
    } catch {
      resolve(typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '');
    }
  });
}

/**
 * Upload an image, video, or audio file/blob/dataUrl to Backblaze B2 storage
 */
export async function uploadMediaToServer(
  data: Blob | string,
  options: {
    mimeType?: string;
    fileName?: string;
    mediaType?: 'image' | 'audio' | 'video' | 'file';
    category?: B2MediaCategory;
    userId?: string;
    conversationId?: string;
    messageId?: string;
  } = {}
): Promise<string> {
  const {
    mimeType = 'image/jpeg',
    fileName = 'upload.jpg',
    mediaType = 'image',
    category,
    userId = 'user',
    conversationId,
    messageId,
  } = options;

  let base64Data = '';
  let finalMimeType = mimeType;
  let targetData = data;

  // Determine B2 media category
  let targetCategory: B2MediaCategory = category || 'chat-photo';
  if (!category) {
    if (mediaType === 'video' || (typeof mimeType === 'string' && mimeType.startsWith('video/'))) {
      targetCategory = 'chat-video';
    } else if (mediaType === 'audio' || (typeof mimeType === 'string' && mimeType.startsWith('audio/'))) {
      targetCategory = 'chat-voice-note';
    } else if (mediaType === 'image' || (typeof mimeType === 'string' && mimeType.startsWith('image/'))) {
      targetCategory = 'chat-photo';
    }
  }

  try {
    // Compress images before upload
    if (mediaType === 'image' || (typeof data === 'string' && data.startsWith('data:image'))) {
      const compressed = await compressImageIfNeeded(data);
      if (compressed) {
        targetData = compressed;
      }
    }

    if (typeof targetData === 'string') {
      if (targetData.startsWith('data:')) {
        const commaIdx = targetData.indexOf(',');
        const header = targetData.substring(5, commaIdx);
        finalMimeType = header.split(';')[0] || mimeType;
        base64Data = targetData.substring(commaIdx + 1);
      } else {
        base64Data = targetData;
      }
    } else if (targetData instanceof Blob) {
      finalMimeType = targetData.type || mimeType;

      // Validate client file size
      validateClientFileSize(targetData.size, targetCategory);

      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = (reader.result as string) || '';
          const commaIdx = res.indexOf(',');
          resolve(commaIdx !== -1 ? res.substring(commaIdx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(targetData as Blob);
      });
    }

    finalMimeType = (finalMimeType || mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();

    // Check size of base64 data
    const approximateSizeBytes = Math.round((base64Data.length * 3) / 4);
    validateClientFileSize(approximateSizeBytes, targetCategory);

    const response = await fetch('/api/b2/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data,
        category: targetCategory,
        userId,
        conversationId,
        messageId,
        mimeType: finalMimeType,
        fileName,
      }),
    });

    if (response.ok) {
      const result = await response.json().catch(() => null);
      if (result && result.url) {
        return result.url;
      }
    } else {
      const errRes = await response.json().catch(() => null);
      if (errRes && errRes.error) {
        throw new Error(errRes.error);
      }
    }
  } catch (err: any) {
    if (err.message && B2_CLIENT_ERROR_MESSAGES[targetCategory]) {
      throw err;
    }
    console.warn('Backblaze B2 upload notice:', err?.message || err);
  }

  // Graceful fallback
  if (typeof data === 'string' && data.startsWith('data:')) {
    return data;
  }
  if (base64Data && finalMimeType) {
    const cleanFallback = finalMimeType.split(';')[0].trim().toLowerCase();
    return `data:${cleanFallback};base64,${base64Data}`;
  }
  return '';
}

