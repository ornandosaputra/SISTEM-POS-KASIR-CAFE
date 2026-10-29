import { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CurrencyCode,
  OrderRecord,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from '../types';
import {
  formatMoney,
  validateOrderEditForm,
  type OrderEditInput,
} from '../utils/posLogic';
import { printOrderViaThermal } from '../utils/thermalPrinter';

interface OrdersViewProps {
  orders: OrderRecord[];
  currency: CurrencyCode;
  canRefund: boolean;
  isAdminUnlocked: boolean;
  onRequestAdminForCrud: (reason: string, onUnlocked?: () => void) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onEditOrder: (orderId: string, updates: OrderEditInput) => void;
  onDeleteOrder: (orderId: string) => void;
  onNotify: (msg: string) => void;
}

export function OrdersView({
  orders,
  currency,
  canRefund,
  isAdminUnlocked,
  onRequestAdminForCrud,
  onUpdateStatus,
  onEditOrder,
  onDeleteOrder,
  onNotify,
}: OrdersViewProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [queryText, setQueryText] = useState('');

  // Edit modal state
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [editOrderType, setEditOrderType] = useState<OrderType>('Dine in');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [editPaymentRef, setEditPaymentRef] = useState('');
  const [editCashierName, setEditCashierName] = useState('');
  const [editStatus, setEditStatus] = useState<OrderStatus>('completed');
  const [editErrors, setEditErrors] = useState<string[]>([]);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' ? true : o.status === filterStatus;
    const q = queryText.trim().toLowerCase();
    const matchQuery =
      q === '' ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.itemsLabel.toLowerCase().includes(q) ||
      o.cashierName.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  const handleReprint = async (order: OrderRecord) => {
    const res = await printOrderViaThermal(order, currency);
    onNotify(`Cetak ulang struk ${order.orderNumber} terkirim ke ${res.channel}.`);
  };

  const openEditOrderModal = (order: OrderRecord) => {
    setEditingOrder(order);
    setEditOrderType(order.orderType);
    setEditPaymentMethod(order.paymentMethod);
    setEditPaymentRef(order.paymentRef);
    setEditCashierName(order.cashierName);
    setEditStatus(order.status);
    setEditErrors([]);
  };

  const handleRequestEditOrder = (order: OrderRecord) => {
    if (!isAdminUnlocked) {
      onRequestAdminForCrud(
        `Masukkan PIN/Login Admin untuk mengedit pesanan ${order.orderNumber}.`,
        () => openEditOrderModal(order)
      );
      return;
    }
    openEditOrderModal(order);
  };

  const handleRequestDeleteOrder = (order: OrderRecord) => {
    if (!isAdminUnlocked) {
      onRequestAdminForCrud(
        `Masukkan PIN/Login Admin untuk menghapus pesanan ${order.orderNumber}.`,
        () => setDeleteTarget(order)
      );
      return;
    }
    setDeleteTarget(order);
  };

  const handleRequestRefund = (order: OrderRecord) => {
    if (!isAdminUnlocked && !canRefund) {
      onRequestAdminForCrud(
        `Otorisasi PIN Admin diperlukan untuk refund pesanan ${order.orderNumber}.`,
        () => onUpdateStatus(order.id, 'refunded')
      );
      return;
    }
    onUpdateStatus(order.id, 'refunded');
  };

  const handleSubmitOrderEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const check = validateOrderEditForm({
      orderType: editOrderType,
      paymentMethod: editPaymentMethod,
      paymentRef: editPaymentRef,
      cashierName: editCashierName,
      status: editStatus,
    });

    if (!check.valid || !check.parsed) {
      setEditErrors(check.errors);
      return;
    }

    onEditOrder(editingOrder.id, check.parsed);
    setEditingOrder(null);
    setEditErrors([]);
  };

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            Antrean, Riwayat &amp; CRUD Pesanan Real-Time
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Pantau antrean pesanan kasir, cetak ulang struk termal, serta kelola koreksi/refund/hapus di Mode Admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all', label: `Semua (${orders.length})` },
              {
                id: 'preparing',
                label: `Diproses (${orders.filter((o) => o.status === 'preparing').length})`,
              },
              {
                id: 'completed',
                label: `Selesai (${orders.filter((o) => o.status === 'completed').length})`,
              },
              {
                id: 'refunded',
                label: `Refund (${orders.filter((o) => o.status === 'refunded').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-2 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-[#FF9E67] text-white'
                  : 'bg-white dark:bg-[#181B20] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <label htmlFor="orders-search" className="sr-only">
            Cari nomor pesanan
          </label>
          <input
            id="orders-search"
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Cari nomor order, item, atau kasir..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-800 text-[13.5px] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-[#FF9E67]"
          />
        </div>

        {!isAdminUnlocked && (
          <div className="flex items-center gap-2 text-[12px] text-neutral-500 dark:text-neutral-400">
            <Lock className="w-3.5 h-3.5 text-[#FF9E67] shrink-0" />
            <span>Edit, Refund &amp; Hapus transaksi memerlukan otorisasi PIN Admin</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#181B20] rounded-2xl p-10 border border-neutral-200/70 dark:border-neutral-800 text-center text-[13.5px] text-neutral-400">
            Tidak ada pesanan yang cocok dengan filter saat ini.
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-mono font-bold text-[15px] text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {order.orderNumber}
                  </span>
                  <span aria-hidden="true" className="text-neutral-300">
                    ·
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-300">{order.orderType}</span>
                  <span aria-hidden="true" className="text-neutral-300">
                    ·
                  </span>
                  <span className="text-neutral-500">
                    {order.paymentMethod} ({order.paymentRef})
                  </span>
                  <span aria-hidden="true" className="text-neutral-300">
                    ·
                  </span>
                  <span
                    className={`font-semibold ${
                      order.status === 'completed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : order.status === 'preparing'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {order.status === 'completed'
                      ? 'Selesai'
                      : order.status === 'preparing'
                        ? 'Sedang Disiapkan'
                        : 'Telah Direfund'}
                  </span>
                </div>

                <p className="text-[13.5px] text-neutral-700 dark:text-neutral-200 truncate">
                  {order.itemsLabel}
                </p>

                <p className="text-[12px] text-neutral-400 tabular-nums">
                  <span>Kasir: {order.cashierName}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{new Date(order.createdAtMs).toLocaleString('id-ID')}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-[16px] font-bold text-[#FF9E67] tabular-nums mr-1.5">
                  {formatMoney(order.totalCents, currency)}
                </span>

                {order.status === 'preparing' && (
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(order.id, 'completed')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tandai Selesai</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleReprint(order)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Struk</span>
                </button>

                {order.status !== 'refunded' && (
                  <button
                    type="button"
                    onClick={() => handleRequestRefund(order)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-red-200 dark:border-red-900/50 text-[12px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refund</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRequestEditOrder(order)}
                  aria-label={`Edit pesanan ${order.orderNumber}`}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRequestDeleteOrder(order)}
                  aria-label={`Hapus pesanan ${order.orderNumber}`}
                  className="p-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-600 hover:border-red-300 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setEditingOrder(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSubmitOrderEdit}
            className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2
                id="edit-order-modal-title"
                className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100"
              >
                Edit Pesanan · {editingOrder.orderNumber}
              </h2>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                aria-label="Tutup form edit pesanan"
                className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-[12px] text-red-600 dark:text-red-400 space-y-1">
                {editErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}

            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-order-type" className="block font-medium mb-1">
                    Tipe Layanan
                  </label>
                  <select
                    id="edit-order-type"
                    value={editOrderType}
                    onChange={(e) => setEditOrderType(e.target.value as OrderType)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="Delivery">Delivery</option>
                    <option value="Dine in">Dine in</option>
                    <option value="Take away">Take away</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-order-status" className="block font-medium mb-1">
                    Status Pesanan
                  </label>
                  <select
                    id="edit-order-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="preparing">Diproses</option>
                    <option value="completed">Selesai</option>
                    <option value="refunded">Direfund</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-order-method" className="block font-medium mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    id="edit-order-method"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="QRIS">QRIS</option>
                    <option value="E-Wallet">E-Wallet</option>
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-order-ref" className="block font-medium mb-1">
                    Referensi Bayar
                  </label>
                  <input
                    id="edit-order-ref"
                    type="text"
                    value={editPaymentRef}
                    onChange={(e) => setEditPaymentRef(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-order-cashier" className="block font-medium mb-1">
                  Nama Kasir Penanggung Jawab
                </label>
                <input
                  id="edit-order-cashier"
                  type="text"
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 rounded-full text-[13px] text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13px] font-semibold cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-App Delete Order Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-2xl">
            <h2
              id="delete-order-modal-title"
              className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100"
            >
              Hapus Riwayat Pesanan?
            </h2>
            <p className="text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Transaksi <strong>{deleteTarget.orderNumber}</strong> senilai{' '}
              <strong>{formatMoney(deleteTarget.totalCents, currency)}</strong> akan dihapus secara permanen dari daftar riwayat dan laporan.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteOrder(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold cursor-pointer"
              >
                Konfirmasi Hapus Pesanan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
