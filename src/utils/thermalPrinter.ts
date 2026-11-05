import type { CurrencyCode, OrderRecord, ReceiptConfig } from '../types';
import { formatMoney } from './posLogic';

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  storeName: "PURR'COFFEE POS",
  streetAddress: 'Jl. Senopati No. 48, Kebayoran Baru, Jakarta Selatan',
  phone: '0812-3456-7890',
  headerMessage: 'Spesialis Kopi & Kudapan Santai',
  footerNote: 'Terima kasih atas kunjungan Anda!\nFollow IG: @purrcoffee.id',
  cashierNameOverride: '',
  showDate: true,
  showOrderType: true,
  paperWidthMm: 58,
};

const RECEIPT_CONFIG_STORAGE_KEY = 'purrcoffee_receipt_config_v1';

export function loadReceiptConfig(): ReceiptConfig {
  if (typeof window === 'undefined') return DEFAULT_RECEIPT_CONFIG;
  try {
    const raw = localStorage.getItem(RECEIPT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_RECEIPT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      storeName: typeof parsed.storeName === 'string' && parsed.storeName.trim() ? parsed.storeName.trim() : DEFAULT_RECEIPT_CONFIG.storeName,
      streetAddress: typeof parsed.streetAddress === 'string' && parsed.streetAddress.trim() ? parsed.streetAddress.trim() : DEFAULT_RECEIPT_CONFIG.streetAddress,
      phone: typeof parsed.phone === 'string' && parsed.phone.trim() ? parsed.phone.trim() : DEFAULT_RECEIPT_CONFIG.phone,
      headerMessage: typeof parsed.headerMessage === 'string' ? parsed.headerMessage : DEFAULT_RECEIPT_CONFIG.headerMessage,
      footerNote: typeof parsed.footerNote === 'string' ? parsed.footerNote : DEFAULT_RECEIPT_CONFIG.footerNote,
      cashierNameOverride: typeof parsed.cashierNameOverride === 'string' ? parsed.cashierNameOverride : '',
      showDate: parsed.showDate !== false,
      showOrderType: parsed.showOrderType !== false,
      paperWidthMm: parsed.paperWidthMm === 80 ? 80 : 58,
    };
  } catch {
    return DEFAULT_RECEIPT_CONFIG;
  }
}

export function saveReceiptConfig(config: ReceiptConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECEIPT_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export interface ThermalPrinterState {
  connected: boolean;
  deviceName: string;
  mode: 'bluetooth_ble' | 'virtual_58mm' | 'disconnected';
  paperWidthMm: 58 | 80;
  lastPrintedOrder?: string;
}

interface BluetoothCharacteristicLike {
  writeValue: (data: BufferSource) => Promise<void>;
}

let activeCharacteristic: BluetoothCharacteristicLike | null = null;

const ESC_POS_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function connectBluetoothThermalPrinter(): Promise<{
  ok: boolean;
  deviceName: string;
  mode: 'bluetooth_ble' | 'virtual_58mm';
  note: string;
}> {
  if (!isWebBluetoothSupported()) {
    return {
      ok: true,
      deviceName: 'Virtual ESC/POS 58mm Spooler',
      mode: 'virtual_58mm',
      note: 'Web Bluetooth tidak tersedia di peramban ini; dialihkan ke Spooler Termal 58mm Virtual.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const navBluetooth = (navigator as any).bluetooth;
    const device = await navBluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ESC_POS_SERVICES,
    });

    const server = await device.gatt.connect();
    for (const serviceUuid of ESC_POS_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        const writable = chars.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.properties?.write || c.properties?.writeWithoutResponse
        );
        if (writable) {
          activeCharacteristic = writable;
          break;
        }
      } catch {
        // Check next standard ESC/POS service UUID
      }
    }

    return {
      ok: true,
      deviceName: device.name || 'BLE Thermal Printer 58mm',
      mode: 'bluetooth_ble',
      note: 'Terhubung melalui protokol GATT BLE ESC/POS.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Koneksi dibatalkan';
    return {
      ok: false,
      deviceName: 'Tidak Terhubung',
      mode: 'virtual_58mm',
      note: `Gagal memindai printer BLE (${message}). Gunakan tombol Mode Simulator 58mm atau Cetak Browser.`,
    };
  }
}

