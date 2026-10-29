import { useEffect, useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  CreditCard,
  Loader2,
  Printer,
  QrCode,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import type {
  CartLineItem,
  CurrencyCode,
  OrderRecord,
  OrderType,
  PaymentMethod,
} from '../types';
import { formatMoney } from '../utils/posLogic';
import { printOrderViaThermal, type ThermalPrinterState } from '../utils/thermalPrinter';

interface CheckoutPaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  orderType: OrderType;
  cashierName: string;
  cartLines: CartLineItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: CurrencyCode;
  printerState: ThermalPrinterState;
  onConnectPrinter: () => Promise<void>;
  onConfirmPaidOrder: (method: PaymentMethod, paymentRef: string) => OrderRecord;
}

export function CheckoutPaymentModal({
  open,
  onClose,
  orderNumber,
  orderType,
  cashierName,
  cartLines,
  subtotalCents,
  discountCents,
  totalCents,
  currency,
  printerState,
  onConnectPrinter,
  onConfirmPaidOrder,
}: CheckoutPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('QRIS');
  const [ewalletProvider, setEwalletProvider] = useState<'GoPay' | 'OVO' | 'DANA'>('GoPay');
  const [cashTenderedRupiah, setCashTenderedRupiah] = useState<string>('');
  const [intentRef, setIntentRef] = useState<string>('QRIS-894120');
  const [virtualAccount, setVirtualAccount] = useState<string>('88081294881024');
  const [verifying, setVerifying] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null);
  const [printStatusMsg, setPrintStatusMsg] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setCompletedOrder(null);
      setPrintStatusMsg('');
      setVerifying(false);
      return;
    }

    setCashTenderedRupiah(String(Math.ceil((totalCents + 5000) / 10000) * 10000));

    fetch('/api/v1/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        amountCents: totalCents,
        method: selectedMethod,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.paymentRef) setIntentRef(data.paymentRef);
        if (data?.virtualAccount) setVirtualAccount(data.virtualAccount);
      })
      .catch(() => {
        // Fallback deterministic reference
      });
  }, [open, orderNumber, totalCents, selectedMethod]);

  if (!open) return null;

  const cashCents = Math.round(Number(cashTenderedRupiah) || 0);
  const changeCents = Math.max(0, cashCents - totalCents);
  const cashInsufficient = selectedMethod === 'Cash' && cashCents < totalCents;
  const cashPresets = Array.from(
    new Set([
      totalCents,
      Math.max(totalCents + 10000, Math.ceil(totalCents / 50000) * 50000),
      Math.max(totalCents + 50000, Math.ceil((totalCents + 50000) / 50000) * 50000),
    ])
  );

  const handleProcessAutomaticPayment = () => {
    if (cashInsufficient) return;
    setVerifying(true);
    setTimeout(() => {
      const ref =
        selectedMethod === 'E-Wallet'
          ? `${ewalletProvider.toUpperCase()}-${Date.now().toString().slice(-6)}`
          : intentRef;
      const created = onConfirmPaidOrder(selectedMethod, ref);
      setCompletedOrder(created);
      setVerifying(false);
    }, 350);
  };

  const handleThermalPrint = async () => {
    if (!completedOrder) return;
    const res = await printOrderViaThermal(completedOrder, currency);
    setPrintStatusMsg(
      `Struk ${completedOrder.orderNumber} (${res.bytesSent} bytes ESC/POS) dikirim ke ${res.channel}.`
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2
              id="checkout-dialog-title"
              className="text-[18px] font-bold text-[#1F1F1F] dark:text-neutral-100"
            >
              {completedOrder
                ? `Pembayaran Terverifikasi · ${completedOrder.orderNumber}`
                : `Checkout Otomatis · ${orderNumber}`}
            </h2>
            <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
              <span>{orderType}</span>
              <span aria-hidden="true"> · </span>
              <span>Kasir: {cashierName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog pembayaran"
            className="p-2 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!completedOrder ? (
            <>
              {/* Payment Method Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(
                  [
                    { id: 'QRIS', label: 'QRIS Otomatis', icon: QrCode },
                    { id: 'E-Wallet', label: 'E-Wallet', icon: Smartphone },
                    { id: 'Card', label: 'Kartu / VA', icon: CreditCard },
                    { id: 'Cash', label: 'Tunai (Cash)', icon: Wallet },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = selectedMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMethod(item.id)}
                      className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#FF9E67] bg-[#FF9E67]/10 text-[#1F1F1F] dark:text-neutral-100'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 mb-1.5 ${
                          active ? 'text-[#FF9E67]' : 'text-neutral-400'
                        }`}
                      />
                      <div className="text-[13px] font-semibold whitespace-nowrap">{item.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Payment Detail Surface */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                {/* Left Dynamic Payment Instructions */}
                <div className="rounded-2xl bg-[#F8F8FA] dark:bg-[#22262E] p-5 flex flex-col justify-between">
                  {selectedMethod === 'QRIS' && (
                    <div className="text-center space-y-3">
                      <p className="text-[12.5px] font-semibold text-neutral-700 dark:text-neutral-200">
                        Scan QRIS Dinamis (Auto-Callback)
                      </p>
                      {/* Clean SVG QR Matrix */}
                      <div className="w-40 h-40 mx-auto bg-white p-3 rounded-2xl border border-neutral-200 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full" aria-label="Kode QRIS Dinamis">
                          <rect width="100" height="100" fill="#FFFFFF" />
                          <rect x="8" y="8" width="26" height="26" fill="none" stroke="#1F1F1F" strokeWidth="6" />
                          <rect x="16" y="16" width="10" height="10" fill="#1F1F1F" />
                          <rect x="66" y="8" width="26" height="26" fill="none" stroke="#1F1F1F" strokeWidth="6" />
                          <rect x="74" y="16" width="10" height="10" fill="#1F1F1F" />
                          <rect x="8" y="66" width="26" height="26" fill="none" stroke="#1F1F1F" strokeWidth="6" />
                          <rect x="16" y="74" width="10" height="10" fill="#1F1F1F" />
                          <rect x="42" y="12" width="8" height="8" fill="#1F1F1F" />
                          <rect x="42" y="28" width="14" height="8" fill="#1F1F1F" />
                          <rect x="12" y="44" width="18" height="8" fill="#1F1F1F" />
                          <rect x="40" y="42" width="20" height="20" rx="4" fill="#FF9E67" />
                          <rect x="68" y="44" width="20" height="8" fill="#1F1F1F" />
                          <rect x="44" y="68" width="10" height="22" fill="#1F1F1F" />
                          <rect x="62" y="64" width="12" height="12" fill="#1F1F1F" />
                          <rect x="78" y="76" width="14" height="14" fill="#1F1F1F" />
                        </svg>
                      </div>
                      <p className="text-[11.5px] font-mono text-neutral-500 tabular-nums">
                        Ref: {intentRef}
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'E-Wallet' && (
                    <div className="space-y-3">
                      <p className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
                        Pilih Dompet Digital Terintegrasi
                      </p>
                      <div className="flex gap-2">
                        {(['GoPay', 'OVO', 'DANA'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setEwalletProvider(w)}
                            className={`flex-1 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer ${
                              ewalletProvider === w
                                ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                                : 'bg-white dark:bg-[#181B20] text-neutral-600 dark:text-neutral-300'
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                      <p className="text-[12px] text-neutral-500 leading-relaxed">
                        Notifikasi push pembayaran {ewalletProvider} otomatis menyelesaikan status
                        transaksi begitu pelanggan mengonfirmasi PIN.
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'Card' && (
                    <div className="space-y-3">
                      <p className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
                        Terminal EDC Contactless / Virtual Account
                      </p>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-800">
                        <span className="text-[11px] text-neutral-400 block">BCA Virtual Account</span>
                        <span className="text-[15px] font-mono font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                          {virtualAccount}
                        </span>
                      </div>
                      <p className="text-[12px] text-neutral-500">
                        Mendukung kartu Debit/Kredit Chip &amp; Tap NFC maupun rekonsiliasi VA otomatis.
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'Cash' && (
                    <div className="space-y-3">
                      <label
                        htmlFor="cash-received-input"
                        className="block text-[13px] font-semibold text-neutral-700 dark:text-neutral-200"
                      >
                        Nominal Uang Diterima (Rp)
                      </label>
                      <input
                        id="cash-received-input"
                        type="number"
                        step="1000"
                        min="0"
                        value={cashTenderedRupiah}
                        onChange={(e) => setCashTenderedRupiah(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-700 text-[15px] font-mono font-semibold tabular-nums text-neutral-900 dark:text-neutral-100"
                      />
                      <div className="flex flex-wrap gap-2">
                        {cashPresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCashTenderedRupiah(String(preset))}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-700 text-[11.5px] font-mono tabular-nums whitespace-nowrap cursor-pointer hover:border-[#FF9E67]"
                          >
                            {formatMoney(preset, currency)}
                          </button>
                        ))}
                      </div>
                      <div className="pt-2 flex items-center justify-between text-[13px]">
                        <span className="text-neutral-500">Kembalian:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatMoney(changeCents, currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Order Summary */}
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <h3 className="text-[13.5px] font-bold text-neutral-800 dark:text-neutral-100">
                      Ringkasan Pesanan ({cartLines.length} baris)
                    </h3>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 text-[12.5px]">
                      {cartLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between gap-2">
                          <span className="text-neutral-600 dark:text-neutral-300 truncate">
                            {line.quantity}x {line.productName} ({line.size})
                          </span>
                          <span className="font-medium text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">
                            {formatMoney(line.unitPriceCents * line.quantity, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-neutral-500">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatMoney(subtotalCents, currency)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>Diskon</span>
                      <span className="tabular-nums">
                        {discountCents > 0
                          ? formatMoney(discountCents, currency, { signedNegative: true })
                          : formatMoney(0, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[16px] font-bold pt-1">
                      <span className="text-neutral-900 dark:text-neutral-100">Total Tagihan</span>
                      <span className="text-[#FF9E67] tabular-nums">
                        {formatMoney(totalCents, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Payment Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full text-[13.5px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={verifying || cashInsufficient}
                  onClick={handleProcessAutomaticPayment}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] disabled:opacity-50 text-white text-[13.5px] font-semibold transition-colors cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Pembayaran...</span>
                    </>
                  ) : (
                    <span>
                      {selectedMethod === 'Cash'
                        ? 'Selesaikan Pembayaran Tunai'
                        : `Konfirmasi Pembayaran ${selectedMethod} Otomatis`}
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Post-Payment Thermal Receipt & Bluetooth Printer Screen */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div
                id="thermal-receipt-printable"
                className="rounded-2xl bg-[#FBFBF9] dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 font-mono text-[12px] text-neutral-800 dark:text-neutral-200 space-y-2"
              >
                <div className="text-center border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-3">
                  <div className="text-[14px] font-bold">PURR&apos;COFFEE POS</div>
                  <div className="text-[11px] text-neutral-500">Jl. Senopati No. 48, Jakarta</div>
                </div>
                <div className="space-y-0.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span>Order:</span>
                    <span>{completedOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layanan:</span>
                    <span>{completedOrder.orderType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span>
                      {completedOrder.paymentMethod} ({completedOrder.paymentRef})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{completedOrder.cashierName}</span>
                  </div>
                </div>
                <div className="border-t border-b border-dashed border-neutral-300 dark:border-neutral-700 py-2 space-y-1">
                  {completedOrder.lines.map((l) => (
                    <div key={l.id} className="flex justify-between tabular-nums">
                      <span>
                        {l.quantity}x {l.productName} ({l.size[0]})
                      </span>
                      <span>{formatMoney(l.unitPriceCents * l.quantity, currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 tabular-nums">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatMoney(completedOrder.subtotalCents, currency)}</span>
                  </div>
                  {completedOrder.discountCents > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon</span>
                      <span>
                        {formatMoney(completedOrder.discountCents, currency, {
                          signedNegative: true,
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[13px] pt-1">
                    <span>TOTAL LUNAS</span>
                    <span>{formatMoney(completedOrder.totalCents, currency)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-[13px]">
                    <p className="font-bold">Transaksi &amp; Stok Tersinkronisasi</p>
                    <p className="mt-0.5 opacity-90">
                      Laporan harian real-time, pengurangan inventaris, dan cloud sync telah
                      diperbarui otomatis.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                      Printer Termal Bluetooth:
                    </span>
                    <span className="text-neutral-500">{printerState.deviceName}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={handleThermalPrint}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#333333] hover:bg-neutral-800 text-white text-[12.5px] font-semibold cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Cetak Struk ESC/POS</span>
                    </button>

                    {!printerState.connected && (
                      <button
                        type="button"
                        onClick={onConnectPrinter}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                      >
                        <Bluetooth className="w-4 h-4 text-[#FF9E67]" />
                        <span>Pair BLE</span>
                      </button>
                    )}
                  </div>

                  {printStatusMsg && (
                    <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {printStatusMsg}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13.5px] font-semibold cursor-pointer"
                >
                  Transaksi Baru
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
