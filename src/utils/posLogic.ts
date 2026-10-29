import type {
  CartLineItem,
  CurrencyCode,
  CupSize,
  MenuCategory,
  OrderRecord,
  OrderStatus,
  OrderType,
  PaymentMethod,
  ProductItem,
  RolePermissions,
  StaffMemberRecord,
  StaffRole,
} from '../types';

export const LARGE_SIZE_UPCHARGE_IDR = 5000; // +Rp 5.000 untuk ukuran Large

export type DiscountMode = 'member_15k' | 'percent_10' | 'none';

export function calculateUnitPriceCents(basePriceIdr: number, size: CupSize): number {
  return size === 'Large' ? basePriceIdr + LARGE_SIZE_UPCHARGE_IDR : basePriceIdr;
}

export function calculateWeightGrams(baseWeight: number, size: CupSize): number {
  return size === 'Large' ? Math.round(baseWeight * 1.5) : baseWeight;
}

export interface CartTotals {
  itemsSubtotalCents: number;
  discountCents: number;
  totalCents: number;
  totalQuantity: number;
}

export function calculateCartTotals(
  lines: CartLineItem[],
  discountMode: DiscountMode = 'member_15k'
): CartTotals {
  const itemsSubtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  );
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (itemsSubtotalCents === 0) {
    return { itemsSubtotalCents: 0, discountCents: 0, totalCents: 0, totalQuantity: 0 };
  }

  let discountCents = 0;
  if (discountMode === 'member_15k') {
    // Potongan promo Rp 15.000 untuk transaksi minimal Rp 80.000
    discountCents = itemsSubtotalCents >= 80000 ? 15000 : 0;
  } else if (discountMode === 'percent_10') {
    discountCents = Math.round(itemsSubtotalCents * 0.1);
  }

  discountCents = Math.min(discountCents, itemsSubtotalCents);
  const totalCents = Math.max(0, itemsSubtotalCents - discountCents);

  return {
    itemsSubtotalCents,
    discountCents,
    totalCents,
    totalQuantity,
  };
}

export function formatMoney(
  amountIdr: number,
  _currency: CurrencyCode = 'IDR',
  options?: { signedNegative?: boolean }
): string {
  const absRupiah = Math.round(Math.abs(amountIdr));
  const prefixSign = options?.signedNegative && absRupiah > 0 ? '-' : '';
  return `${prefixSign}Rp ${absRupiah.toLocaleString('id-ID')}`;
}

export interface InventoryDeductionResult {
  updatedProducts: ProductItem[];
  lowStockTriggered: ProductItem[];
}

export function deductInventoryAndDetectLowStock(
  products: ProductItem[],
  cartLines: CartLineItem[],
  nowMs: number = Date.now()
): InventoryDeductionResult {
  const qtyByProduct = new Map<string, number>();
  for (const line of cartLines) {
    qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);
  }

  const lowStockTriggered: ProductItem[] = [];
  const updatedProducts = products.map((product) => {
    const deductQty = qtyByProduct.get(product.id) ?? 0;
    if (deductQty <= 0) return product;

    const nextStock = Math.max(0, product.stock - deductQty);
    const nextItem: ProductItem = {
      ...product,
      stock: nextStock,
      updatedAtMs: nowMs,
    };

    if (nextStock <= product.minStock) {
      lowStockTriggered.push(nextItem);
    }
    return nextItem;
  });

  return { updatedProducts, lowStockTriggered };
}

export interface ProductFormInput {
  sku: string;
  name: string;
  category: MenuCategory;
  description: string;
  priceRupiah: string;
  costRupiah: string;
  stock: string;
  minStock: string;
  weightGrams?: string;
  imageKey: string;
}

