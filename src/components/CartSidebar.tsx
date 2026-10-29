import { useState } from 'react';
import { Lock, Minus, MoreVertical, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type {
  CartLineItem,
  CurrencyCode,
  OrderType,
  StaffMemberRecord,
} from '../types';
import {
  calculateCartTotals,
  formatMoney,
  type DiscountMode,
} from '../utils/posLogic';
import { ALBERT_AVATAR_URL, ProductVisual } from './ProductVisual';

const ORDER_TYPES: OrderType[] = ['Delivery', 'Dine in', 'Take away'];

interface CartSidebarProps {
  activeStaff: StaffMemberRecord;
  allStaff: StaffMemberRecord[];
  isAdminUnlocked: boolean;
  onSwitchStaff: (staffId: string) => void;
  onLockAdmin: () => void;
  cloudUserEmail?: string | null;
  nextOrderNumber: string;
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  cartLines: CartLineItem[];
  discountMode: DiscountMode;
  onChangeDiscountMode: (mode: DiscountMode) => void;
  currency: CurrencyCode;
  canCheckout: boolean;
  onUpdateLineQty: (lineId: string, nextQty: number) => void;
  onClearCart: () => void;
  onOpenCheckout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function CartSidebar({
  activeStaff,
  allStaff,
  isAdminUnlocked,
  onSwitchStaff,
  onLockAdmin,
  cloudUserEmail,
  nextOrderNumber,
  orderType,
  onChangeOrderType,
  cartLines,
  discountMode,
  onChangeDiscountMode,
  currency,
  canCheckout,
  onUpdateLineQty,
  onClearCart,
  onOpenCheckout,
  mobileOpen,
  onCloseMobile,
}: CartSidebarProps) {
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const totals = calculateCartTotals(cartLines, discountMode);

  const panelBody = (
    <div className="flex flex-col h-full bg-white dark:bg-[#181B20] border-l border-neutral-100 dark:border-neutral-800/80">
      {/* Top User Profile Header matching Albert Flores in Purr'Coffee reference */}
      <div className="relative px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={ALBERT_AVATAR_URL}
            alt={activeStaff.name}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-700"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[#1F1F1F] dark:text-neutral-100 truncate">
              {activeStaff.name}
            </p>
            <p className="text-[12px] text-[#9A9A9A] dark:text-neutral-400 truncate">
              {cloudUserEmail || activeStaff.email}
              <span aria-hidden="true"> · </span>
              <span>{activeStaff.staffRole}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setStaffMenuOpen((v) => !v)}
            aria-label="Ganti operator kasir aktif"
            aria-expanded={staffMenuOpen}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {mobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Tutup panel keranjang"
              className="xl:hidden p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Multi-User Staff Switcher Popover */}
        {staffMenuOpen && (
          <div className="absolute right-6 top-16 z-30 w-68 rounded-2xl bg-white dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 shadow-lg p-2 space-y-1">
            <p className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400">
              Pilih Operator Aktif (RBAC)
            </p>
            {allStaff
              .filter((s) => s.active)
              .map((staff) => {
                const requiresPin = staff.staffRole === 'Admin' && !isAdminUnlocked;
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => {
                      onSwitchStaff(staff.id);
                      setStaffMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-[13px] flex items-center justify-between transition-colors cursor-pointer ${
                      staff.id === activeStaff.id
                        ? 'bg-[#FF9E67]/15 text-[#FF9E67] font-semibold'
                        : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {requiresPin && <Lock className="w-3 h-3 text-[#FF9E67] shrink-0" />}
                      <span className="truncate">{staff.name}</span>
                    </span>
                    <span className="text-[11px] text-neutral-400 shrink-0 ml-2">
                      {requiresPin ? 'Admin · PIN' : staff.staffRole}
                    </span>
                  </button>
                );
              })}

            {isAdminUnlocked && (
              <div className="pt-1 mt-1 border-t border-neutral-100 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => {
                    onLockAdmin();
                    setStaffMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Kunci Mode Admin</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Header & Order #3243 */}
      <div className="px-6 pt-6 pb-3 flex items-baseline justify-between">
        <h2 className="text-[19px] font-bold text-[#1F1F1F] dark:text-neutral-100">Cart</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-[#ADADAD] dark:text-neutral-400 tabular-nums">
            Order #{nextOrderNumber.replace(/^ORD-/, '')}
          </span>
          {cartLines.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              aria-label="Kosongkan keranjang"
              className="p-1 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Delivery / Dine in / Take away Selector */}
      <div className="px-6 pb-4 flex items-center gap-2">
        {ORDER_TYPES.map((type) => {
          const active = orderType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChangeOrderType(type)}
              className={`flex-1 py-2 px-3 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-white dark:bg-[#22262E] text-[#555555] dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto px-6 py-2 divide-y divide-neutral-100 dark:divide-neutral-800/80">
        {cartLines.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F6F6F6] dark:bg-[#22262E] mx-auto flex items-center justify-center text-neutral-400 mb-3">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <p className="text-[14px] font-semibold text-neutral-700 dark:text-neutral-200">
              Keranjang masih kosong
            </p>
            <p className="text-[12px] text-neutral-400 mt-1">
              Pilih menu di katalog kiri untuk memulai transaksi baru.
            </p>
          </div>
        ) : (
          cartLines.map((line) => {
            const lineSubtotal = line.unitPriceCents * line.quantity;
            return (
              <div key={line.id} className="py-4 first:pt-2 flex items-center gap-3.5">
                <div className="w-[68px] h-[76px] rounded-[16px] overflow-hidden shrink-0">
                  <ProductVisual imageKey={line.imageKey} alt={line.productName} />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-[14.5px] font-bold text-[#1F1F1F] dark:text-neutral-100 truncate">
                    {line.productName}
                  </h3>
                  <p className="text-[11.5px] text-[#ADADAD] dark:text-neutral-400 mt-0.5 tabular-nums">
                    <span>{line.size}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{line.weightGrams}g</span>
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-bold text-[#1F1F1F] dark:text-neutral-100 tabular-nums whitespace-nowrap">
                      {formatMoney(lineSubtotal, currency)}
                    </span>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onUpdateLineQty(line.id, line.quantity - 1)}
                        aria-label={`Kurangi ${line.productName} di keranjang`}
                        className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:border-[#FF9E67] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-[13px] font-semibold text-[#1F1F1F] dark:text-neutral-100 tabular-nums min-w-[14px] text-center">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateLineQty(line.id, line.quantity + 1)}
                        aria-label={`Tambah ${line.productName} di keranjang`}
                        className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:border-[#FF9E67] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Totals & Primary Place an order CTA */}
      <div className="px-6 pt-4 pb-6 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3">
        {/* Promo selector */}
        <div className="flex items-center justify-between text-[11.5px] text-neutral-400">
          <span>Promo Diskon</span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'member_15k', label: '-Rp 15rb' },
                { id: 'percent_10', label: '10%' },
                { id: 'none', label: 'Normal' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeDiscountMode(opt.id)}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  discountMode === opt.id
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium'
                    : 'hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-[13.5px]">
          <div className="flex items-center justify-between">
            <span className="text-[#ADADAD] dark:text-neutral-400">Items</span>
            <span className="font-semibold text-[#1F1F1F] dark:text-neutral-100 tabular-nums">
              {formatMoney(totals.itemsSubtotalCents, currency)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#ADADAD] dark:text-neutral-400">Discounts</span>
            <span className="font-semibold text-[#1F1F1F] dark:text-neutral-100 tabular-nums">
              {totals.discountCents > 0
                ? formatMoney(totals.discountCents, currency, { signedNegative: true })
                : formatMoney(0, currency)}
            </span>
          </div>

          <div className="pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-[#ADADAD] dark:text-neutral-400">Total</span>
            <span className="text-[15.5px] font-bold text-[#FF9E67] tabular-nums">
              {formatMoney(totals.totalCents, currency)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={cartLines.length === 0 || !canCheckout}
          onClick={onOpenCheckout}
          className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] disabled:opacity-45 disabled:cursor-not-allowed text-white text-[14px] font-semibold transition-colors cursor-pointer"
        >
          {!canCheckout ? 'Akses Checkout Dibatasi' : 'Place an order'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden xl:block w-[340px] 2xl:w-[360px] shrink-0 h-screen sticky top-0">
        {panelBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[350px] max-w-[92vw] h-full">{panelBody}</div>
        </div>
      )}
    </>
  );
}
