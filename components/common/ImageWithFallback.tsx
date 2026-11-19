import { useState } from 'react';
import { Utensils } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackTitle,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#12171C] via-[#171D23] to-[#0D1115] p-4 text-center"
      >
        <Utensils className="h-6 w-6 text-[#9BA3AA]/60" aria-hidden="true" />
        {fallbackTitle && (
          <span className="max-w-[90%] truncate text-xs font-medium text-[#9BA3AA]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
