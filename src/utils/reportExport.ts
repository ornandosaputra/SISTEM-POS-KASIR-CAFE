import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { CurrencyCode, OrderRecord, ProductItem } from '../types';
import { formatMoney, type AnalyticsSummary } from './posLogic';

export function exportSalesReportPdf(
  summary: AnalyticsSummary,
  orders: OrderRecord[],
  products: ProductItem[],
  currency: CurrencyCode,
  periodDays: number
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleString('id-ID');

  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text("Purr'Coffee POS — Laporan Penjualan & Inventaris", 14, 18);

  doc.setFontSize(9.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${periodDays === 1 ? 'Hari Ini (Real-Time)' : `${periodDays} Hari Terakhir`}  |  Dicetak: ${dateStr}`, 14, 24);

  autoTable(doc, {
    startY: 30,
    head: [['Indikator Performa', 'Nilai']],
    body: [
      ['Pendapatan Kotor (Gross Revenue)', formatMoney(summary.grossRevenueCents, currency)],
      ['Estimasi Laba Bersih', formatMoney(summary.netProfitCents, currency)],
      ['Total Transaksi Berhasil', `${summary.totalOrders} pesanan`],
      ['Rata-rata Nilai Pesanan (AOV)', formatMoney(summary.avgOrderValueCents, currency)],
      ['Item Stok Menipis', `${summary.lowStockCount} SKU`],
    ],
    headStyles: { fillColor: [255, 158, 103], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterKpiY = ((doc as any).lastAutoTable?.finalY || 72) + 8;

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('Rincian Transaksi Penjualan', 14, afterKpiY);

  autoTable(doc, {
    startY: afterKpiY + 3,
    head: [['No. Order', 'Waktu', 'Tipe', 'Pembayaran', 'Kasir', 'Status', 'Total']],
    body: orders.slice(0, 35).map((o) => [
      o.orderNumber,
      new Date(o.createdAtMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      o.orderType,
      o.paymentMethod,
      o.cashierName,
      o.status.toUpperCase(),
      formatMoney(o.totalCents, currency),
    ]),
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterOrdersY = ((doc as any).lastAutoTable?.finalY || 160) + 8;
  const lowItems = products.filter((p) => p.stock <= p.minStock);

  if (lowItems.length > 0 && afterOrdersY < 250) {
    doc.setFontSize(11);
    doc.text('Peringatan Inventaris Stok Menipis', 14, afterOrdersY);
    autoTable(doc, {
      startY: afterOrdersY + 3,
      head: [['SKU', 'Nama Produk', 'Kategori', 'Stok Saat Ini', 'Batas Minimum']],
      body: lowItems.map((p) => [p.sku, p.name, p.category, String(p.stock), String(p.minStock)]),
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
      styles: { fontSize: 8.5 },
    });
  }

  const filename = `PurrCoffee_Laporan_Penjualan_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

export function exportSalesReportExcel(
  summary: AnalyticsSummary,
  orders: OrderRecord[],
  products: ProductItem[],
  currency: CurrencyCode
): string {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { Metrik: 'Pendapatan Kotor', Nilai: formatMoney(summary.grossRevenueCents, currency) },
    { Metrik: 'Estimasi Laba Bersih', Nilai: formatMoney(summary.netProfitCents, currency) },
    { Metrik: 'Total Transaksi Selesai', Nilai: summary.totalOrders },
    { Metrik: 'Rata-rata Nilai Pesanan (AOV)', Nilai: formatMoney(summary.avgOrderValueCents, currency) },
    { Metrik: 'Pesanan Refund', Nilai: summary.refundedCount },
    { Metrik: 'SKU Stok Menipis', Nilai: summary.lowStockCount },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Bisnis');

  const orderRows = orders.map((o) => ({
    Nomor_Order: o.orderNumber,
    Waktu_Transaksi: new Date(o.createdAtMs).toLocaleString('id-ID'),
    Tipe_Layanan: o.orderType,
    Metode_Pembayaran: o.paymentMethod,
    Referensi_Pembayaran: o.paymentRef,
    Item_Pesanan: o.itemsLabel,
    Kasir: o.cashierName,
    Status: o.status,
    Total: formatMoney(o.totalCents, currency),
  }));
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Transaksi Harian');

  const inventoryRows = products.map((p) => ({
    SKU: p.sku,
    Nama_Produk: p.name,
    Kategori: p.category,
    Harga_Jual: formatMoney(p.priceCents, currency),
    HPP: formatMoney(p.costCents, currency),
    Stok_Tersedia: p.stock,
    Minimum_Stok: p.minStock,
    Status_Stok: p.stock === 0 ? 'HABIS' : p.stock <= p.minStock ? 'MENIPIS' : 'AMAN',
  }));
  const wsInventory = XLSX.utils.json_to_sheet(inventoryRows);
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventaris Stok');

  const filename = `PurrCoffee_Analitik_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