export function validateProductForm(
  input: ProductFormInput,
  existingProducts: ProductItem[] = [],
  editingProductId?: string
): {
  valid: boolean;
  errors: string[];
  parsed?: Omit<ProductItem, 'id' | 'updatedAtMs'>;
} {
  const errors: string[] = [];
  const sku = input.sku.trim().toUpperCase();
  const name = input.name.trim();
  const description = input.description.trim();

  if (!/^[a-zA-Z0-9_\-]{2,32}$/.test(sku)) {
    errors.push('SKU wajib 2–32 karakter alfanumerik/tanda hubung (contoh: CF-009).');
  } else {
    const duplicate = existingProducts.some(
      (p) => p.id !== editingProductId && p.sku.trim().toUpperCase() === sku
    );
    if (duplicate) {
      errors.push(`Kode SKU "${sku}" sudah digunakan oleh produk lain.`);
    }
  }
  if (name.length < 1 || name.length > 100) {
    errors.push('Nama produk wajib diisi (maksimal 100 karakter).');
  }
  if (!['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'].includes(input.category)) {
    errors.push('Kategori produk tidak valid.');
  }
  if (description.length < 1 || description.length > 300) {
    errors.push('Deskripsi wajib diisi (maksimal 300 karakter).');
  }

  const priceNum = Number(input.priceRupiah);
  const costNum = Number(input.costRupiah);
  const stockNum = Number(input.stock);
  const minStockNum = Number(input.minStock);
  const rawWeight = input.weightGrams !== undefined && input.weightGrams.trim() !== ''
    ? Number(input.weightGrams)
    : 200;

  if (!Number.isFinite(priceNum) || priceNum <= 0 || input.priceRupiah.trim() === '') {
    errors.push('Harga jual (Rp) wajib berupa angka lebih dari 0.');
  }
  if (!Number.isFinite(costNum) || costNum < 0 || input.costRupiah.trim() === '') {
    errors.push('Harga pokok / HPP (Rp) wajib berupa angka 0 atau lebih.');
  }
  if (!Number.isInteger(stockNum) || stockNum < 0 || input.stock.trim() === '') {
    errors.push('Stok wajib berupa bilangan bulat >= 0.');
  }
  if (!Number.isInteger(minStockNum) || minStockNum < 0 || input.minStock.trim() === '') {
    errors.push('Batas minimum stok wajib berupa bilangan bulat >= 0.');
  }
  if (!Number.isFinite(rawWeight) || rawWeight < 10 || rawWeight > 5000) {
    errors.push('Berat takaran porsi wajib antara 10g hingga 5000g.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    parsed: {
      sku,
      name,
      category: input.category,
      description,
      priceCents: Math.round(priceNum),
      costCents: Math.round(costNum),
      stock: stockNum,
      minStock: minStockNum,
      imageKey: /^[a-zA-Z0-9_\-]{1,64}$/.test(input.imageKey) ? input.imageKey : 'cappuccino',
      weightGrams: Math.round(rawWeight),
    },
  };
}

export function getDefaultPermissionsForRole(role: StaffRole): RolePermissions {
  const presets: Record<StaffRole, RolePermissions> = {
    Admin: {
      canCheckout: true,
      canRefund: true,
      canManageInventory: true,
      canViewAnalytics: true,
      canManageUsers: true,
      canManageCloudApi: true,
    },
    Manager: {
      canCheckout: true,
      canRefund: true,
      canManageInventory: true,
      canViewAnalytics: true,
      canManageUsers: false,
      canManageCloudApi: true,
    },
    Cashier: {
      canCheckout: true,
      canRefund: false,
      canManageInventory: false,
      canViewAnalytics: false,
      canManageUsers: false,
      canManageCloudApi: false,
    },
    Inventory: {
      canCheckout: false,
      canRefund: false,
      canManageInventory: true,
      canViewAnalytics: true,
      canManageUsers: false,
      canManageCloudApi: false,
    },
  };
  return presets[role];
}

export interface StaffFormInput {
  name: string;
  email: string;
  staffRole: StaffRole;
  shiftLabel: string;
  active: boolean;
}

export function canDeleteStaffMember(
  staffList: StaffMemberRecord[],
  targetId: string
): { allowed: boolean; reason?: string } {
  const target = staffList.find((s) => s.id === targetId);
  if (!target) return { allowed: false, reason: 'Data staf tidak ditemukan.' };

  if (target.staffRole === 'Admin' && target.active) {
    const remainingAdmins = staffList.filter(
      (s) => s.id !== targetId && s.staffRole === 'Admin' && s.active
    );
    if (remainingAdmins.length === 0) {
      return {
        allowed: false,
        reason: 'Tidak dapat menghapus satu-satunya akun Admin aktif di sistem.',
      };
    }
  }
  return { allowed: true };
}

