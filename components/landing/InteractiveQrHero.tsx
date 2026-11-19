import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, QrCode } from 'lucide-react';
import { QrCodeGraphic } from '../common/QrCodeGraphic';

export function InteractiveQrHero() {
  const navigate = useNavigate();
  const [tableNum, setTableNum] = useState(4);
  const [tilt, setTilt] = useState({ rx: -4, ry: 6 });

  const targetPath = `/menu/casa-verde/${tableNum}`;
  const fullUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${targetPath}` : targetPath;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -ny * 12, ry: nx * 14 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ rx: -4, ry: 6 })}
      className="relative flex flex-col items-center justify-center"
      style={{ perspective: '1200px' }}
    >
      {/* Subtle layered architectural card behind */}
      <div
        className="w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-[#12171C] p-6 shadow-2xl shadow-black/70"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top bar of physical QR stand */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-xs font-medium text-[#9BA3AA]">Casa Verde · Bengaluru</p>
            <p className="mt-0.5 font-display text-lg font-semibold tracking-tight text-[#F5F2EA]">
              Table {String(tableNum).padStart(2, '0')}
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-[#2DD4BF] tabular-nums">
            QR ACTIVE
          </span>
        </div>

        {/* Real QR Code */}
        <div
          className="my-6 flex flex-col items-center"
          style={{ transform: 'translateZ(24px)' }}
        >
          <QrCodeGraphic
            value={fullUrl}
            size={188}
            alt={`Interactive QR code for Casa Verde Table ${tableNum}`}
          />
          <p className="mt-3 font-mono text-[11px] text-[#9BA3AA]">
            {targetPath}
          </p>
        </div>

        {/* Table switcher */}
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#0D1115] p-1">
          {[1, 4, 7].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setTableNum(num)}
              className={`flex-1 rounded-lg py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                tableNum === num
                  ? 'bg-[#171D23] text-[#F5F2EA]'
                  : 'text-[#9BA3AA] hover:text-[#F5F2EA]'
              }`}
            >
              Table {String(num).padStart(2, '0')}
            </button>
          ))}
        </div>

        {/* Primary interactive demo trigger */}
        <button
          type="button"
          onClick={() => navigate(targetPath)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-4 py-3 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 active:scale-[0.99] transition-all whitespace-nowrap"
        >
          <QrCode className="h-4 w-4 shrink-0" />
          <span>Scan QR · Open Menu</span>
          <ArrowUpRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}
