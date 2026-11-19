import { useState } from 'react';
import { motion } from 'motion/react';
import { Bell, Droplets, HelpCircle, Receipt, X } from 'lucide-react';
import type { ServiceRequestType } from '../../types';

interface ServiceRequestSheetProps {
  tableNumber: number;
  onSend: (type: ServiceRequestType, note: string) => Promise<void>;
  onClose: () => void;
}

const OPTIONS: Array<{
  type: ServiceRequestType;
  label: string;
  desc: string;
  Icon: typeof Bell;
}> = [
  { type: 'CALL_STAFF', label: 'Call Staff', desc: 'Send a server to your table', Icon: Bell },
  { type: 'REQUEST_WATER', label: 'Request Water', desc: 'Chilled or room temperature refill', Icon: Droplets },
  { type: 'REQUEST_BILL', label: 'Request Bill', desc: 'Bring printed check or card terminal', Icon: Receipt },
  { type: 'NEED_ASSISTANCE', label: 'Need Assistance', desc: 'Cutlery, high chair, or dietary help', Icon: HelpCircle },
];

export function ServiceRequestSheet({
  tableNumber,
  onSend,
  onClose,
}: ServiceRequestSheetProps) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState<ServiceRequestType | null>(null);

  const handleTrigger = async (type: ServiceRequestType) => {
    setSending(type);
    try {
      await onSend(type, note.trim());
      onClose();
    } finally {
      setSending(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Table Service Requests"
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="w-full max-w-md rounded-t-3xl border border-white/[0.1] bg-[#12171C] p-5 sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">
              Table {String(tableNumber).padStart(2, '0')} Service
            </h2>
            <p className="text-xs text-[#9BA3AA]">Notifies floor staff immediately</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close service panel"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#9BA3AA] hover:bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {OPTIONS.map(({ type, label, desc, Icon }) => (
            <button
              key={type}
              type="button"
              disabled={sending !== null}
              onClick={() => handleTrigger(type)}
              className="flex flex-col items-start rounded-xl border border-white/[0.08] bg-[#0D1115] p-4 text-left hover:border-[#2DD4BF]/50 hover:bg-[#171D23] transition-colors"
            >
              <Icon className="h-5 w-5 text-[#2DD4BF]" />
              <span className="mt-3 text-sm font-semibold text-[#F5F2EA]">
                {sending === type ? 'Sending...' : label}
              </span>
              <span className="mt-1 text-[11px] text-[#9BA3AA]">{desc}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="sr-note" className="block text-xs font-medium text-[#9BA3AA]">
            Optional Note
          </label>
          <input
            id="sr-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Two extra forks, sparkling water..."
            className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/50"
          />
        </div>
      </motion.div>
    </div>
  );
}
