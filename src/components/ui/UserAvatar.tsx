import React, { useState, useEffect } from 'react';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  id?: string | null;
  className?: string;
  imgClassName?: string;
  isOnline?: boolean;
  showStatus?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-2xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  id,
  className,
  imgClassName,
  isOnline,
  showStatus = false,
  size,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const displayName = name || 'User';
  const initials = getInitials(displayName);
  const bgColor = getAvatarColor(id || displayName);

  // Reset image status when src changes
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [src]);

  const sizeClass = size ? SIZE_CLASSES[size] : '';

  return (
    <div className={cn('relative shrink-0 select-none rounded-full overflow-hidden', sizeClass, className)}>
      {/* Background / Fallback Initials - Always rendered underneath with fixed layout */}
      <div
        className={cn(
          'w-full h-full flex items-center justify-center font-bold text-white shadow-xs rounded-full',
          bgColor
        )}
      >
        {initials}
      </div>

      {/* Image Layer - Smooth fade-in once loaded, zero layout jumping */}
      {src && !imgError && (
        <img
          src={src}
          alt={displayName}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover rounded-full transition-opacity duration-200',
            imgLoaded ? 'opacity-100' : 'opacity-0',
            imgClassName
          )}
        />
      )}

      {/* Online Status Dot */}
      {showStatus && isOnline !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-900 z-10',
            isOnline ? 'bg-emerald-500' : 'bg-neutral-400'
          )}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
