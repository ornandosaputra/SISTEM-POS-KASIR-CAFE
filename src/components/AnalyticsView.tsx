import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ShieldAlert } from 'lucide-react';
import type { CurrencyCode, OrderRecord, ProductItem } from '../types';
import { computeAnalyticsSummary, formatMoney } from '../utils/posLogic';
import { exportSalesReportExcel, exportSalesReportPdf } from '../utils/reportExport';

interface AnalyticsViewProps {
  orders: OrderRecord[];
  products: ProductItem[];
  currency: CurrencyCode;
  canViewAnalytics: boolean;
  onNotifyExport: (message: string) => void;
}

export function AnalyticsView({
  orders,
  products,
  currency,
  canViewAnalytics,
  onNotifyExport,
}: AnalyticsViewProps) {
  const [periodDays, setPeriodDays] = useState<1 | 7 | 30>(1);
  const [autoDailyExport, setAutoDailyExport] = useState(true);
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number | null>(null);

  if (!canViewAnalytics) {
    return (
      <div className="p-8">
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-10 border border-neutral-200 dark:border-neutral-800 text-center max-w-lg mx-auto mt-10">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-[18px] font-bold text-neutral-900 dark:text-neutral-100">
            Akses Dasbor Analitik Dibatasi
          </h1>
          <p className="text-[13.5px] text-neutral-500 mt-1.5">
            Peran operator aktif saat ini tidak memiliki izin melihat laporan analitik finansial.
            Hubungi Admin atau ganti operator pada panel kanan atas.
          </p>
        </div>
      </div>
    );
  }

  const summary = computeAnalyticsSummary(orders, products, periodDays);
  const maxBucketCents = Math.max(
    50000,
    ...summary.hourlyBuckets.map((b) => b.revenueCents)
  );

  const handleExportPdf = () => {
    const filename = exportSalesReportPdf(summary, orders, products, currency, periodDays);
    onNotifyExport(`Laporan PDF berhasil diekspor: ${filename}`);
  };

  const handleExportExcel = () => {
    const filename = exportSalesReportExcel(summary, orders, products, currency);
    onNotifyExport(`Laporan Excel (.xlsx) berhasil diekspor: ${filename}`);
  };

  return (
    <div className="p-5 sm:p-8 space-y-6">
      {/* Header & Export Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            Dasbor Analitik &amp; Laporan Harian Real-Time
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Pemantauan pendapatan langsung, margin produk, metode pembayaran digital, dan ekspor laporan otomatis.
          </p>
        </div>

        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
          <div className="inline-flex p-1 rounded-full bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-800">
            {(
              [
                { days: 1, label: 'Hari Ini' },
                { days: 7, label: '7 Hari' },
                { days: 30, label: '30 Hari' },
              ] as const
            ).map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setPeriodDays(p.days)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  periodDays === p.days
                    ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-700 text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-100 hover:border-[#FF9E67] transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#FF9E67]" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[12.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
            Pendapatan Kotor
          </span>
          <div className="mt-1.5 text-[21px] xl:text-[23px] font-bold text-[#1F1F1F] dark:text-neutral-100 tabular-nums whitespace-nowrap">
            {formatMoney(summary.grossRevenueCents, currency)}
          </div>
          <p className="mt-1 text-[11.5px] text-emerald-600 dark:text-emerald-400 tabular-nums">
            Dari {summary.totalOrders} transaksi lunas
          </p>
        </div>

        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
            Estimasi Laba Bersih
          </span>
          <div className="mt-1.5 text-[21px] xl:text-[23px] font-bold text-[#1F1F1F] dark:text-neutral-100 tabular-nums whitespace-nowrap">
            {formatMoney(summary.netProfitCents, currency)}
          </div>
          <p className="mt-1 text-[11.5px] text-neutral-400 tabular-nums">
            Margin kotor{' '}
            {summary.grossRevenueCents > 0
              ? Math.round((summary.netProfitCents / summary.grossRevenueCents) * 100)
              : 0}
            % setelah HPP
          </p>
        </div>

        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
            Rata-Rata Nilai Pesanan (AOV)
          </span>
          <div className="mt-1.5 text-[21px] xl:text-[23px] font-bold text-[#FF9E67] tabular-nums whitespace-nowrap">
            {formatMoney(summary.avgOrderValueCents, currency)}
          </div>
          <p className="mt-1 text-[11.5px] text-neutral-400 tabular-nums">
            Refund tercatat: {summary.refundedCount} pesanan
          </p>
        </div>

        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
            Jadwal Ekspor Otomatis
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[14px] font-bold text-neutral-900 dark:text-neutral-100">
              {autoDailyExport ? 'Aktif · 22:00 WIB' : 'Nonaktif'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoDailyExport}
              aria-label="Aktifkan ekspor laporan harian otomatis"
              onClick={() => setAutoDailyExport((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                autoDailyExport ? 'bg-[#FF9E67]' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  autoDailyExport ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-neutral-400 flex items-center gap-1">
            <Download className="w-3 h-3" />
            <span>Arsip PDF &amp; XLSX tutup kasir</span>
          </p>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Interactive Hourly Revenue Bar & Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 flex flex-col justify-between">
          <div className="flex items-baseline justify-between gap-2 mb-5">
            <div>
              <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                Kurva Penjualan Per Jam Operasional
              </h2>
              <p className="text-[12px] text-neutral-400">
                Distribusi omzet kasir sepanjang jam buka outlet (08:00 – 22:00)
              </p>
            </div>
            {hoveredHourIdx !== null && summary.hourlyBuckets[hoveredHourIdx] && (
              <div className="text-right text-[12px] tabular-nums">
                <span className="font-bold text-[#FF9E67]">
                  {formatMoney(summary.hourlyBuckets[hoveredHourIdx].revenueCents, currency)}
                </span>
                <span className="text-neutral-400">
                  {' '}
                  · {summary.hourlyBuckets[hoveredHourIdx].ordersCount} order
                </span>
              </div>
            )}
          </div>

          <div className="h-52 flex items-end gap-3 pt-4">
            {summary.hourlyBuckets.map((bucket, idx) => {
              const pct = Math.max(8, Math.round((bucket.revenueCents / maxBucketCents) * 100));
              const active = hoveredHourIdx === idx;
              return (
                <div
                  key={bucket.hourLabel}
                  onMouseEnter={() => setHoveredHourIdx(idx)}
                  onMouseLeave={() => setHoveredHourIdx(null)}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <span className="text-[10.5px] font-mono text-neutral-400 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {bucket.ordersCount}x
                  </span>
                  <div className="w-full max-w-[42px] bg-[#F5F5F7] dark:bg-[#232730] rounded-t-xl h-36 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${pct}%` }}
                      className={`w-full rounded-t-xl transition-all duration-200 ${
                        active
                          ? 'bg-[#333333] dark:bg-white'
                          : bucket.revenueCents > 0
                            ? 'bg-[#FF9E67]'
                            : 'bg-neutral-200 dark:bg-neutral-700'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {bucket.hourLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Digital Payment Channel Breakdown */}
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 flex flex-col justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
              Komposisi Pembayaran Digital
            </h2>
            <p className="text-[12px] text-neutral-400 mt-0.5">
              Proporsi metode transaksi pelanggan
            </p>

            <div className="mt-5 space-y-4">
              {summary.paymentBreakdown.map((item) => (
                <div key={item.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {item.method}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {formatMoney(item.revenueCents, currency)} · {item.sharePct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(item.count > 0 ? 6 : 0, item.sharePct)}%` }}
                      className="h-full rounded-full bg-[#FF9E67]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-neutral-100 dark:border-neutral-800 text-[12px] text-neutral-500 flex justify-between tabular-nums">
            <span>Rasio Non-Tunai (Cashless)</span>
            <span className="font-bold text-neutral-900 dark:text-neutral-100">
              {100 -
                (summary.paymentBreakdown.find((p) => p.method === 'Cash')?.sharePct ?? 0)}
              %
            </span>
          </div>
        </div>
      </div>

      {/* Top Selling Products & Real-Time Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800">
          <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Menu Terlaris
          </h2>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {summary.topProducts.map((tp, index) => (
              <div key={tp.productId} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                    {index + 1}. {tp.name}
                  </p>
                  <p className="text-[11.5px] text-neutral-400 tabular-nums">
                    {tp.unitsSold} porsi terjual
                  </p>
                </div>
                <span className="text-[13.5px] font-bold text-[#FF9E67] tabular-nums shrink-0">
                  {formatMoney(tp.revenueCents, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 overflow-x-auto">
          <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Jurnal Penjualan Harian Real-Time
          </h2>
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-[12px]">
                <th className="py-2.5 pr-3 font-medium">Order</th>
                <th className="py-2.5 px-3 font-medium">Waktu</th>
                <th className="py-2.5 px-3 font-medium">Layanan</th>
                <th className="py-2.5 px-3 font-medium">Pembayaran</th>
                <th className="py-2.5 px-3 font-medium">Kasir</th>
                <th className="py-2.5 pl-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {orders.slice(0, 8).map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <td className="py-2.5 pr-3 font-mono font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums whitespace-nowrap">
                    {order.orderNumber}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-500 tabular-nums whitespace-nowrap">
                    {new Date(order.createdAtMs).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                    {order.orderType}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                    {order.paymentMethod}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                    {order.cashierName}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums whitespace-nowrap">
                    {order.status === 'refunded' ? (
                      <span className="line-through text-neutral-400">
                        {formatMoney(order.totalCents, currency)}
                      </span>
                    ) : (
                      formatMoney(order.totalCents, currency)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
