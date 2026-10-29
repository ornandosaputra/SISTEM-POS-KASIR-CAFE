import { useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Download,
  KeyRound,
  Lock,
  Moon,
  Printer,
  Sun,
} from 'lucide-react';
import type {
  CloudBackupRecord,
  CurrencyCode,
  OrderRecord,
  ProductItem,
  StaffMemberRecord,
} from '../types';
import {
  validateNewAdminPin,
  type AdminSecurityConfig,
} from '../utils/adminAuth';
import { formatMoney } from '../utils/posLogic';
import {
  isWebBluetoothSupported,
  printOrderViaThermal,
  type ThermalPrinterState,
} from '../utils/thermalPrinter';

interface SettingsCloudPrinterViewProps {
  isAdminUnlocked: boolean;
  onRequestUnlockAdmin: () => void;
  adminConfig: AdminSecurityConfig;
  onUpdateAdminConfig: (nextConfig: AdminSecurityConfig) => void;
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

export function SettingsCloudPrinterView({
  isAdminUnlocked,
  onRequestUnlockAdmin,
  adminConfig,
  onUpdateAdminConfig,
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
  const [backingUp, setBackingUp] = useState(false);

  // Admin PIN update form state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [securityFeedback, setSecurityFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  if (!isAdminUnlocked) {
    return (
      <div className="p-6 sm:p-10 max-w-xl mx-auto">
        <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-[20px] font-bold text-neutral-900 dark:text-neutral-100">
            Pengaturan Sistem Dikunci
          </h1>
          <p className="text-[13.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Konfigurasi Cloud Backup, Printer Termal, dan PIN Keamanan Admin hanya dapat diakses menggunakan PIN 6 digit Mode Admin.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFF6F0] dark:bg-[#241E1A] border border-[#FF9E67]/30 text-[12.5px]">
            <KeyRound className="w-4 h-4 text-[#FF9E67]" />
            <span className="text-neutral-600 dark:text-neutral-300">PIN Demo:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white tabular-nums">
              {adminConfig.demoPin}
            </span>
          </div>
          <div>
            <button
              type="button"
              onClick={onRequestUnlockAdmin}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13.5px] font-semibold cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Masukkan PIN Admin</span>
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
      store: "Purr'Coffee POS",
      products,
      orders,
      staff: staffList,
      backups,
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

  const handleTestThermalPrint = async () => {
    const sampleOrder: OrderRecord = orders[0] || {
      id: 'test-print',
      orderNumber: 'TEST-58MM',
      orderType: 'Dine in',
      paymentMethod: 'QRIS',
      paymentRef: 'TEST-BLE',
      subtotalCents: 28000,
      discountCents: 0,
      totalCents: 28000,
      itemCount: 1,
      itemsLabel: '1x Cappucino (Small)',
      cashierName: 'Albert Flores',
      status: 'completed',
      createdAtMs: Date.now(),
      lines: [],
    };
    const res = await printOrderViaThermal(sampleOrder, currency);
    onNotify(`Uji cetak berhasil (${res.bytesSent} bytes ESC/POS via ${res.channel}).`);
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

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
          Pengaturan Sistem, Keamanan PIN Admin &amp; Pencadangan Data
        </h1>
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
          Kelola PIN 6 digit Mode Admin, pencadangan data sistem, printer termal Bluetooth ESC/POS, dan preferensi layar.
        </p>
      </div>

      {/* Admin Security PIN Card */}
      <form
        onSubmit={handleSaveSecurityPin}
        className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                Keamanan Mode Admin (Ubah PIN 6 Digit)
              </h2>
              <p className="text-[12px] text-neutral-400">
                Mode Admin dilindungi khusus dengan PIN 6 digit agar staf/karyawan kasir tidak dapat mengakses pengaturan &amp; master CRUD.
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#FFF6F0] dark:bg-[#241E1A] border border-[#FF9E67]/30 text-[12px] flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-300">PIN Demo Saat Ini:</span>
            <span className="font-mono font-bold text-[14px] text-[#1F1F1F] dark:text-white tabular-nums">
              {adminConfig.demoPin}
            </span>
          </div>
        </div>

        {securityFeedback && (
          <div
            className={`p-3 rounded-xl text-[12.5px] font-medium ${
              securityFeedback.type === 'error'
                ? 'bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {securityFeedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
          <div>
            <label htmlFor="sec-current-pin" className="block font-medium mb-1">
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
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="sec-new-pin" className="block font-medium mb-1">
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
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="sec-confirm-pin" className="block font-medium mb-1">
              Konfirmasi PIN 6 Digit Baru
            </label>
            <input
              id="sec-confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Ulangi PIN 6 digit baru"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono tabular-nums"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 rounded-full bg-[#333333] hover:bg-neutral-800 text-white text-[13px] font-semibold cursor-pointer"
        >
          Simpan PIN Baru
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cloud Checkpoint & Backup Card */}
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                  Pencadangan &amp; Checkpoint Data Cloud
                </h2>
                <p className="text-[12px] text-neutral-400">
                  Pembaruan terakhir: {lastCloudSyncLabel} · Penyimpanan otomatis aktif
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              disabled={!canManageCloudApi || backingUp}
              onClick={handleTriggerBackup}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] disabled:opacity-50 text-white text-[13px] font-semibold cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{backingUp ? 'Mencadangkan...' : 'Buat Checkpoint Cadangan Sekarang'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJsonSnapshot}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Snapshot (.json)</span>
            </button>
          </div>

          {/* Backup History List */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
            <h3 className="text-[12.5px] font-semibold text-neutral-500">
              Riwayat Titik Pencadangan ({backups.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
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
                      <span>{b.orderCount} transaksi</span>
                      <span aria-hidden="true"> · </span>
                      <span>Omzet {formatMoney(b.totalRevenueCents, currency)}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11.5px] font-medium shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bluetooth Thermal Printer & Display Card */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#333333] text-white flex items-center justify-center shrink-0">
                <Bluetooth className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                  Printer Termal Bluetooth (ESC/POS 58mm / 80mm)
                </h2>
                <p className="text-[12px] text-neutral-400">
                  Status: {printerState.deviceName} ·{' '}
                  {isWebBluetoothSupported()
                    ? 'Web Bluetooth GATT Didukung'
                    : 'Spooler Virtual Aktif'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onConnectPrinter}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#333333] hover:bg-neutral-800 text-white text-[13px] font-semibold cursor-pointer"
              >
                <Bluetooth className="w-4 h-4 text-[#FF9E67]" />
                <span>Pindai &amp; Hubungkan Printer BLE</span>
              </button>

              <button
                type="button"
                onClick={handleTestThermalPrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Uji Cetak Struk 58mm</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
            <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
              Preferensi Antarmuka &amp; Mata Uang
            </h2>

            <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 text-[13.5px]">
              <div>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Mode Gelap (Dark Mode)
                </p>
                <p className="text-[12px] text-neutral-400">
                  Mengurangi silau layar pada pencahayaan kafe redup
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7F7F8] dark:bg-[#22262E] text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4 text-[#FF9E67]" /> : <Moon className="w-4 h-4 text-[#FF9E67]" />}
                <span>{darkMode ? 'Aktif (Gelap)' : 'Terang (Default)'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 text-[13.5px]">
              <div>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Format Mata Uang Kasir
                </p>
                <p className="text-[12px] text-neutral-400">
                  Seluruh katalog, struk termal, dan laporan menggunakan Rupiah
                </p>
              </div>
              <span className="px-4 py-2 rounded-full bg-[#F7F7F8] dark:bg-[#22262E] text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">
                IDR (Rp)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
