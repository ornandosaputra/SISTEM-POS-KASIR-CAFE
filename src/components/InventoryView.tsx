import { useState } from 'react';
import {
  AlertTriangle,
  Lock,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CurrencyCode, MenuCategory, ProductItem } from '../types';
import { formatMoney, validateProductForm } from '../utils/posLogic';
import { ProductVisual } from './ProductVisual';

interface InventoryViewProps {
  products: ProductItem[];
  currency: CurrencyCode;
  canManageInventory: boolean;
  isAdminUnlocked: boolean;
  onRequestAdminForCrud: (reason: string, onUnlocked?: () => void) => void;
  onAdjustStock: (productId: string, nextStock: number) => void;
  onCreateProduct: (item: Omit<ProductItem, 'id' | 'updatedAtMs'>) => void;
  onUpdateProduct: (productId: string, item: Omit<ProductItem, 'id' | 'updatedAtMs'>) => void;
  onDeleteProduct: (productId: string) => void;
}

export function InventoryView({
  products,
  currency,
  canManageInventory,
  isAdminUnlocked,
  onRequestAdminForCrud,
  onAdjustStock,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuCategory>('Coffee');
  const [description, setDescription] = useState('');
  const [priceRupiah, setPriceRupiah] = useState('');
  const [costRupiah, setCostRupiah] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('8');
  const [weightGrams, setWeightGrams] = useState('200');
  const [imageKey, setImageKey] = useState('latte');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const lowStockItems = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const outOfStockItems = products.filter((p) => p.stock === 0);
  const inventoryValueCents = products.reduce((s, p) => s + p.costCents * p.stock, 0);

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchText =
      q === '' ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'low'
          ? p.stock <= p.minStock && p.stock > 0
          : p.stock === 0;
    return matchText && matchStatus;
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setCategory('Coffee');
    setDescription('');
    setPriceRupiah('');
    setCostRupiah('');
    setStock('');
    setMinStock('8');
    setWeightGrams('200');
    setImageKey('latte');
    setFormErrors([]);
    setModalOpen(true);
  };

  const openEditModal = (item: ProductItem) => {
    setEditingProduct(item);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description);
    setPriceRupiah(String(item.priceCents));
    setCostRupiah(String(item.costCents));
    setStock(String(item.stock));
    setMinStock(String(item.minStock));
    setWeightGrams(String(item.weightGrams || 200));
    setImageKey(item.imageKey);
    setFormErrors([]);
    setModalOpen(true);
  };

  const handleRequestCreate = () => {
    if (!isAdminUnlocked) {
      onRequestAdminForCrud('Masukkan PIN/Login Admin untuk menambah produk baru.', openCreateModal);
      return;
    }
    openCreateModal();
  };

  const handleRequestEdit = (item: ProductItem) => {
    if (!isAdminUnlocked) {
      onRequestAdminForCrud(
        `Masukkan PIN/Login Admin untuk mengedit produk ${item.name}.`,
        () => openEditModal(item)
      );
      return;
    }
    openEditModal(item);
  };

  const handleRequestDelete = (item: ProductItem) => {
    if (!isAdminUnlocked) {
      onRequestAdminForCrud(
        `Masukkan PIN/Login Admin untuk menghapus produk ${item.name}.`,
        () => setDeleteTarget(item)
      );
      return;
    }
    setDeleteTarget(item);
  };

  const handleSubmitProductForm = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateProductForm(
      {
        sku,
        name,
        category,
        description,
        priceRupiah,
        costRupiah,
        stock,
        minStock,
        weightGrams,
        imageKey,
      },
      products,
      editingProduct?.id
    );

    if (!check.valid || !check.parsed) {
      setFormErrors(check.errors);
      return;
    }

    if (editingProduct) {
      onUpdateProduct(editingProduct.id, check.parsed);
    } else {
      onCreateProduct(check.parsed);
    }

    setModalOpen(false);
    setEditingProduct(null);
    setFormErrors([]);
  };

  const canAdjustStock = isAdminUnlocked || canManageInventory;

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            Manajemen Inventaris &amp; Master CRUD Produk
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Kelola katalog menu (Tambah, Edit, Hapus SKU) di Mode Admin serta pemantauan stok real-time.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRequestCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {!isAdminUnlocked ? <Lock className="w-3.5 h-3.5" /> : <PackagePlus className="w-4 h-4" />}
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Staff Security Info Strip when Admin Mode is Locked */}
      {!isAdminUnlocked && (
        <div className="rounded-2xl bg-white dark:bg-[#181B20] border border-neutral-200/80 dark:border-neutral-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px]">
          <div className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
            <Lock className="w-4 h-4 text-[#FF9E67] shrink-0" />
            <span>
              Mode Staf Aktif — Penambahan, perubahan harga/nama, dan penghapusan master produk dikunci dengan PIN Admin.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRequestAdminForCrud('Buka Mode Admin untuk mengelola CRUD katalog produk.')}
            className="px-4 py-1.5 rounded-full bg-[#333333] hover:bg-neutral-800 text-white text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Buka Mode Admin
          </button>
        </div>
      )}

      {/* Low Stock Banner if any */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[13px]">
              <p className="font-bold text-neutral-900 dark:text-neutral-100">
                Peringatan Stok Menipis Aktif ({lowStockItems.length + outOfStockItems.length} SKU)
              </p>
              <p className="text-neutral-600 dark:text-neutral-300 mt-0.5">
                {[...outOfStockItems, ...lowStockItems]
                  .map((i) => `${i.name} (${i.stock}/${i.minStock})`)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter('low')}
            className="px-4 py-1.5 rounded-full bg-white dark:bg-[#181B20] border border-amber-500/30 text-[12px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Filter Stok Menipis
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-4 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500">Total SKU Terdaftar</span>
          <div className="text-[22px] font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
            {products.length} item
          </div>
        </div>
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-4 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500">Nilai HPP Persediaan</span>
          <div className="text-[22px] font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
            {formatMoney(inventoryValueCents, currency)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-4 border border-neutral-200/70 dark:border-neutral-800">
          <span className="text-[12px] text-neutral-500">Perlu Restock Segera</span>
          <div className="text-[22px] font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {lowStockItems.length + outOfStockItems.length} SKU
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <label htmlFor="inventory-search" className="sr-only">
            Cari SKU atau nama inventaris
          </label>
          <input
            id="inventory-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU, nama item, atau kategori..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-800 text-[13.5px] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-[#FF9E67]"
          />
        </div>

        <div className="flex items-center gap-2">
          {(
            [
              { id: 'all', label: 'Semua SKU' },
              { id: 'low', label: 'Stok Menipis' },
              { id: 'out', label: 'Stok Habis' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-2 rounded-full text-[12.5px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-white dark:bg-[#181B20] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory & Master CRUD Table */}
      <div className="bg-white dark:bg-[#181B20] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-[12px]">
              <th className="py-3 px-4 font-medium">Produk</th>
              <th className="py-3 px-3 font-medium">SKU · Kategori</th>
              <th className="py-3 px-3 font-medium text-right">Harga Jual · HPP</th>
              <th className="py-3 px-3 font-medium text-right">Stok / Min</th>
              <th className="py-3 px-3 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">Mutasi Stok &amp; CRUD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center text-neutral-400">
                  Tidak ada SKU produk yang cocok dengan pencarian Anda.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isOut = item.stock === 0;
                const isLow = item.stock > 0 && item.stock <= item.minStock;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                          <ProductVisual imageKey={item.imageKey} alt={item.name} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {item.name}
                          </div>
                          <div className="text-[11.5px] text-neutral-400 truncate max-w-[240px]">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-neutral-500 tabular-nums whitespace-nowrap">
                      <span>{item.sku}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.category}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatMoney(item.priceCents, currency)}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        HPP {formatMoney(item.costCents, currency)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">
                        {item.stock}
                      </span>
                      <span className="text-neutral-400"> / {item.minStock}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-[12px] font-medium">
                      {isOut ? (
                        <span className="text-red-600 dark:text-red-400">Habis (0)</span>
                      ) : isLow ? (
                        <span className="text-amber-600 dark:text-amber-400">Menipis</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Aman</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canAdjustStock && (
                          <>
                            <button
                              type="button"
                              onClick={() => onAdjustStock(item.id, Math.max(0, item.stock - 1))}
                              aria-label={`Kurangi 1 stok ${item.name}`}
                              className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-[12px] font-mono hover:border-[#FF9E67] cursor-pointer"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => onAdjustStock(item.id, item.stock + 10)}
                              aria-label={`Restock 10 porsi ${item.name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF9E67]/15 text-[#FF9E67] hover:bg-[#FF9E67] hover:text-white text-[12px] font-semibold transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+10</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRequestEdit(item)}
                          aria-label={`Edit produk ${item.name}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRequestDelete(item)}
                          aria-label={`Hapus produk ${item.name}`}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-600 hover:border-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Product Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-crud-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSubmitProductForm}
            className="relative z-10 w-full max-w-lg rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2
                id="product-crud-modal-title"
                className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100"
              >
                {editingProduct
                  ? `Edit Produk · ${editingProduct.sku}`
                  : 'Tambah Produk & SKU Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup form produk"
                className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-[12px] space-y-1">
                {formErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <label htmlFor="crud-sku" className="block font-medium mb-1">
                  Kode SKU
                </label>
                <input
                  id="crud-sku"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="CF-009"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 font-mono"
                />
              </div>

              <div>
                <label htmlFor="crud-category" className="block font-medium mb-1">
                  Kategori Menu
                </label>
                <select
                  id="crud-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MenuCategory)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                >
                  {(['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="crud-name" className="block font-medium mb-1">
                  Nama Produk
                </label>
                <input
                  id="crud-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Hazelnut Cold Brew"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="crud-desc" className="block font-medium mb-1">
                  Deskripsi Singkat
                </label>
                <input
                  id="crud-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="16-hour cold steeped arabica with roasted hazelnut syrup."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div>
                <label htmlFor="crud-price" className="block font-medium mb-1">
                  Harga Jual (Rp)
                </label>
                <input
                  id="crud-price"
                  type="number"
                  step="500"
                  min="0"
                  value={priceRupiah}
                  onChange={(e) => setPriceRupiah(e.target.value)}
                  placeholder="30000"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="crud-cost" className="block font-medium mb-1">
                  Harga Pokok / HPP (Rp)
                </label>
                <input
                  id="crud-cost"
                  type="number"
                  step="500"
                  min="0"
                  value={costRupiah}
                  onChange={(e) => setCostRupiah(e.target.value)}
                  placeholder="11000"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="crud-stock" className="block font-medium mb-1">
                  Stok Tersedia
                </label>
                <input
                  id="crud-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="20"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="crud-min-stock" className="block font-medium mb-1">
                  Batas Notifikasi Stok Menipis
                </label>
                <input
                  id="crud-min-stock"
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="8"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="crud-weight" className="block font-medium mb-1">
                  Takaran Porsi (gram / ml)
                </label>
                <input
                  id="crud-weight"
                  type="number"
                  min="10"
                  max="5000"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder="200"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="crud-visual" className="block font-medium mb-1">
                  Visual Produk
                </label>
                <select
                  id="crud-visual"
                  value={imageKey}
                  onChange={(e) => setImageKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                >
                  <option value="latte">Iced Coffee Latte Photo</option>
                  <option value="americano">Iced Americano Photo</option>
                  <option value="v60">Specialty Cream Coffee Photo</option>
                  <option value="croissant">Artisan Croissant Photo</option>
                  <option value="cappuccino">Layered Palm Sugar Cappuccino</option>
                  <option value="matcha">Kyoto Matcha Latte</option>
                  <option value="chocolate">Valrhona Iced Chocolate</option>
                  <option value="brioche">Truffle Egg Brioche</option>
                  <option value="snack">Cinnamon Churros</option>
                  <option value="dessert">Mascarpone Tiramisu</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-full text-[13px] text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13px] font-semibold cursor-pointer"
              >
                {editingProduct ? 'Simpan Perubahan' : 'Simpan ke Katalog & Cloud'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-App Delete Product Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-product-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-2xl">
            <h2
              id="delete-product-modal-title"
              className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100"
            >
              Hapus Produk dari Katalog?
            </h2>
            <p className="text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Produk <strong>{deleteTarget.name}</strong> ({deleteTarget.sku}) akan dihapus dari katalog POS, keranjang aktif, dan penyimpanan Cloud.
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
                  onDeleteProduct(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold cursor-pointer"
              >
                Konfirmasi Hapus Produk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