export function validateStaffForm(
  input: StaffFormInput,
  existingStaff: StaffMemberRecord[] = [],
  editingStaffId?: string
): {
  valid: boolean;
  errors: string[];
  parsed?: StaffFormInput;
} {
  const errors: string[] = [];
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const shiftLabel = input.shiftLabel.trim();

  if (name.length < 2 || name.length > 80) {
    errors.push('Nama lengkap karyawan wajib diisi (2–80 karakter).');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    errors.push('Email kerja karyawan tidak valid.');
  } else {
    const duplicate = existingStaff.some(
      (s) => s.id !== editingStaffId && s.email.trim().toLowerCase() === email
    );
    if (duplicate) {
      errors.push(`Email "${email}" sudah terdaftar pada akun staf lain.`);
    }
  }
  if (!['Admin', 'Manager', 'Cashier', 'Inventory'].includes(input.staffRole)) {
    errors.push('Peran karyawan tidak valid.');
  }
  if (shiftLabel.length < 1 || shiftLabel.length > 40) {
    errors.push('Jadwal shift wajib diisi (maksimal 40 karakter).');
  }

  if (editingStaffId) {
    const current = existingStaff.find((s) => s.id === editingStaffId);
    if (
      current &&
      current.staffRole === 'Admin' &&
      current.active &&
      (input.staffRole !== 'Admin' || !input.active)
    ) {
      const otherAdmins = existingStaff.filter(
        (s) => s.id !== editingStaffId && s.staffRole === 'Admin' && s.active
      );
      if (otherAdmins.length === 0) {
        errors.push('Minimal harus ada 1 akun Admin aktif agar sistem tidak terkunci.');
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    parsed: {
      name,
      email,
      staffRole: input.staffRole,
      shiftLabel,
      active: Boolean(input.active),
    },
  };
}

export interface OrderEditInput {
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  cashierName: string;
  status: OrderStatus;
}

export function validateOrderEditForm(input: OrderEditInput): {
  valid: boolean;
  errors: string[];
  parsed?: OrderEditInput;
} {
  const errors: string[] = [];
  const paymentRef = input.paymentRef.trim();
  const cashierName = input.cashierName.trim();

  if (!['Delivery', 'Dine in', 'Take away'].includes(input.orderType)) {
    errors.push('Tipe layanan pesanan tidak valid.');
  }
  if (!['QRIS', 'E-Wallet', 'Card', 'Cash'].includes(input.paymentMethod)) {
    errors.push('Metode pembayaran tidak valid.');
  }
  if (!/^[a-zA-Z0-9_\-]{3,64}$/.test(paymentRef)) {
    errors.push('Referensi pembayaran wajib 3–64 karakter alfanumerik/tanda hubung.');
  }
  if (cashierName.length < 1 || cashierName.length > 80) {
    errors.push('Nama kasir wajib diisi (maksimal 80 karakter).');
  }
  if (!['preparing', 'completed', 'refunded'].includes(input.status)) {
    errors.push('Status pesanan tidak valid.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    parsed: {
      orderType: input.orderType,
      paymentMethod: input.paymentMethod,
      paymentRef,
      cashierName,
      status: input.status,
    },
  };
}

export function hasPermission(
  staff: StaffMemberRecord,
  capability: keyof RolePermissions
): boolean {
  if (!staff.active) return false;
  if (capability === 'canManageUsers' && staff.staffRole !== 'Admin') return false;
  return Boolean(staff[capability]);
}

export interface AnalyticsSummary {
  grossRevenueCents: number;
  netProfitCents: number;
  totalOrders: number;
  avgOrderValueCents: number;
  refundedCount: number;
  hourlyBuckets: { hourLabel: string; revenueCents: number; ordersCount: number }[];
  paymentBreakdown: { method: PaymentMethod; revenueCents: number; count: number; sharePct: number }[];
  topProducts: { productId: string; name: string; unitsSold: number; revenueCents: number }[];
  lowStockCount: number;
}

export function computeAnalyticsSummary(
  orders: OrderRecord[],
  products: ProductItem[],
  periodDays: 1 | 7 | 30 = 1,
  nowMs: number = Date.now()
): AnalyticsSummary {
  const cutoffMs = nowMs - periodDays * 24 * 60 * 60 * 1000;
  const inRange = orders.filter((o) => o.createdAtMs >= cutoffMs);
  const activeOrders = inRange.filter((o) => o.status !== 'refunded');
  const refundedCount = inRange.filter((o) => o.status === 'refunded').length;

  const grossRevenueCents = activeOrders.reduce((s, o) => s + o.totalCents, 0);
  const totalOrders = activeOrders.length;
  const avgOrderValueCents = totalOrders > 0 ? Math.round(grossRevenueCents / totalOrders) : 0;

  const costMap = new Map(products.map((p) => [p.id, p.costCents]));
  let totalCostCents = 0;
  const productSales = new Map<string, { name: string; unitsSold: number; revenueCents: number }>();

  for (const order of activeOrders) {
    for (const line of order.lines) {
      const unitCost = costMap.get(line.productId) ?? Math.round(line.unitPriceCents * 0.36);
      totalCostCents += unitCost * line.quantity;

      const prev = productSales.get(line.productId) ?? {
        name: line.productName,
        unitsSold: 0,
        revenueCents: 0,
      };
      prev.unitsSold += line.quantity;
      prev.revenueCents += line.unitPriceCents * line.quantity;
      productSales.set(line.productId, prev);
    }
  }

  const netProfitCents = Math.max(0, grossRevenueCents - totalCostCents);

  const slotHours = [8, 10, 12, 14, 16, 18, 20, 22];
  const hourlyBuckets = slotHours.map((hr) => {
    const matching = activeOrders.filter((o) => {
      const h = new Date(o.createdAtMs).getHours();
      return h >= hr - 1 && h <= hr;
    });
    return {
      hourLabel: `${String(hr).padStart(2, '0')}:00`,
      revenueCents: matching.reduce((s, o) => s + o.totalCents, 0),
      ordersCount: matching.length,
    };
  });

  const methods: PaymentMethod[] = ['QRIS', 'E-Wallet', 'Card', 'Cash'];
  const paymentBreakdown = methods.map((method) => {
    const subset = activeOrders.filter((o) => o.paymentMethod === method);
    const revenueCents = subset.reduce((s, o) => s + o.totalCents, 0);
    const sharePct =
      grossRevenueCents > 0 ? Math.round((revenueCents / grossRevenueCents) * 100) : 0;
    return { method, revenueCents, count: subset.length, sharePct };
  });

  const topProducts = Array.from(productSales.entries())
    .map(([productId, stats]) => ({ productId, ...stats }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return {
    grossRevenueCents,
    netProfitCents,
    totalOrders,
    avgOrderValueCents,
    refundedCount,
    hourlyBuckets,
    paymentBreakdown,
    topProducts,
    lowStockCount,
  };
}
