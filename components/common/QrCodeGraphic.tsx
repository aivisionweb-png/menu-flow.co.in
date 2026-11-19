import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeGraphicProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  interactive3D?: boolean;
  className?: string;
  alt?: string;
}

export function QrCodeGraphic({
  value,
  size = 180,
  darkColor = '#080A0C',
  lightColor = '#F5F2EA',
  interactive3D = false,
  className = '',
  alt = 'Table QR Code',
}: QrCodeGraphicProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch(() => {
        if (mounted) setDataUrl('');
      });
    return () => {
      mounted = false;
    };
  }, [value, size, darkColor, lightColor]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive3D) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -y * 10, ry: x * 10 });
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0 });

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={resetTilt}
      style={
        interactive3D
          ? {
              perspective: '800px',
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }
          : undefined
      }
      className={`inline-flex items-center justify-center rounded-xl bg-[#F5F2EA] p-2.5 shadow-lg shadow-black/30 ${className}`}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={alt}
          width={size}
          height={size}
          className="block rounded-md"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="animate-pulse rounded-md bg-black/10"
          aria-label="Generating QR code"
        />
      )}
    </div>
  );
}

export async function downloadQrPng(value: string, filename: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(value, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#080A0C', light: '#FFFFFF' },
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
