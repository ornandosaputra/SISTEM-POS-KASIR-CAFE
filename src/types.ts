export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type MenuCategory = 'Coffee' | 'Non Coffee' | 'Food' | 'Snack' | 'Dessert';

export type CupSize = 'Small' | 'Large';

export type OrderType = 'Delivery' | 'Dine in' | 'Take away';

export type PaymentMethod = 'QRIS' | 'E-Wallet' | 'Card' | 'Cash';

export type OrderStatus = 'preparing' | 'completed' | 'refunded';

export type StaffRole = 'Admin' | 'Manager' | 'Cashier' | 'Inventory';

export type CurrencyCode = 'IDR';

export type NavSection =
  | 'pos'
  | 'analytics'
  | 'orders'
  | 'inventory'
  | 'users'
  | 'settings'
  | 'api';

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: MenuCategory;
  description: string;
  priceCents: number;
  costCents: number;
  stock: number;
  minStock: number;
  imageKey: string;
  weightGrams: number;
  updatedAtMs: number;
}

export interface CartLineItem {
  id: string;
  productId: string;
  productName: string;
  imageKey: string;
  size: CupSize;
  weightGrams: number;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  itemCount: number;
  itemsLabel: string;
  cashierName: string;
  status: OrderStatus;
  createdAtMs: number;
  lines: CartLineItem[];
}

export interface RolePermissions {
  canCheckout: boolean;
  canRefund: boolean;
  canManageInventory: boolean;
  canViewAnalytics: boolean;
  canManageUsers: boolean;
  canManageCloudApi: boolean;
}

export interface StaffMemberRecord extends RolePermissions {
  id: string;
  name: string;
  email: string;
  staffRole: StaffRole;
  shiftLabel: string;
  active: boolean;
}

export interface CloudBackupRecord {
  id: string;
  label: string;
  productCount: number;
  orderCount: number;
  staffCount: number;
  totalRevenueCents: number;
  status: 'verified' | 'archived';
  createdAtMs: number;
}

export interface PushNotificationItem {
  id: string;
  type: 'low_stock' | 'transaction' | 'cloud_sync';
  title: string;
  message: string;
  createdAtMs: number;
  read: boolean;
}
