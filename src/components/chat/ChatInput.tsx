import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Smile,
  Mic,
  Image as ImageIcon,
  Sticker,
  Send,
  X,
  Trash2,
  Square,
  Sparkles,
  Heart,
  Flame,
  ThumbsUp,
  PartyPopper,
  Laugh,
  Check,
  Video,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadMediaToServer } from '@/src/lib/mediaUpload';

// Determine optimal supported audio MIME type across Chrome, Safari, Android & iOS
function getOptimalAudioMimeType(): string {
  const mimeTypes = [
    'audio/webm;codecs=opus', // Prioritize highest quality open codec
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2', // Fallback for Safari/iOS
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    for (const mime of mimeTypes) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) {
          return mime;
        }
      } catch {}
    }
  }
  return '';
}

// Mobile-friendly Studio Voice Note Recording Constraints
export const REAL_VOICE_NOTE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true, // Enabled to remove background noise
  autoGainControl: true, // Enabled to automatically adjust microphone volume
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
    ],
  },
  {
    name: 'Gestures',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖',
      '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🧠',
    ],
  },
  {
    name: 'Hearts & Love',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
      '💐', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '✨', '⭐', '🌟',
    ],
  },
  {
    name: 'Fun & Animals',
    icon: '🔥',
    emojis: [
      '🔥', '💯', '🎉', '🎊', '🎁', '🎈', '🍾', '🍻', '🥂', '🍔',
      '🍕', '🍟', '🍦', '🍩', '🍫', '🍿', '☕', '🚀', '⚡', '🏆',
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    ],
  },
];

