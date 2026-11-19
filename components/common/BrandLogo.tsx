interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function BrandLogo({ size = 'md', showText = true }: BrandLogoProps) {
  const iconDim = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={iconDim}
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="7"
          fill="#12171C"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
        />
        <rect x="7.5" y="7.5" width="7" height="7" rx="1.5" stroke="#2DD4BF" strokeWidth="1.8" />
        <rect x="17.5" y="7.5" width="7" height="7" rx="1.5" stroke="#F5F2EA" strokeWidth="1.8" />
        <rect x="7.5" y="17.5" width="7" height="7" rx="1.5" stroke="#F5F2EA" strokeWidth="1.8" />
        <path
          d="M17.5 19.5H21.5M24.5 17.5V24.5M17.5 24.5H20.5"
          stroke="#E7C77A"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span className={`font-display font-semibold tracking-tight text-[#F5F2EA] ${textSize}`}>
          MenuFlow
        </span>
      )}
    </span>
  );
}