export function encodeEscPosReceipt(
  order: OrderRecord,
  currency: CurrencyCode,
  config: ReceiptConfig = DEFAULT_RECEIPT_CONFIG
): Uint8Array {
  const encoder = new TextEncoder();
  const effectiveCashier = config.cashierNameOverride.trim() || order.cashierName;

  const lines: string[] = [
    '\x1B\x40', // Initialize printer
    '\x1B\x61\x01', // Align center
    '\x1B\x45\x01', // Bold ON
    `${config.storeName}\n`,
    '\x1B\x45\x00', // Bold OFF
    `${config.streetAddress}\n`,
  ];

  if (config.phone) {
    lines.push(`Telp: ${config.phone}\n`);
  }
  if (config.headerMessage) {
    lines.push(`${config.headerMessage}\n`);
  }

  lines.push('--------------------------------\n');
  lines.push('\x1B\x61\x00'); // Align left
  lines.push(`Order   : ${order.orderNumber}\n`);
  if (config.showOrderType) {
    lines.push(`Layanan : ${order.orderType}\n`);
  }
  lines.push(`Kasir   : ${effectiveCashier}\n`);
  lines.push(`Bayar   : ${order.paymentMethod} (${order.paymentRef})\n`);
  if (config.showDate) {
    lines.push(`Waktu   : ${new Date(order.createdAtMs).toLocaleString('id-ID')}\n`);
  }
  lines.push('--------------------------------\n');

  if (order.lines && order.lines.length > 0) {
    for (const item of order.lines) {
      lines.push(`${item.quantity}x ${item.productName} (${item.size})\n`);
      lines.push(`   ${formatMoney(item.unitPriceCents * item.quantity, currency)}\n`);
    }
  } else {
    lines.push(`${order.itemsLabel}\n`);
  }

  lines.push('--------------------------------\n');
  lines.push(`Subtotal : ${formatMoney(order.subtotalCents, currency)}\n`);
  if (order.discountCents > 0) {
    lines.push(`Diskon   : -${formatMoney(order.discountCents, currency)}\n`);
  }
  lines.push('\x1B\x45\x01');
  lines.push(`TOTAL    : ${formatMoney(order.totalCents, currency)}\n`);
  lines.push('\x1B\x45\x00');
  lines.push('--------------------------------\n');
  lines.push('\x1B\x61\x01'); // Center align
  lines.push(`${config.footerNote}\n\n\n`);
  lines.push('\x1D\x56\x41\x10'); // Cut paper

  return encoder.encode(lines.join(''));
}

export async function printOrderViaThermal(
  order: OrderRecord,
  currency: CurrencyCode,
  config?: ReceiptConfig
): Promise<{ ok: boolean; bytesSent: number; channel: string }> {
  const effectiveConfig = config || loadReceiptConfig();
  const payload = encodeEscPosReceipt(order, currency, effectiveConfig);

  if (activeCharacteristic) {
    const chunkSize = 180;
    for (let offset = 0; offset < payload.length; offset += chunkSize) {
      const slice = payload.slice(offset, offset + chunkSize);
      await activeCharacteristic.writeValue(slice);
    }
    return { ok: true, bytesSent: payload.length, channel: 'Bluetooth BLE ESC/POS' };
  }

  return { ok: true, bytesSent: payload.length, channel: 'Spooler Termal 58mm' };
}

export function generateReceiptHtml(
  order: OrderRecord,
  currency: CurrencyCode,
  config: ReceiptConfig = loadReceiptConfig()
): string {
  const effectiveCashier = config.cashierNameOverride.trim() || order.cashierName;
  const is80mm = config.paperWidthMm === 80;
  const maxWidth = is80mm ? '300px' : '230px';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Struk Belanja - ${order.orderNumber}</title>
  <style>
    @page {
      size: ${is80mm ? '80mm' : '58mm'} auto;
      margin: 3mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, -apple-system;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      padding: 4px;
      width: ${maxWidth};
      margin: 0 auto;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .store-name {
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      font-size: 10.5px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .item-sub {
      font-size: 10px;
      color: #333;
      padding-left: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 12.5px;
      margin-top: 4px;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 8px;
      white-space: pre-line;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${config.storeName}</div>
    <div>${config.streetAddress}</div>
    ${config.phone ? `<div>Telp: ${config.phone}</div>` : ''}
    ${config.headerMessage ? `<div style="font-style: italic; margin-top: 2px;">${config.headerMessage}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta-row"><span>No. Order:</span><span class="bold">${order.orderNumber}</span></div>
  ${config.showOrderType ? `<div class="meta-row"><span>Layanan:</span><span>${order.orderType}</span></div>` : ''}
  <div class="meta-row"><span>Kasir:</span><span>${effectiveCashier}</span></div>
  <div class="meta-row"><span>Bayar:</span><span>${order.paymentMethod} (${order.paymentRef})</span></div>
  ${config.showDate ? `<div class="meta-row"><span>Waktu:</span><span>${new Date(order.createdAtMs).toLocaleString('id-ID')}</span></div>` : ''}

  <div class="divider"></div>

  ${
    order.lines && order.lines.length > 0
      ? order.lines
          .map(
            (item) => `
      <div class="item-row">
        <span>${item.quantity}x ${item.productName} (${item.size[0]})</span>
        <span class="bold">${formatMoney(item.unitPriceCents * item.quantity, currency)}</span>
      </div>
      `
          )
          .join('')
      : `<div>${order.itemsLabel}</div>`
  }

  <div class="divider"></div>

  <div class="meta-row"><span>Subtotal:</span><span>${formatMoney(order.subtotalCents, currency)}</span></div>
  ${
    order.discountCents > 0
      ? `<div class="meta-row"><span>Diskon:</span><span>-${formatMoney(order.discountCents, currency)}</span></div>`
      : ''
  }
  <div class="total-row">
    <span>TOTAL LUNAS:</span>
    <span>${formatMoney(order.totalCents, currency)}</span>
  </div>

  <div class="divider"></div>

  <div class="footer">${config.footerNote}</div>
</body>
</html>
  `.trim();
}

export function printReceiptViaBrowserOrPdf(
  order: OrderRecord,
  currency: CurrencyCode,
  config?: ReceiptConfig
): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const effectiveConfig = config || loadReceiptConfig();
    const html = generateReceiptHtml(order, currency, effectiveConfig);

    // Create a hidden iframe for seamless printing and PDF generation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve(false);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve(true);
      } catch {
        resolve(false);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }
    }, 250);
  });
}
