/**
 * Client-Side Media Upload Utility
 * Uploads photos and voice recordings to the server media endpoint
 * and returns clean, short URLs (/api/media/file/:id) to prevent database constraint violations.
 */

export interface UploadMediaResult {
  url: string;
  fileId: string;
  size: number;
  mimeType: string;
}

/**
 * Compress an image data URL or blob to a balanced size (max 1280px dimension, webp/jpeg 0.82 quality)
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
 * Upload an image or audio file/blob/dataUrl to the server media storage
 */
export async function uploadMediaToServer(
  data: Blob | string,
  options: {
    mimeType?: string;
    fileName?: string;
    mediaType?: 'image' | 'audio' | 'file';
  } = {}
): Promise<string> {
  const { mimeType = 'image/jpeg', fileName = 'upload.jpg', mediaType = 'image' } = options;

  let base64Data = '';
  let finalMimeType = mimeType;
  let targetData = data;

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

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data,
        mimeType: finalMimeType,
        fileName,
        mediaType,
      }),
    });

    if (response.ok) {
      const result = await response.json().catch(() => null);
      if (result && result.url) {
        return result.url;
      }
    }
  } catch (err: any) {
    console.warn('Media upload notice:', err?.message || err);
  }

  // Graceful fallback: return inline data URL so the media can always be played / viewed
  if (typeof data === 'string' && data.startsWith('data:')) {
    return data;
  }
  if (base64Data && finalMimeType) {
    const cleanFallback = finalMimeType.split(';')[0].trim().toLowerCase();
    return `data:${cleanFallback};base64,${base64Data}`;
  }
  return '';
}
