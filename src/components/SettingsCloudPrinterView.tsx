import { useState } from 'react';
import {
  AlertCircle,
  Bluetooth,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Download,
  FileText,
  KeyRound,
  Lock,
  Moon,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import type {
  CloudBackupRecord,
  CurrencyCode,
  OrderRecord,
  ProductItem,
  ReceiptConfig,
  StaffMemberRecord,
} from '../types';
import {
  validateNewAdminPin,
  type AdminSecurityConfig,
} from '../utils/adminAuth';
import { formatMoney } from '../utils/posLogic';
import {
  DEFAULT_RECEIPT_CONFIG,
  isWebBluetoothSupported,
  printOrderViaThermal,
  printReceiptViaBrowserOrPdf,
  type ThermalPrinterState,
} from '../utils/thermalPrinter';

interface SettingsCloudPrinterViewProps {
  isAdminUnlocked: boolean;
  onRequestUnlockAdmin: () => void;
  adminConfig: AdminSecurityConfig;
  onUpdateAdminConfig: (nextConfig: AdminSecurityConfig) => void;
  receiptConfig: ReceiptConfig;
  onUpdateReceiptConfig: (nextConfig: ReceiptConfig) => void;
  lastCloudSyncLabel: string;
  onCreateCloudBackup: () => Promise<void>;
  backups: CloudBackupRecord[];
  products: ProductItem[];
  orders: OrderRecord[];
  staffList: StaffMemberRecord[];
  printerState: ThermalPrinterState;
  onConnectPrinter: () => Promise<void>;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  currency: CurrencyCode;
  canManageCloudApi: boolean;
  onNotify: (msg: string) => void;
}

type SettingsTab = 'receipt' | 'security' | 'printer' | 'cloud';

export function SettingsCloudPrinterView({
  isAdminUnlocked,
  onRequestUnlockAdmin,
  adminConfig,
  onUpdateAdminConfig,
  receiptConfig,
  onUpdateReceiptConfig,
  lastCloudSyncLabel,
  onCreateCloudBackup,
  backups,
  products,
  orders,
  staffList,
  printerState,
  onConnectPrinter,
  darkMode,
  onToggleDarkMode,
  currency,
  canManageCloudApi,
  onNotify,
}: SettingsCloudPrinterViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('receipt');
  const [backingUp, setBackingUp] = useState(false);

  // Admin PIN update form state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [securityFeedback, setSecurityFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Local receipt editing state
  const [receiptDraft, setReceiptDraft] = useState<ReceiptConfig>(receiptConfig);
  const [isReceiptSaved, setIsReceiptSaved] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);

  const handleSaveReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onUpdateReceiptConfig(receiptDraft);
    setIsReceiptSaved(true);
    setTimeout(() => setIsReceiptSaved(false), 3000);
    onNotify('Struktur dan format struk belanja berhasil disimpan.');
  };

  const handleResetReceipt = () => {
    setReceiptDraft(DEFAULT_RECEIPT_CONFIG);
    onUpdateReceiptConfig(DEFAULT_RECEIPT_CONFIG);
    onNotify('Struktur struk belanja dikembalikan ke pengaturan awal.');
  };

  const handleTestReceiptThermal = async () => {
    const sampleOrder: OrderRecord = orders[0] || {
      id: 'test-print',
      orderNumber: 'ORD-3243',
      orderType: 'Dine in',
      paymentMethod: 'QRIS',
      paymentRef: 'QRIS-DEMO',
      subtotalCents: 56000,
      discountCents: 0,
      totalCents: 56000,
      itemCount: 2,
      itemsLabel: '2x Cappucino (Small)',
      cashierName: receiptDraft.cashierNameOverride.trim() || 'Albert Flores',
      status: 'completed',
      createdAtMs: Date.now(),
      lines: [
        {
          id: 'l1',
          productId: 'prod-cappuccino',
          productName: 'Cappucino',
          imageKey: 'cappuccino',
          size: 'Small',
          weightGrams: 200,
          quantity: 2,
          unitPriceCents: 28000,
        },
      ],
    };
    const res = await printOrderViaThermal(sampleOrder, currency, receiptDraft);
    onNotify(`Uji cetak struk terkirim (${res.bytesSent} bytes ESC/POS via ${res.channel}).`);
  };

  const handleTestReceiptPdf = async () => {
    setTestingPrint(true);
    try {
      const sampleOrder: OrderRecord = orders[0] || {
        id: 'test-print',
        orderNumber: 'ORD-3243',
        orderType: 'Dine in',
        paymentMethod: 'QRIS',
        paymentRef: 'QRIS-DEMO',
        subtotalCents: 56000,
        discountCents: 0,
        totalCents: 56000,
        itemCount: 2,
        itemsLabel: '2x Cappucino (Small)',
        cashierName: receiptDraft.cashierNameOverride.trim() || 'Albert Flores',
        status: 'completed',
        createdAtMs: Date.now(),
        lines: [
          {
            id: 'l1',
            productId: 'prod-cappuccino',
            productName: 'Cappucino',
            imageKey: 'cappuccino',
            size: 'Small',
            weightGrams: 200,
            quantity: 2,
            unitPriceCents: 28000,
          },
        ],
      };
      await printReceiptViaBrowserOrPdf(sampleOrder, currency, receiptDraft);
      onNotify('Dialog Cetak / Simpan PDF struk telah terbuka.');
    } finally {
      setTestingPrint(false);
    }
  };

  if (!isAdminUnlocked) {
    return (
      <div className="p-6 sm:p-12 max-w-xl mx-auto flex items-center min-h-[75vh]">
        <div className="w-full bg-white dark:bg-[#181B20] rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-8 sm:p-10 text-center space-y-5 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[20px] font-bold text-neutral-900 dark:text-neutral-100">
              Pengaturan Struk &amp; Sistem Dikunci
            </h1>
            <p className="text-[13.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-md mx-auto">
              Konfigurasi struk belanja, printer Bluetooth, backup cloud, dan ganti PIN hanya dapat diakses dengan membuka Mode Admin.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF6F0] dark:bg-[#241E1A] border border-[#FF9E67]/30 text-[13px]">
            <KeyRound className="w-4 h-4 text-[#FF9E67]" />
            <span className="text-neutral-600 dark:text-neutral-300">PIN Demo:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white tabular-nums tracking-wider text-[14px]">
              {adminConfig.demoPin}
            </span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onRequestUnlockAdmin}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[14px] font-semibold transition-colors cursor-pointer shadow-sm"
            >
              <Lock className="w-4 h-4" />
              <span>Masukkan PIN Mode Admin</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleTriggerBackup = async () => {
    setBackingUp(true);
    try {
      await onCreateCloudBackup();
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadJsonSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      store: receiptDraft.storeName || "Purr'Coffee POS",
      products,
      orders,
      staff: staffList,
      backups,
      receiptConfig: receiptDraft,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PurrCoffee_Cloud_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Arsip cadangan JSON berhasil diunduh.');
  };

  const handleSaveSecurityPin = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateNewAdminPin({
      currentPin,
      newPin,
      confirmPin,
      currentConfig: adminConfig,
    });

    if (!res.valid || !res.updatedConfig) {
      setSecurityFeedback({
        type: 'error',
        text: res.error || 'Gagal memperbarui PIN Admin.',
      });
      return;
    }

    onUpdateAdminConfig(res.updatedConfig);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setSecurityFeedback({
      type: 'success',
      text: `PIN Mode Admin berhasil diperbarui menjadi ${res.updatedConfig.demoPin}.`,
    });
    onNotify('PIN Mode Admin berhasil diperbarui.');
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof Receipt }[] = [
    { id: 'receipt', label: 'Kustomisasi Struk', icon: Receipt },
    { id: 'security', label: 'Keamanan PIN Admin', icon: ShieldCheck },
    { id: 'printer', label: 'Printer Termal BLE', icon: Printer },
    { id: 'cloud', label: 'Cloud & Preferensi', icon: Cloud },
  ];

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#181B20] rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FF9E67]/15 text-[#FF9E67] text-[11px] font-bold tracking-wide uppercase mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Pusat Konfigurasi Admin</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            Pengaturan Struk &amp; Sistem
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Konfigurasi format struk belanja, keamanan PIN 6-digit, printer termal Bluetooth, dan sinkronisasi cloud.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Mode Admin Aktif</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[#FFF6F0] dark:bg-[#241E1A] border border-[#FF9E67]/30 text-[12px] flex items-center gap-1.5">
            <span className="text-neutral-500 dark:text-neutral-400">PIN Demo:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white tabular-nums">
              {adminConfig.demoPin}
            </span>
          </div>
        </div>
      </div>

      {/* Neat Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-neutral-100/80 dark:bg-neutral-800/60 p-1.5 rounded-2xl overflow-x-auto border border-neutral-200/50 dark:border-neutral-700/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-white dark:bg-[#181B20] text-[#FF9E67] shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#FF9E67]' : 'text-neutral-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: KUSTOMISASI STRUK BELANJA */}
      {activeTab === 'receipt' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Fields: 7 Columns */}
            <form onSubmit={handleSaveReceipt} className="lg:col-span-7 space-y-5">
              {/* Card 1: Identitas Toko & Header */}
              <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
                      Identitas Outlet &amp; Header Struk
                    </h2>
                    <p className="text-[11.5px] text-neutral-400">
                      Informasi utama yang dicetak pada bagian paling atas struk kasir
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[13px]">
                  <div>
                    <label htmlFor="rc-store-name" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                      Nama Toko / Kedai
                    </label>
                    <input
                      id="rc-store-name"
                      type="text"
                      value={receiptDraft.storeName}
                      onChange={(e) => setReceiptDraft({ ...receiptDraft, storeName: e.target.value })}
                      placeholder="Contoh: Purr'Coffee POS"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none focus:border-[#FF9E67]"
                    />
                  </div>

                  <div>
                    <label htmlFor="rc-phone" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                      Nomor Telepon / WhatsApp
                    </label>
                    <input
                      id="rc-phone"
                      type="text"
                      value={receiptDraft.phone}
                      onChange={(e) => setReceiptDraft({ ...receiptDraft, phone: e.target.value })}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono focus:outline-none focus:border-[#FF9E67]"
                    />
                  </div>
                </div>

                <div className="text-[13px]">
                  <label htmlFor="rc-street-address" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                    Alamat Lengkap / Nama Jalan
                  </label>
                  <input
                    id="rc-street-address"
                    type="text"
                    value={receiptDraft.streetAddress}
                    onChange={(e) => setReceiptDraft({ ...receiptDraft, streetAddress: e.target.value })}
                    placeholder="Contoh: Jl. Senopati No. 48, Kebayoran Baru, Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-[#FF9E67]"
                  />
                </div>

                <div className="text-[13px]">
                  <label htmlFor="rc-header-msg" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                    Slogan / Pesan Sub-Header (Opsional)
                  </label>
                  <input
                    id="rc-header-msg"
                    type="text"
                    value={receiptDraft.headerMessage}
                    onChange={(e) => setReceiptDraft({ ...receiptDraft, headerMessage: e.target.value })}
                    placeholder="Contoh: Artisan Coffee &amp; Fresh Pastry"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-[#FF9E67]"
                  />
                </div>
              </div>

              {/* Card 2: Pengaturan Kasir & Operasional */}
              <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
                      Operasional Kasir &amp; Metadata
                    </h2>
                    <p className="text-[11.5px] text-neutral-400">
                      Pengaturan nama petugas kasir dan rincian transaksi pada struk
                    </p>
                  </div>
                </div>

                <div className="text-[13px]">
                  <label htmlFor="rc-cashier-override" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                    Override Nama Kasir di Struk
                  </label>
                  <input
                    id="rc-cashier-override"
                    type="text"
                    value={receiptDraft.cashierNameOverride}
                    onChange={(e) => setReceiptDraft({ ...receiptDraft, cashierNameOverride: e.target.value })}
                    placeholder="Kosongkan agar otomatis menggunakan nama kasir yang sedang bertugas"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-[#FF9E67]"
                  />
                  <p className="text-[11.5px] text-neutral-400 mt-1">
                    * Jika dikosongkan, struk otomatis mencetak nama kasir aktif saat transaksi dibuat.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200/60 dark:border-neutral-700/60 cursor-pointer">
                    <input
                      id="rc-show-date"
                      type="checkbox"
                      checked={receiptDraft.showDate}
                      onChange={(e) => setReceiptDraft({ ...receiptDraft, showDate: e.target.checked })}
                      className="rounded accent-[#FF9E67] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200">
                      Cetak Tanggal &amp; Waktu
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200/60 dark:border-neutral-700/60 cursor-pointer">
                    <input
                      id="rc-show-type"
                      type="checkbox"
                      checked={receiptDraft.showOrderType}
                      onChange={(e) => setReceiptDraft({ ...receiptDraft, showOrderType: e.target.checked })}
                      className="rounded accent-[#FF9E67] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200">
                      Cetak Tipe Layanan (Dine in/Take away)
                    </span>
                  </label>
                </div>
              </div>

              {/* Card 3: Format Kertas & Catatan Kaki */}
              <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
                      Format Kertas &amp; Catatan Kaki
                    </h2>
                    <p className="text-[11.5px] text-neutral-400">
                      Pilihan ukuran kertas termal printer dan pesan penutup struk
                    </p>
                  </div>
                </div>

                <div className="text-[13px]">
                  <label htmlFor="rc-paper-width" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                    Lebar Kertas Printer Termal
                  </label>
                  <select
                    id="rc-paper-width"
                    value={receiptDraft.paperWidthMm}
                    onChange={(e) =>
                      setReceiptDraft({ ...receiptDraft, paperWidthMm: Number(e.target.value) as 58 | 80 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-medium focus:outline-none focus:border-[#FF9E67]"
                  >
                    <option value={58}>58 mm — Standar Mini POS &amp; Mobile Bluetooth</option>
                    <option value={80}>80 mm — Printer Kasir Desktop &amp; Dapur Restoran</option>
                  </select>
                </div>

                <div className="text-[13px]">
                  <label htmlFor="rc-footer-note" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                    Catatan Kaki Struk (Pesan Terima Kasih / Media Sosial)
                  </label>
                  <textarea
                    id="rc-footer-note"
                    rows={2}
                    value={receiptDraft.footerNote}
                    onChange={(e) => setReceiptDraft({ ...receiptDraft, footerNote: e.target.value })}
                    placeholder="Contoh: Terima kasih atas kunjungan Anda!\nFollow IG: @purrcoffee.id"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono text-[12.5px] focus:outline-none focus:border-[#FF9E67]"
                  />
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13.5px] font-semibold cursor-pointer shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isReceiptSaved ? 'Struk Berhasil Disimpan!' : 'Simpan Format Struk'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestReceiptThermal}
                  className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-[#FF9E67] text-neutral-700 dark:text-neutral-200 text-[13px] font-medium cursor-pointer transition-all bg-white dark:bg-[#181B20]"
                >
                  <Printer className="w-4 h-4 text-[#FF9E67]" />
                  <span>Uji Cetak Termal</span>
                </button>

                <button
                  type="button"
                  disabled={testingPrint}
                  onClick={handleTestReceiptPdf}
                  className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-[#FF9E67] text-neutral-700 dark:text-neutral-200 text-[13px] font-medium cursor-pointer transition-all bg-white dark:bg-[#181B20]"
                >
                  <FileText className="w-4 h-4 text-[#FF9E67]" />
                  <span>{testingPrint ? 'Membuka PDF...' : 'Uji Cetak PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetReceipt}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-[12.5px] font-medium cursor-pointer ml-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>
            </form>

            {/* Right Column (5 Cols): Photorealistic Live Receipt Preview */}
            <div className="lg:col-span-5 space-y-3 sticky top-4">
              <div className="flex items-center justify-between text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                <span>Pratinjau Fisik ({receiptDraft.paperWidthMm}mm)</span>
                <span className="flex items-center gap-1 text-[#FF9E67]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9E67] animate-ping" />
                  <span>Live Preview</span>
                </span>
              </div>

              {/* Realistic Paper Receipt Card */}
              <div className="relative mx-auto max-w-[340px] bg-[#FEFEFE] text-[#1A1A1A] rounded-xl shadow-lg border border-neutral-200/90 font-mono text-[11.5px] p-5 select-none space-y-3 overflow-hidden">
                {/* Decorative Top Cut Edge */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-repeating-linear-gradient" />

                {/* Receipt Header */}
                <div className="text-center space-y-1 pb-2 border-b border-dashed border-neutral-300">
                  <div className="text-[15px] font-bold tracking-wider uppercase text-neutral-900">
                    {receiptDraft.storeName || "PURR'COFFEE"}
                  </div>
                  <div className="text-[10.5px] text-neutral-600 leading-snug">
                    {receiptDraft.streetAddress || 'Jl. Senopati No. 48, Jakarta'}
                  </div>
                  {receiptDraft.phone && (
                    <div className="text-[10px] text-neutral-500">Telp: {receiptDraft.phone}</div>
                  )}
                  {receiptDraft.headerMessage && (
                    <div className="text-[9.5px] italic text-neutral-500 pt-0.5">
                      {receiptDraft.headerMessage}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-0.5 text-[10.5px] text-neutral-700">
                  <div className="flex justify-between">
                    <span>No. Struk:</span>
                    <span className="font-bold text-neutral-900">ORD-3243</span>
                  </div>
                  {receiptDraft.showDate && (
                    <div className="flex justify-between">
                      <span>Waktu:</span>
                      <span>{new Date().toLocaleDateString('id-ID')} 14:30</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="font-semibold text-neutral-900">
                      {receiptDraft.cashierNameOverride.trim() || 'Albert Flores (Aktif)'}
                    </span>
                  </div>
                  {receiptDraft.showOrderType && (
                    <div className="flex justify-between">
                      <span>Layanan:</span>
                      <span className="font-medium">Dine in (Meja #04)</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Metode Bayar:</span>
                    <span className="font-bold">QRIS (LUNAS)</span>
                  </div>
                </div>

                {/* Itemized Lines */}
                <div className="border-t border-b border-dashed border-neutral-300 py-2 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span>2x Cappucino (Small)</span>
                    <span className="tabular-nums font-semibold">Rp 56.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Coffee Latte (Small)</span>
                    <span className="tabular-nums font-semibold">Rp 32.000</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1 text-[11px] tabular-nums">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal:</span>
                    <span>Rp 88.000</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Diskon Member:</span>
                    <span>-Rp 15.000</span>
                  </div>
                  <div className="flex justify-between font-bold text-[13px] pt-1.5 border-t border-dashed border-neutral-300 text-[#FF9E67]">
                    <span>TOTAL TAGIHAN:</span>
                    <span>Rp 73.000</span>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="border-t border-dashed border-neutral-300 pt-2.5 text-center text-[10px] text-neutral-500 whitespace-pre-line leading-relaxed">
                  {receiptDraft.footerNote || 'Terima kasih atas kunjungan Anda!\nFollow Instagram: @purrcoffee.id'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KEAMANAN PIN ADMIN */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveSecurityPin}
            className="bg-white dark:bg-[#181B20] rounded-2xl p-6 sm:p-7 border border-neutral-200/70 dark:border-neutral-800 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100">
                    Keamanan Mode Admin &amp; PIN Akses
                  </h2>
                  <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
                    Lindungi laporan finansial, perubahan stok, dan konfigurasi dari staf kasir biasa
                  </p>
                </div>
              </div>

              <div className="px-4 py-2 rounded-xl bg-[#FFF6F0] dark:bg-[#241E1A] border border-[#FF9E67]/30 text-[12.5px] flex items-center gap-2">
                <span className="text-neutral-600 dark:text-neutral-300">PIN Demo Aktif:</span>
                <span className="font-mono font-bold text-[14px] text-[#FF9E67] tabular-nums">
                  {adminConfig.demoPin}
                </span>
              </div>
            </div>

            {securityFeedback && (
              <div
                className={`p-3.5 rounded-xl text-[13px] font-medium flex items-center gap-2.5 ${
                  securityFeedback.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400'
                    : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {securityFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{securityFeedback.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div>
                <label htmlFor="sec-current-pin" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                  PIN 6 Digit Saat Ini
                </label>
                <input
                  id="sec-current-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Masukkan PIN aktif"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono tracking-widest tabular-nums focus:outline-none focus:border-[#FF9E67]"
                />
              </div>

              <div>
                <label htmlFor="sec-new-pin" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                  PIN 6 Digit Baru
                </label>
                <input
                  id="sec-new-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Contoh: 654321"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono tracking-widest tabular-nums focus:outline-none focus:border-[#FF9E67]"
                />
              </div>

              <div>
                <label htmlFor="sec-confirm-pin" className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-200">
                  Konfirmasi PIN Baru
                </label>
                <input
                  id="sec-confirm-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ketik ulang PIN baru"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono tracking-widest tabular-nums focus:outline-none focus:border-[#FF9E67]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13.5px] font-semibold cursor-pointer shadow-sm transition-all"
              >
                Perbarui PIN Admin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: PRINTER TERMAL BLUETOOTH */}
      {activeTab === 'printer' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 sm:p-7 border border-neutral-200/70 dark:border-neutral-800 space-y-5">
            <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-[#333333] text-white flex items-center justify-center shrink-0">
                <Bluetooth className="w-5 h-5 text-[#FF9E67]" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100">
                  Printer Termal Bluetooth (ESC/POS)
                </h2>
                <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
                  Koneksi langsung ke printer kasir bluetooth portabel tanpa driver tambahan via Web Bluetooth
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] space-y-1">
                <span className="text-[11.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Status Perangkat
                </span>
                <p className="text-[14px] font-bold text-neutral-900 dark:text-neutral-100">
                  {printerState.deviceName}
                </p>
                <p className="text-[12px] text-neutral-400">
                  {isWebBluetoothSupported()
                    ? 'Protokol Web Bluetooth GATT didukung oleh peramban'
                    : 'Spooler cetak virtual aktif'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] space-y-1">
                <span className="text-[11.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Format Kertas Default
                </span>
                <p className="text-[14px] font-bold text-[#FF9E67]">
                  {receiptDraft.paperWidthMm} mm (ESC/POS)
                </p>
                <p className="text-[12px] text-neutral-400">
                  Ukuran dapat diubah sewaktu-waktu di tab Kustomisasi Struk
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onConnectPrinter}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#333333] hover:bg-neutral-800 text-white text-[13px] font-semibold cursor-pointer shadow-xs transition-all"
              >
                <Bluetooth className="w-4 h-4 text-[#FF9E67]" />
                <span>Pindai &amp; Hubungkan Printer Bluetooth</span>
              </button>

              <button
                type="button"
                onClick={handleTestReceiptThermal}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer transition-all bg-white dark:bg-[#181B20]"
              >
                <Printer className="w-4 h-4 text-[#FF9E67]" />
                <span>Uji Cetak Struk ({receiptDraft.paperWidthMm}mm)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD & CADANGAN DATA */}
      {activeTab === 'cloud' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cloud Backup Card */}
            <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
              <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                  <Cloud className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                    Pencadangan Data Cloud Firestore
                  </h2>
                  <p className="text-[12px] text-neutral-400">
                    Pembaruan terakhir: {lastCloudSyncLabel}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={!canManageCloudApi || backingUp}
                  onClick={handleTriggerBackup}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] disabled:opacity-50 text-white text-[13px] font-semibold cursor-pointer shadow-xs transition-all"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>{backingUp ? 'Mencadangkan...' : 'Buat Checkpoint Cadangan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJsonSnapshot}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer transition-all bg-white dark:bg-[#181B20]"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh JSON Snapshot</span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <h3 className="text-[12.5px] font-semibold text-neutral-500">
                  Riwayat Titik Pencadangan ({backups.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {backups.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-[#F8F8FA] dark:bg-[#22262E] flex items-center justify-between gap-3 text-[12.5px]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                          {b.label}
                        </p>
                        <p className="text-[11px] text-neutral-400 tabular-nums">
                          <span>{b.productCount} SKU</span>
                          <span aria-hidden="true"> · </span>
                          <span>{b.orderCount} pesanan</span>
                          <span aria-hidden="true"> · </span>
                          <span>Omzet {formatMoney(b.totalRevenueCents, currency)}</span>
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11.5px] font-medium shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tersimpan</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interface Preferences */}
            <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
              <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                  <Sun className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                    Preferensi Antarmuka &amp; Mata Uang
                  </h2>
                  <p className="text-[12px] text-neutral-400">
                    Kenyamanan visual staf dan format standar transaksi
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 text-[13.5px]">
                  <div>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                      Mode Gelap (Dark Mode)
                    </p>
                    <p className="text-[12px] text-neutral-400">
                      Mencegah silau saat operasional kafe malam hari
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7F7F8] dark:bg-[#22262E] text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-100 cursor-pointer transition-colors"
                  >
                    {darkMode ? (
                      <Sun className="w-4 h-4 text-[#FF9E67]" />
                    ) : (
                      <Moon className="w-4 h-4 text-[#FF9E67]" />
                    )}
                    <span>{darkMode ? 'Aktif (Gelap)' : 'Terang'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 text-[13.5px]">
                  <div>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                      Standarisasi Mata Uang
                    </p>
                    <p className="text-[12px] text-neutral-400">
                      Format harga Rupiah Indonesia (Rp) aktif di seluruh sistem
                    </p>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-full bg-[#FFF6F0] dark:bg-[#241E1A] text-[#FF9E67] border border-[#FF9E67]/30 text-[12.5px] font-bold font-mono">
                    IDR (Rp)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