// Rich Curated Stickers (High-res SVG/Vector expressions with distinct colors & animations)
export const STICKER_PACKS = [
  {
    id: 'cute-cat-love',
    name: 'Love & Hearts',
    preview: '😻',
    description: 'Heart Eyes Cat',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    id: 'celebrate-party',
    name: 'Party On!',
    preview: '🥳',
    description: 'Let\'s Celebrate',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    id: 'cool-sunglasses',
    name: 'Too Cool',
    preview: '😎',
    description: 'Chill Vibes',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'fire-lit',
    name: 'Super Lit',
    preview: '🔥',
    description: 'On Fire!',
    gradient: 'from-red-500 to-amber-500',
  },
  {
    id: 'mind-blown',
    name: 'Mind Blown',
    preview: '🤯',
    description: 'Incredible!',
    gradient: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'laugh-tears',
    name: 'LOL Dead',
    preview: '🤣',
    description: 'Laugh Out Loud',
    gradient: 'from-yellow-400 to-amber-500',
  },
  {
    id: 'big-thumbs-up',
    name: 'Awesome',
    preview: '👍',
    description: 'You Rock!',
    gradient: 'from-emerald-400 to-teal-600',
  },
  {
    id: 'crying-sad',
    name: 'Miss You',
    preview: '🥺',
    description: 'Pleading Eyes',
    gradient: 'from-sky-400 to-blue-600',
  },
  {
    id: 'sparkles-magic',
    name: 'Pure Magic',
    preview: '✨',
    description: 'Sparkling Glow',
    gradient: 'from-fuchsia-400 to-pink-500',
  },
  {
    id: 'star-struck',
    name: 'Star Struck',
    preview: '🤩',
    description: 'Amazing Person',
    gradient: 'from-yellow-400 to-amber-600',
  },
  {
    id: 'rock-on',
    name: 'Rock On',
    preview: '🤘',
    description: 'Party Rocker',
    gradient: 'from-violet-500 to-purple-700',
  },
  {
    id: 'hugs-love',
    name: 'Warm Hug',
    preview: '🤗',
    description: 'Sending Love',
    gradient: 'from-rose-400 to-orange-400',
  },
];

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<boolean> | void;
  displayName: string;
  disabled?: boolean;
  sending?: boolean;
  onTyping?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  displayName,
  disabled = false,
  sending = false,
  onTyping,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  // Staged Image Attachment State
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Staged Video Attachment State
  const [stagedVideoFile, setStagedVideoFile] = useState<File | null>(null);
  const [stagedVideoUrl, setStagedVideoUrl] = useState<string | null>(null);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiModalRef = useRef<HTMLDivElement | null>(null);
  const stickerModalRef = useRef<HTMLDivElement | null>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const lastTypingSentRef = useRef<number>(0);

  // Close modals on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (emojiModalRef.current && !emojiModalRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
      if (stickerModalRef.current && !stickerModalRef.current.contains(target)) {
        setShowStickerPicker(false);
      }
    };

    if (showEmojiPicker || showStickerPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showEmojiPicker, showStickerPicker]);

  // Handle Clipboard Paste for Images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isRecording) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processSelectedImage(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, isRecording]);

  // Compress & convert selected image to base64 with 5 MB size validation
  const processSelectedImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size must be 5 MB or less.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 1280px dimension
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setStagedImage(dataUrl);
          setImageFileName(file.name);
          if (stagedVideoUrl) {
            URL.revokeObjectURL(stagedVideoUrl);
            setStagedVideoUrl(null);
            setStagedVideoFile(null);
          }
          inputRef.current?.focus();
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedImage(file);
    }
    e.target.value = '';
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Enforce 50 MB Video Size Limit
    if (file.size > 50 * 1024 * 1024) {
      alert('Video size must be 50 MB or less.');
      return;
    }

    if (stagedVideoUrl) {
      URL.revokeObjectURL(stagedVideoUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setStagedVideoFile(file);
    setStagedVideoUrl(previewUrl);
    setStagedImage(null);
    setImageFileName('');
    inputRef.current?.focus();
  };

  // Submit / Send Handler
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmittingRef.current || disabled || sending || isUploadingMedia) return;
    isSubmittingRef.current = true;

    try {
      // Case 1: Staged Video Attachment
      if (stagedVideoFile) {
        const caption = inputText.trim();
        const videoFile = stagedVideoFile;

        if (stagedVideoUrl) {
          URL.revokeObjectURL(stagedVideoUrl);
        }
        setStagedVideoFile(null);
        setStagedVideoUrl(null);
        setInputText('');
        setIsUploadingMedia(true);

        try {
          const uploadedUrl = await uploadMediaToServer(videoFile, {
            mimeType: videoFile.type || 'video/mp4',
            fileName: videoFile.name || 'video.mp4',
            mediaType: 'video',
            category: 'chat-video',
          });

          if (uploadedUrl) {
            const videoPayload = caption
              ? `[VIDEO:${uploadedUrl}:${caption}]`
              : `[VIDEO:${uploadedUrl}]`;
            await onSendMessage(videoPayload);
          } else {
            alert('Video upload failed. Please try again.');
          }
        } catch (err: any) {
          console.error('Failed to send video attachment:', err);
          alert(err.message || 'Failed to upload video.');
        } finally {
          setIsUploadingMedia(false);
          inputRef.current?.focus();
        }
        return;
      }

      // Case 2: Staged Photo Attachment
      if (stagedImage) {
        const caption = inputText.trim();
        const currentStaged = stagedImage;
        const currentFileName = imageFileName;
        
        setStagedImage(null);
        setImageFileName('');
        setInputText('');
        setIsUploadingMedia(true);

        try {
          const uploadedUrl = await uploadMediaToServer(currentStaged, {
            mimeType: 'image/jpeg',
            fileName: currentFileName || 'photo.jpg',
            mediaType: 'image',
            category: 'chat-photo',
          });

          const finalSrc = uploadedUrl || currentStaged;
          const imagePayload = caption
            ? `[IMAGE:${finalSrc}:${caption}]`
            : `[IMAGE:${finalSrc}]`;

          await onSendMessage(imagePayload);
        } catch (err: any) {
          console.error('Failed to send image attachment:', err);
          alert(err.message || 'Failed to upload photo.');
        } finally {
          setIsUploadingMedia(false);
          inputRef.current?.focus();
        }
        return;
      }

      // Case 3: Standard Text Message
      const text = inputText.trim();
      if (!text) return;

      setInputText('');
      await onSendMessage(text);
      inputRef.current?.focus();
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  };


  // Insert Emoji at cursor position
  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Send Sticker directly with 1-click
  const handleStickerClick = async (sticker: typeof STICKER_PACKS[0]) => {
    setShowStickerPicker(false);
    const stickerPayload = `[STICKER:${sticker.preview}:${sticker.name}]`;
    await onSendMessage(stickerPayload);
  };

  // Robust Cross-Platform Voice Note Recording Logic
  const startVoiceRecording = async () => {
    if (disabled || isRecording || isUploadingMedia) return;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: REAL_VOICE_NOTE_CONSTRAINTS });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err2) {
          const legacyGUM =
            (navigator as any).getUserMedia ||
            (navigator as any).webkitGetUserMedia ||
            (navigator as any).mozGetUserMedia;
          if (legacyGUM) {
            stream = await new Promise((resolve, reject) =>
              legacyGUM.call(navigator, { audio: true }, resolve, reject)
            );
          } else {
            throw err2;
          }
        }
      }

      audioChunksRef.current = [];
      const optimalType = getOptimalAudioMimeType();

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(
          stream,
          optimalType ? { mimeType: optimalType, audioBitsPerSecond: 128000 } : {}
        );
      } catch {
        try {
          mediaRecorder = optimalType
            ? new MediaRecorder(stream, { mimeType: optimalType })
            : new MediaRecorder(stream);
        } catch {
          mediaRecorder = new MediaRecorder(stream);
        }
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      try {
        mediaRecorder.start();
      } catch {
        try {
          mediaRecorder.start(1000);
        } catch {}
      }

      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission or support notice:', err);
      alert('Microphone access is needed to record voice messages.');
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const finishAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    const duration = Math.max(1, recordingSeconds);

      mediaRecorder.onstop = async () => {
      // Small pause to allow final ondataavailable to deliver
      await new Promise((r) => setTimeout(r, 150));

      const optimalType = getOptimalAudioMimeType();
      const rawMime = mediaRecorder.mimeType || optimalType || 'audio/webm';
      const cleanMime = rawMime.split(';')[0].trim().toLowerCase() || 'audio/webm';
      let audioBlob: Blob | null = null;
      if (audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: cleanMime });
      }

      if (!audioBlob || audioBlob.size < 300) {
        console.warn('No valid audio data recorded in voice note (size too small)');
        setIsRecording(false);
        setRecordingSeconds(0);
        audioChunksRef.current = [];
        try {
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        } catch {}
        return;
      }

      setIsUploadingMedia(true);

      try {
        let ext = 'webm';
        if (cleanMime.includes('mp4') || cleanMime.includes('aac') || cleanMime.includes('m4a')) ext = 'mp4';
        else if (cleanMime.includes('ogg')) ext = 'ogg';
        else if (cleanMime.includes('wav')) ext = 'wav';

        let uploadedUrl = await uploadMediaToServer(audioBlob, {
          mimeType: cleanMime,
          fileName: `voice_note_${Date.now()}.${ext}`,
          mediaType: 'audio',
        });

        // Fallback: If upload failed or returned empty, read directly as base64 data URL
        if (!uploadedUrl) {
          uploadedUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = (reader.result as string) || '';
              // Ensure clean data URL MIME type without semicolon parameters
              if (res.startsWith('data:') && res.includes(';')) {
                const comma = res.indexOf(',');
                const b64 = res.substring(comma + 1);
                resolve(`data:${cleanMime};base64,${b64}`);
              } else {
                resolve(res);
              }
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(audioBlob!);
          });
        }

        if (uploadedUrl) {
          const voicePayload = `[VOICE:${duration}:${uploadedUrl}]`;
          await onSendMessage(voicePayload);
        }
      } catch (err) {
        console.error('Error sending voice note:', err);
      } finally {
        setIsUploadingMedia(false);
        setIsRecording(false);
        setRecordingSeconds(0);
        audioChunksRef.current = [];
        try {
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        } catch {}
      }
    };

    if (mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {}
    }
  };

  const formatRecTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const hasContent = inputText.trim().length > 0 || Boolean(stagedImage) || Boolean(stagedVideoFile);

  return (
    <div className="relative w-full">
      {/* Hidden File Input for Image Selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden File Input for Video Selection */}
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/m4v"
        onChange={handleVideoFileChange}
        className="hidden"
      />

      {/* Staged Image Thumbnail Preview Strip */}
      <AnimatePresence>
        {stagedImage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-2 p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 shadow-md flex items-center gap-3"
          >
            <div className="relative group shrink-0">
              <img
                src={stagedImage}
                alt="Selected preview"
                className="w-16 h-16 rounded-xl object-cover border border-neutral-300 dark:border-neutral-600 shadow-xs"
              />
              <button
                type="button"
                onClick={() => {
                  setStagedImage(null);
                  setImageFileName('');
                }}
                className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {imageFileName || 'Selected photo'}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Ready to send. Add a caption below or hit Send.
              </p>
            </div>
          </motion.div>
        )}

        {/* Staged Video Preview Strip */}
        {stagedVideoUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-2 p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 shadow-md flex items-center gap-3"
          >
            <div className="relative group shrink-0">
              <video
                src={stagedVideoUrl}
                className="w-16 h-16 rounded-xl object-cover border border-neutral-300 dark:border-neutral-600 shadow-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (stagedVideoUrl) URL.revokeObjectURL(stagedVideoUrl);
                  setStagedVideoUrl(null);
                  setStagedVideoFile(null);
                }}
                className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Remove video"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-blue-500" />
                <span>{stagedVideoFile?.name || 'Selected video'}</span>
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {(stagedVideoFile?.size ? (stagedVideoFile.size / (1024 * 1024)).toFixed(1) : '0')} MB • Ready to send to Backblaze B2.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Emoji Picker Popover Modal */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiModalRef}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-3 z-40 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {EMOJI_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setActiveCategory(idx)}
                    className={`px-2.5 py-1 text-xs rounded-xl font-medium transition-colors cursor-pointer shrink-0 ${
                      activeCategory === idx
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <span className="mr-1">{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto p-1 text-xl select-none">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:scale-125 active:scale-95 transition-all text-center cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stickers / Reactions Popover Modal */}
      <AnimatePresence>
        {showStickerPicker && (
          <motion.div
            ref={stickerModalRef}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 sm:right-auto sm:left-12 mb-3 z-40 w-72 sm:w-84 max-w-[calc(100vw-1.5rem)] p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Expressive Stickers
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowStickerPicker(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sticker Pack Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 select-none">
              {STICKER_PACKS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => handleStickerClick(sticker)}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-blue-50 dark:hover:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
                >
                  <span className="text-3xl filter drop-shadow-sm group-hover:animate-bounce">
                    {sticker.preview}
                  </span>
                  <span className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 mt-1 truncate max-w-full">
                    {sticker.name}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Pill-Shaped Chat Input Capsule */}
      {isRecording ? (
        /* Active Voice Recording Bar State */
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 shadow-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                Recording Voice Note...
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-rose-200/70 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100">
                {formatRecTime(recordingSeconds)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploadingMedia}
              onClick={cancelVoiceRecording}
              className="p-2 rounded-full text-neutral-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer disabled:opacity-40"
              title="Discard recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={isUploadingMedia}
              onClick={finishAndSendVoiceRecording}
              className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Send voice note"
            >
              {isUploadingMedia ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isUploadingMedia ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
        </motion.div>
      ) : (
        /* Modern Instagram / WhatsApp Capsule Bar */
        <form
          onSubmit={handleSend}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-full bg-neutral-100 dark:bg-[#1a1f26] border border-neutral-200/90 dark:border-neutral-700/80 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-xs transition-all"
        >
          {/* Left Icon: Emoji Picker Button (Smile Icon) */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowStickerPicker(false);
            }}
            className={`p-2 rounded-full transition-colors cursor-pointer shrink-0 ${
              showEmojiPicker
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-neutral-800'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
            }`}
            title="Choose Emoji"
          >
            <Smile className="w-5 h-5" strokeWidth={1.9} />
          </button>

          {/* Center: Text Input with 'Message...' Placeholder */}
          <input
            ref={inputRef}
            type="text"
            placeholder={stagedImage || stagedVideoFile ? "Add a caption..." : `Message ${displayName || ''}...`}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (onTyping) {
                const now = Date.now();
                if (!lastTypingSentRef.current || now - lastTypingSentRef.current > 2000) {
                  lastTypingSentRef.current = now;
                  onTyping();
                }
              }
            }}
            disabled={disabled}
            className="flex-1 min-w-0 bg-transparent text-base text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none px-2 py-1.5"
          />

          {/* Right Section: Action Icons */}
          <div className="flex items-center gap-0.5 shrink-0 pr-1">
            {/* 1. Voice Note Recording Button (Mic) */}
            <button
              type="button"
              onClick={startVoiceRecording}
              disabled={disabled}
              className="p-2 rounded-full text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Record Voice Message"
            >
              <Mic className="w-5 h-5" strokeWidth={1.9} />
            </button>

            {/* 2. Photo / Gallery Attachment Button (ImageIcon) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="p-2 rounded-full text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Attach Photo (Max 5MB)"
            >
              <ImageIcon className="w-5 h-5" strokeWidth={1.9} />
            </button>

            {/* 3. Video Attachment Button (Video Icon) */}
            <button
              type="button"
              onClick={() => videoFileInputRef.current?.click()}
              disabled={disabled}
              className="p-2 rounded-full text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Attach Video (Max 50MB)"
            >
              <Video className="w-5 h-5" strokeWidth={1.9} />
            </button>


            {/* 3. Sticker / Reactions Button (Sticker Icon) */}
            <button
              type="button"
              onClick={() => {
                setShowStickerPicker(!showStickerPicker);
                setShowEmojiPicker(false);
              }}
              disabled={disabled}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                showStickerPicker
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-neutral-800'
                  : 'text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
              }`}
              title="Stickers & Reactions"
            >
              <Sticker className="w-5 h-5" strokeWidth={1.9} />
            </button>

            {/* Dynamic Send Button (Shown when user has text or attachment) */}
            <AnimatePresence>
              {hasContent && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  type="submit"
                  disabled={disabled || sending || isUploadingMedia}
                  className="ml-1 p-2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
                  title="Send Message"
                >
                  {sending || isUploadingMedia ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </form>
      )}
    </div>
  );
};
