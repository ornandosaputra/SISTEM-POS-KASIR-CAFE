import type { CurrencyCode, OrderRecord } from '../types';
import { formatMoney } from './posLogic';

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

export function encodeEscPosReceipt(order: OrderRecord, currency: CurrencyCode): Uint8Array {
  const encoder = new TextEncoder();
  const lines: string[] = [
    '\x1B\x40', // Initialize printer
    '\x1B\x61\x01', // Align center
    '\x1B\x45\x01', // Bold ON
    "PURR'COFFEE POS\n",
    '\x1B\x45\x00', // Bold OFF
    'Jl. Senopati No. 48, Jakarta\n',
    '--------------------------------\n',
    '\x1B\x61\x00', // Align left
    `Order   : ${order.orderNumber}\n`,
    `Tipe    : ${order.orderType}\n`,
    `Kasir   : ${order.cashierName}\n`,
    `Bayar   : ${order.paymentMethod} (${order.paymentRef})\n`,
    `Waktu   : ${new Date(order.createdAtMs).toLocaleString('id-ID')}\n`,
    '--------------------------------\n',
  ];

  if (order.lines.length > 0) {
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
  lines.push('\x1B\x61\x01');
  lines.push('Terima kasih atas kunjungan Anda\n\n\n');
  lines.push('\x1D\x56\x41\x10'); // Cut paper

  return encoder.encode(lines.join(''));
}

export async function printOrderViaThermal(
  order: OrderRecord,
  currency: CurrencyCode
): Promise<{ ok: boolean; bytesSent: number; channel: string }> {
  const payload = encodeEscPosReceipt(order, currency);

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
