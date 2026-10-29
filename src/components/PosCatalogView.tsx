import { useState } from 'react';
import { Bell, Minus, Plus, Search, SlidersHorizontal } from 'lucide-react';
import type {
  CartLineItem,
  CurrencyCode,
  CupSize,
  MenuCategory,
  ProductItem,
} from '../types';
import { calculateUnitPriceCents, formatMoney } from '../utils/posLogic';
import { ProductVisual } from './ProductVisual';

const CATEGORIES: MenuCategory[] = ['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'];

interface PosCatalogViewProps {
  products: ProductItem[];
  cartLines: CartLineItem[];
  currency: CurrencyCode;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  canCheckout: boolean;
  onAddOrSetCartItem: (product: ProductItem, size: CupSize, quantity: number) => void;
}

export function PosCatalogView({
  products,
  cartLines,
  currency,
  unreadNotifications,
  onOpenNotifications,
  canCheckout,
  onAddOrSetCartItem,
}: PosCatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('Coffee');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [onlyAvailableStock, setOnlyAvailableStock] = useState(false);
  const [sortOrder, setSortOrder] = useState<'popular' | 'price_asc' | 'price_desc'>('popular');

  const [selectedSizes, setSelectedSizes] = useState<Record<string, CupSize>>({});
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({
    'prod-cappuccino': 3,
    'prod-latte': 2,
    'prod-americano': 1,
    'prod-v60': 3,
  });

  const filteredProducts = products
    .filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      const matchesCategory = q !== '' ? true : item.category === selectedCategory;
      const matchesStock = onlyAvailableStock ? item.stock > 0 : true;
      return matchesSearch && matchesCategory && matchesStock;
    })
    .sort((a, b) => {
      if (sortOrder === 'price_asc') return a.priceCents - b.priceCents;
      if (sortOrder === 'price_desc') return b.priceCents - a.priceCents;
      return 0;
    });

  const getSizeFor = (productId: string): CupSize => selectedSizes[productId] || 'Small';

  const getCartLine = (productId: string, size: CupSize) =>
    cartLines.find((l) => l.productId === productId && l.size === size);

  const getDisplayedQty = (productId: string, size: CupSize): number => {
    const existing = getCartLine(productId, size);
    if (existing) return existing.quantity;
    return draftQuantities[productId] ?? 1;
  };

  const handleStepQty = (product: ProductItem, delta: number) => {
    const size = getSizeFor(product.id);
    const existing = getCartLine(product.id, size);
    const current = getDisplayedQty(product.id, size);
    const next = Math.max(1, Math.min(Math.max(1, product.stock), current + delta));

    setDraftQuantities((prev) => ({ ...prev, [product.id]: next }));
    if (existing && canCheckout) {
      onAddOrSetCartItem(product, size, next);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Top Search & Action Bar matching Purr'Coffee reference */}
      <div className="bg-white dark:bg-[#181B20] px-5 sm:px-8 py-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xl flex items-center bg-[#F7F7F8] dark:bg-[#22262E] rounded-full pl-4 pr-1.5 py-1.5">
          <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-2.5" />
          <label htmlFor="pos-menu-search" className="sr-only">
            Cari menu atau SKU
          </label>
          <input
            id="pos-menu-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-[14px] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowFilterPanel((v) => !v)}
            aria-expanded={showFilterPanel}
            className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13px] font-medium px-3.5 sm:px-5 py-2 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>

        {/* Real-time Push Notification Bell */}
        <div className="hidden lg:flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={`Notifikasi real-time (${unreadNotifications} belum dibaca)`}
            className="relative p-2.5 rounded-full bg-[#F7F7F8] dark:bg-[#22262E] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF9E67] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Filter Toolbar */}
      {showFilterPanel && (
        <div className="mx-5 sm:mx-8 mt-4 px-4 py-3 rounded-2xl bg-white dark:bg-[#181B20] border border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-[13px]">
          <label className="inline-flex items-center gap-2 text-neutral-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAvailableStock}
              onChange={(e) => setOnlyAvailableStock(e.target.checked)}
              className="rounded accent-[#FF9E67]"
            />
            <span>Hanya tampilkan stok tersedia</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Urutkan:</span>
            {(['popular', 'price_asc', 'price_desc'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortOrder(mode)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap ${
                  sortOrder === mode
                    ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {mode === 'popular'
                  ? 'Populer'
                  : mode === 'price_asc'
                    ? 'Harga Terendah'
                    : 'Harga Tertinggi'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Menu Body */}
      <div className="px-5 sm:px-8 py-6 flex-1">
        {/* Category Pills matching Purr'Coffee */}
        <div
          role="tablist"
          aria-label="Kategori Menu"
          className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar"
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category && searchQuery.trim() === '';
            return (
              <button
                key={category}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setSelectedCategory(category);
                  setSearchQuery('');
                }}
                className={`px-6 py-2.5 rounded-full text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#FF9E67] text-white shadow-xs'
                    : 'bg-white dark:bg-[#181B20] text-[#555555] dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-800 hover:border-[#FF9E67]/60'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Section Heading */}
        <div className="mt-6 mb-4 flex items-baseline justify-between">
          <h1 className="text-[19px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            {searchQuery.trim() ? `Hasil pencarian "${searchQuery}"` : `${selectedCategory} menu`}
          </h1>
          <span className="text-[12.5px] text-neutral-400 tabular-nums">
            {filteredProducts.length} menu tersedia
          </span>
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-10 text-center border border-neutral-100 dark:border-neutral-800">
            <p className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-200">
              Tidak ada menu yang cocok dengan pencarian Anda.
            </p>
            <p className="text-[13px] text-neutral-500 mt-1">
              Coba kata kunci lain atau reset filter kategori.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setOnlyAvailableStock(false);
                setSelectedCategory('Coffee');
              }}
              className="mt-4 px-5 py-2 rounded-full bg-[#FF9E67] text-white text-[13px] font-medium"
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          /* 2-Column Product Cards matching Purr'Coffee reference */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredProducts.map((product) => {
              const size = getSizeFor(product.id);
              const unitPriceCents = calculateUnitPriceCents(product.priceCents, size);
              const existingCartLine = getCartLine(product.id, size);
              const isAdded = Boolean(existingCartLine);
              const qty = getDisplayedQty(product.id, size);
              const outOfStock = product.stock <= 0;
              const isLowStock = product.stock > 0 && product.stock <= product.minStock;

              return (
                <article
                  key={product.id}
                  className="group bg-white dark:bg-[#181B20] rounded-[24px] p-4 border border-neutral-100 dark:border-neutral-800/80 transition-transform duration-150 hover:-translate-y-0.5 flex flex-col justify-between gap-3.5"
                >
                  <div className="flex gap-4">
                    {/* Left Rounded Product Image Container */}
                    <div className="w-[108px] sm:w-[118px] h-[132px] rounded-[18px] overflow-hidden shrink-0">
                      <ProductVisual imageKey={product.imageKey} alt={product.name} />
                    </div>

                    {/* Right Product Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <h2 className="text-[16px] font-bold text-[#1F1F1F] dark:text-neutral-100 truncate">
                            {product.name}
                          </h2>
                          <span className="text-[14.5px] font-semibold text-[#FF9E67] tabular-nums whitespace-nowrap shrink-0">
                            {formatMoney(unitPriceCents, currency)}
                          </span>
                        </div>

                        <p className="mt-1.5 text-[12px] leading-relaxed text-[#9A9A9A] dark:text-neutral-400 line-clamp-3">
                          {product.description}
                        </p>

                        {/* Clean unboxed stock metadata */}
                        <div className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                          <span>SKU {product.sku}</span>
                          <span aria-hidden="true"> · </span>
                          <span
                            className={
                              outOfStock
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : isLowStock
                                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                                  : ''
                            }
                          >
                            {outOfStock
                              ? 'Stok Habis'
                              : isLowStock
                                ? `Sisa ${product.stock} porsi`
                                : `Stok ${product.stock}`}
                          </span>
                        </div>
                      </div>

                      {/* Size Selector matching reference: Small (dark #333) | Large */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-[#333333] dark:text-neutral-300">
                          Size
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(['Small', 'Large'] as const).map((sz) => {
                            const sizeActive = size === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() =>
                                  setSelectedSizes((prev) => ({ ...prev, [product.id]: sz }))
                                }
                                className={`px-3.5 py-1 rounded-full text-[11.5px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                  sizeActive
                                    ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                                    : 'bg-white dark:bg-[#22262E] text-[#555555] dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                                }`}
                              >
                                {sz}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Stepper + Add to Cart CTA matching reference */}
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <div className="flex items-center gap-3 pl-1">
                      <button
                        type="button"
                        onClick={() => handleStepQty(product, -1)}
                        disabled={outOfStock}
                        aria-label={`Kurangi jumlah ${product.name}`}
                        className="w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:border-[#FF9E67] disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[13.5px] font-semibold text-[#1F1F1F] dark:text-neutral-100 tabular-nums min-w-[16px] text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStepQty(product, 1)}
                        disabled={outOfStock || qty >= product.stock}
                        aria-label={`Tambah jumlah ${product.name}`}
                        className="w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:border-[#FF9E67] disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={outOfStock || !canCheckout}
                      onClick={() => onAddOrSetCartItem(product, size, qty)}
                      className={`flex-1 max-w-[190px] py-2.5 px-4 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isAdded
                          ? 'bg-[#FF9E67] text-white hover:bg-[#f58d52]'
                          : 'bg-white dark:bg-[#22262E] text-[#FF9E67] border border-[#FF9E67]/35 hover:bg-[#FF9E67] hover:text-white'
                      }`}
                    >
                      {outOfStock
                        ? 'Out of stock'
                        : !canCheckout
                          ? 'Akses Kasir Dibatasi'
                          : isAdded
                            ? 'Added to cart'
                            : 'Add to Cart'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
