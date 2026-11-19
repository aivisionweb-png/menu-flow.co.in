import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  Download,
  ExternalLink,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { QrCodeGraphic, downloadQrPng } from '../common/QrCodeGraphic';
import { TableStatusText } from '../common/StatusLabel';
import { useToast } from '../../hooks/useToast';
import type { DiningTable, Restaurant, TableStatus } from '../../types';

interface TablesQrViewProps {
  mode: 'tables' | 'qr';
  restaurant: Restaurant;
  tables: DiningTable[];
  onCreateTable: (input: {
    tableNumber: number;
    label?: string;
    capacity: number;
    zone: string;
  }) => Promise<void>;
  onUpdateTableStatus: (id: string, status: TableStatus) => Promise<void>;
  onRegenerateQr: (id: string) => Promise<void>;
  onDeleteTable: (id: string) => Promise<void>;
}

export function TablesQrView({
  mode,
  restaurant,
  tables,
  onCreateTable,
  onUpdateTableStatus,
  onRegenerateQr,
  onDeleteTable,
}: TablesQrViewProps) {
  const { toast } = useToast();
  const nextDefaultNum =
    tables.length > 0 ? Math.max(...tables.map((t) => t.tableNumber)) + 1 : 1;

  const [tableNumber, setTableNumber] = useState(String(nextDefaultNum));
  const [capacity, setCapacity] = useState('4');
  const [zone, setZone] = useState('Main Dining');
  const [adding, setAdding] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseInt(tableNumber, 10);
    if (!Number.isFinite(num) || num < 1) return;
    setAdding(true);
    try {
      await onCreateTable({
        tableNumber: num,
        capacity: Number.parseInt(capacity, 10) || 4,
        zone: zone.trim() || 'Main Dining',
      });
      setTableNumber(String(num + 1));
    } finally {
      setAdding(false);
    }
  };

  const copyLink = async (path: string) => {
    const full = `${origin}${path}`;
    try {
      await navigator.clipboard.writeText(full);
      toast('Menu link copied', { description: full, tone: 'success' });
    } catch {
      toast(full, { tone: 'info' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            {mode === 'qr' ? 'QR Code Studio' : 'Tables & Floor Plan'}
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            {mode === 'qr'
              ? 'Each table generates a unique scannable QR linking directly to its live menu'
              : `${tables.length} configured tables · Track occupancy and active bill requests`}
          </p>
        </div>

        {mode === 'qr' && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#12171C] px-4 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-[#171D23] whitespace-nowrap"
          >
            <Printer className="h-4 w-4 text-[#2DD4BF]" />
            <span>Print All QR Cards</span>
          </button>
        )}
      </div>

      {/* Add Table Form */}
      <form
        onSubmit={handleAdd}
        className="no-print grid gap-3 rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 sm:grid-cols-12 sm:items-end"
      >
        <div className="sm:col-span-3">
          <label htmlFor="tbl-num" className="block text-xs font-medium text-[#9BA3AA]">
            Table Number
          </label>
          <input
            id="tbl-num"
            type="number"
            min={1}
            required
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="tbl-cap" className="block text-xs font-medium text-[#9BA3AA]">
            Seats
          </label>
          <input
            id="tbl-cap"
            type="number"
            min={1}
            max={24}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="tbl-zone" className="block text-xs font-medium text-[#9BA3AA]">
            Floor Zone
          </label>
          <input
            id="tbl-zone"
            type="text"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={adding}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
          >
            <Plus className="h-4 w-4" />
            <span>Add Table</span>
          </button>
        </div>
      </form>

      {mode === 'tables' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => {
            const menuPath = t.qrCode?.targetPath || `/menu/${restaurant.slug}/${t.tableNumber}`;
            return (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#12171C] p-5"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">
                        {t.label}
                      </h2>
                      <p className="text-xs text-[#9BA3AA]">
                        {t.zone} · {t.capacity} seats
                      </p>
                    </div>
                    <TableStatusText status={t.status} />
                  </div>

                  <div className="mt-4">
                    <label className="block text-[11px] text-[#9BA3AA]">Update Status</label>
                    <select
                      aria-label={`Status for ${t.label}`}
                      value={t.status}
                      onChange={(e) => onUpdateTableStatus(t.id, e.target.value as TableStatus)}
                      className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="ORDERING">Ordering</option>
                      <option value="BILL_REQUESTED">Bill Requested</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
                  <Link
                    to={menuPath}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#2DD4BF] hover:underline"
                  >
                    <span>Open Menu</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteTable(t.id)}
                    aria-label={`Delete ${t.label}`}
                    className="rounded-lg p-1.5 text-[#9BA3AA] hover:text-[#F87171]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => {
            const targetPath =
              t.qrCode?.targetPath || `/menu/${restaurant.slug}/${t.tableNumber}`;
            const fullUrl = `${origin}${targetPath}`;
            return (
              <div
                key={t.id}
                className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 text-center"
              >
                <div className="flex w-full items-center justify-between border-b border-white/[0.08] pb-3 text-left">
                  <div>
                    <p className="font-mono text-sm font-semibold text-[#F5F2EA]">
                      TABLE {String(t.tableNumber).padStart(2, '0')}
                    </p>
                    <p className="text-[11px] text-[#9BA3AA]">{t.zone}</p>
                  </div>
                  <span className="font-mono text-[11px] font-medium text-[#2DD4BF]">
                    QR ACTIVE
                  </span>
                </div>

                <div className="my-5">
                  <QrCodeGraphic
                    value={fullUrl}
                    size={156}
                    interactive3D
                    alt={`QR code for ${t.label}`}
                  />
                </div>

                <p className="w-full truncate font-mono text-[11px] text-[#9BA3AA]">
                  {targetPath}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[#9BA3AA] tabular-nums">
                  {t.qrCode?.scanCount ?? 0} scans
                </p>

                <div className="no-print mt-4 grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadQrPng(fullUrl, `${restaurant.slug}-table-${t.tableNumber}`)
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2DD4BF] px-3 py-2 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyLink(targetPath)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#0D1115] px-3 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-white/[0.06]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </button>
                  <Link
                    to={targetPath}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#0D1115] px-3 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-white/[0.06]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Test Menu</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRegenerateQr(t.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#0D1115] px-3 py-2 text-xs font-medium text-[#9BA3AA] hover:text-[#F5F2EA]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Regenerate</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
