import React from 'react';
import { X, Download, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageViewerModalProps {
  imageUrl: string | null;
  caption?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  imageUrl,
  caption,
  onClose,
}) => {
  if (!imageUrl) return null;

  const handleDownload = () => {
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `LiveConnect-Photo-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      // fallback
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none"
      >
        {/* Top Controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 flex items-center gap-2 z-10"
        >
          <button
            onClick={handleDownload}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Download photo"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Image */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center"
        >
          <img
            src={imageUrl}
            alt={caption || 'Photo'}
            className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
          />
          {caption && (
            <p className="text-white/90 text-sm mt-3 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-xs text-center max-w-lg">
              {caption}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
