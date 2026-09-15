/**
 * LiveConnect Backblaze B2 Media Storage Client Utility
 * Enforces file size limits and handles secure upload/replace/delete operations via server API.
 */

export const B2_CLIENT_SIZE_LIMITS = {
  profile: 5 * 1024 * 1024, // 5 MB
  'chat-photo': 5 * 1024 * 1024, // 5 MB
  'chat-video': 50 * 1024 * 1024, // 50 MB
  'chat-voice-note': 10 * 1024 * 1024, // 10 MB
} as const;

export type B2MediaCategory = keyof typeof B2_CLIENT_SIZE_LIMITS;

export const B2_CLIENT_ERROR_MESSAGES: Record<B2MediaCategory, string> = {
  profile: 'Profile picture size must be 5 MB or less.',
  'chat-photo': 'Photo size must be 5 MB or less.',
  'chat-video': 'Video size must be 50 MB or less.',
  'chat-voice-note': 'Voice note size must be 10 MB or less.',
};

export interface B2UploadResponse {
  success: boolean;
  b2_file_id: string;
  b2_file_name: string;
  url: string;
  mimeType: string;
  size: number;
  error?: string;
}

/**
 * Validate file size on client-side before sending upload request
 */
export function validateClientFileSize(sizeInBytes: number, category: B2MediaCategory): void {
  const limit = B2_CLIENT_SIZE_LIMITS[category];
  if (sizeInBytes > limit) {
    throw new Error(B2_CLIENT_ERROR_MESSAGES[category]);
  }
}

/**
 * Convert Blob or File to Base64 String
 */
export async function fileToBase64(fileOrBlob: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = (reader.result as string) || '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.substring(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Upload Media File to Backblaze B2 via Secure Server API
 */
export async function uploadMediaToB2(options: {
  fileOrBlob: File | Blob;
  category: B2MediaCategory;
  userId: string;
  conversationId?: string;
  messageId?: string;
  fileName?: string;
  mimeType?: string;
}): Promise<B2UploadResponse> {
  const { fileOrBlob, category, userId, conversationId, messageId, fileName, mimeType } = options;

  // 1. Client-Side Size Validation
  validateClientFileSize(fileOrBlob.size, category);

  // 2. Prepare Base64 Data
  const base64Data = await fileToBase64(fileOrBlob);
  const finalMime = mimeType || fileOrBlob.type || 'application/octet-stream';
  const finalName = fileName || (fileOrBlob as File).name || 'attachment.bin';

  // 3. Send Request to Secure Backend API
  const response = await fetch('/api/b2/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Data,
      category,
      userId,
      conversationId,
      messageId,
      mimeType: finalMime,
      fileName: finalName,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    const errMsg = data?.error || B2_CLIENT_ERROR_MESSAGES[category] || 'Media upload failed.';
    throw new Error(errMsg);
  }

  return data as B2UploadResponse;
}

/**
 * Replace User Profile Picture in Backblaze B2
 * Uploads new picture -> updates Supabase profile -> deletes old B2 object from cloud
 */
export async function replaceProfilePictureInB2(options: {
  file: File;
  userId: string;
  oldB2FileId?: string | null;
  onUpdateProfile: (updates: { avatar_url: string; b2_file_id?: string; b2_file_name?: string }) => Promise<boolean>;
}): Promise<string> {
  const { file, userId, oldB2FileId, onUpdateProfile } = options;

  // 1. Validate file size (5 MB max)
  validateClientFileSize(file.size, 'profile');

  // 2. Upload new image to Backblaze B2
  const uploadRes = await uploadMediaToB2({
    fileOrBlob: file,
    category: 'profile',
    userId,
    fileName: file.name,
    mimeType: file.type || 'image/jpeg',
  });

  if (!uploadRes.url) {
    throw new Error('Failed to get B2 media URL.');
  }

  // 3. Update Supabase Profile
  const updated = await onUpdateProfile({
    avatar_url: uploadRes.url,
    b2_file_id: uploadRes.b2_file_id,
    b2_file_name: uploadRes.b2_file_name,
  });

  if (!updated) {
    // Orphan protection: attempt cleanup of newly uploaded image if DB update failed
    try {
      await deleteB2Object(uploadRes.b2_file_id);
    } catch {}
    throw new Error('Failed to update profile record in database.');
  }

  // 4. Delete OLD Profile Picture from Backblaze B2 (only after new image uploaded & saved)
  if (oldB2FileId && oldB2FileId !== uploadRes.b2_file_id) {
    try {
      await deleteB2Object(oldB2FileId);
    } catch (oldDelErr) {
      console.warn('Notice deleting old profile picture from B2:', oldDelErr);
    }
  }

  return uploadRes.url;
}

/**
 * Remove User Profile Picture
 * Deletes object from Backblaze B2 -> clears profile picture in Supabase
 */
export async function removeProfilePictureFromB2(options: {
  userId: string;
  b2FileId?: string | null;
  onUpdateProfile: (updates: { avatar_url: null; b2_file_id: null; b2_file_name: null }) => Promise<boolean>;
}): Promise<void> {
  const { userId, b2FileId, onUpdateProfile } = options;

  // 1. Delete object from Backblaze B2 if file ID exists
  if (b2FileId) {
    const deleted = await deleteB2Object(b2FileId);
    if (!deleted) {
      throw new Error('Could not delete profile picture from cloud storage. Please try again.');
    }
  }

  // 2. Remove profile image reference in Supabase
  const updated = await onUpdateProfile({
    avatar_url: null,
    b2_file_id: null,
    b2_file_name: null,
  });

  if (!updated) {
    throw new Error('Failed to update profile database.');
  }
}

/**
 * Delete B2 Object by Key/ID
 */
export async function deleteB2Object(b2FileId: string): Promise<boolean> {
  if (!b2FileId) return true;

  const res = await fetch('/api/b2/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ b2_file_id: b2FileId }),
  });

  const data = await res.json().catch(() => null);
  return Boolean(res.ok && data?.success);
}
