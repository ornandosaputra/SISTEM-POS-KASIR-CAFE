/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Lock, Menu, ShieldCheck, ShoppingBag } from 'lucide-react';
import {
  INITIAL_BACKUPS,
  INITIAL_CART_LINES,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_STAFF,
} from './data/seedData';
import {
  auth,
  createCloudBackupCheckpoint,
  deleteOrderFromCloud,
  deleteProductFromCloud,
  deleteStaffFromCloud,
  onAuthStateChanged,
  subscribeMerchantWorkspace,
  syncOrderWithLinesToCloud,
  syncProductToCloud,
  syncStaffToCloud,
  updateOrderDetailsInCloud,
  updateOrderStatusInCloud,
  updateProductInCloud,
  updateProductStockInCloud,
  updateStaffInCloud,
  type User,
} from './firebase';
import type {
  CartLineItem,
  CloudBackupRecord,
  CurrencyCode,
  CupSize,
  NavSection,
  OrderRecord,
  OrderStatus,
  OrderType,
  PaymentMethod,
  ProductItem,
  PushNotificationItem,
  RolePermissions,
  StaffMemberRecord,
} from './types';
import {
  canAccessNavSection,
  canSwitchStaffWithoutAuth,
  loadAdminSecurityConfig,
  saveAdminSecurityConfig,
  type AdminLockoutState,
  type AdminSecurityConfig,
} from './utils/adminAuth';
import {
  calculateCartTotals,
  calculateUnitPriceCents,
  calculateWeightGrams,
  canDeleteStaffMember,
  deductInventoryAndDetectLowStock,
  formatMoney,
  hasPermission,
  type DiscountMode,
  type OrderEditInput,
} from './utils/posLogic';
import {
  connectBluetoothThermalPrinter,
  type ThermalPrinterState,
} from './utils/thermalPrinter';
import { Sidebar } from './components/Sidebar';
import { PosCatalogView } from './components/PosCatalogView';
import { CartSidebar } from './components/CartSidebar';
import { CheckoutPaymentModal } from './components/CheckoutPaymentModal';
import { AnalyticsView } from './components/AnalyticsView';
import { InventoryView } from './components/InventoryView';
import { OrdersView } from './components/OrdersView';
import { MultiUserView } from './components/MultiUserView';
import { SettingsCloudPrinterView } from './components/SettingsCloudPrinterView';
import { ApiDocsView } from './components/ApiDocsView';
import { NotificationDrawer } from './components/NotificationDrawer';
import { AdminAuthModal } from './components/AdminAuthModal';

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('pos');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const currency: CurrencyCode = 'IDR';

  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [cartLines, setCartLines] = useState<CartLineItem[]>(INITIAL_CART_LINES);
  const [orderType, setOrderType] = useState<OrderType>('Delivery');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('member_15k');
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [orderCounter, setOrderCounter] = useState<number>(3243);

  // Boot by default in Cashier (Staff) mode with Mode Admin locked so employees cannot access Admin views without PIN/Login
  const [staffList, setStaffList] = useState<StaffMemberRecord[]>(INITIAL_STAFF);
  const [activeStaffId, setActiveStaffId] = useState<string>(() => {
    const defaultCashier =
      INITIAL_STAFF.find((s) => s.active && s.staffRole === 'Cashier') ||
      INITIAL_STAFF.find((s) => s.active && s.staffRole !== 'Admin') ||
      INITIAL_STAFF[0];
    return defaultCashier.id;
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminConfig, setAdminConfig] = useState<AdminSecurityConfig>(() =>
    loadAdminSecurityConfig()
  );
  const [adminLockout, setAdminLockout] = useState<AdminLockoutState>({
    failedAttempts: 0,
    lockedUntilMs: 0,
  });
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [adminModalReason, setAdminModalReason] = useState<string>('');
  const pendingAdminActionRef = useRef<(() => void) | null>(null);

  const [backups, setBackups] = useState<CloudBackupRecord[]>(INITIAL_BACKUPS);
  const [notifications, setNotifications] =
    useState<PushNotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(false);

  const [cloudUser, setCloudUser] = useState<User | null>(auth.currentUser);
  const [lastCloudSyncLabel, setLastCloudSyncLabel] = useState<string>('Baru saja');

  const [printerState, setPrinterState] = useState<ThermalPrinterState>({
    connected: false,
    deviceName: 'Spooler 58mm Siap',
    mode: 'virtual_58mm',
    paperWidthMm: 58,
  });

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Firebase Auth & Real-Time Firestore Workspace Listeners
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      if (user) {
        unsubscribeFirestore = subscribeMerchantWorkspace(user.uid, {
          onProducts: (cloudItems) => {
            if (cloudItems.length > 0) setProducts(cloudItems);
          },
          onOrders: (cloudOrders) => {
            if (cloudOrders.length > 0) setOrders(cloudOrders);
          },
          onBackups: (cloudBackups) => {
            if (cloudBackups.length > 0) setBackups(cloudBackups);
          },
          onSyncPulse: () => {
            setLastCloudSyncLabel(
              new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            );
          },
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((current) => (current === msg ? null : current));
    }, 3800);
  };

  const pushRealTimeNotification = (
    type: PushNotificationItem['type'],
    title: string,
    message: string
  ) => {
    const item: PushNotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      createdAtMs: Date.now(),
      read: false,
    };
    setNotifications((prev) => [item, ...prev]);
    showToast(`${title} — ${message}`);

    if (
      browserPushEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, { body: message });
      } catch {
        // Ignore iframe notification restrictions
      }
    }
  };

  const activeStaff = useMemo(
    () => staffList.find((s) => s.id === activeStaffId) || staffList[0],
    [staffList, activeStaffId]
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= p.minStock).length,
    [products]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const cartTotals = useMemo(
    () => calculateCartTotals(cartLines, discountMode),
    [cartLines, discountMode]
  );

  const nextOrderNumber = `ORD-${orderCounter}`;

  // --- Admin Mode Security Gate & Staff Session Logic ---

  const requestAdminElevation = (reason: string, onUnlocked?: () => void) => {
    pendingAdminActionRef.current = onUnlocked || null;
    setAdminModalReason(reason);
    setAdminModalOpen(true);
  };

  const handleAdminUnlockSuccess = () => {
    const adminStaff =
      staffList.find((s) => s.active && s.staffRole === 'Admin') || staffList[0];
    setIsAdminUnlocked(true);
    setActiveStaffId(adminStaff.id);
    setAdminModalOpen(false);

    const continuation = pendingAdminActionRef.current;
    pendingAdminActionRef.current = null;
    if (continuation) {
      continuation();
    }
    showToast(`Mode Admin aktif · Masuk sebagai ${adminStaff.name}.`);
  };

  const handleLockAdminMode = () => {
    const fallbackStaff =
      staffList.find((s) => s.active && s.staffRole === 'Cashier') ||
      staffList.find((s) => s.active && s.staffRole !== 'Admin') ||
      staffList[0];

    setIsAdminUnlocked(false);
    setActiveStaffId(fallbackStaff.id);
    if (!canAccessNavSection(activeNav, fallbackStaff, false)) {
      setActiveNav('pos');
    }
    showToast(`Mode Admin dikunci · Sesi beralih ke ${fallbackStaff.name} (${fallbackStaff.staffRole}).`);
  };

  const handleSelectNav = (nav: NavSection) => {
    if (canAccessNavSection(nav, activeStaff, isAdminUnlocked)) {
      setActiveNav(nav);
      return;
    }
    const navLabelMap: Record<NavSection, string> = {
      pos: 'Kasir',
      inventory: 'Inventaris',
      orders: 'Pesanan',
      analytics: 'Dasbor Analitik Bisnis',
      users: 'Manajemen Karyawan & RBAC',
      settings: 'Pengaturan Sistem & Keamanan',
      api: 'Dokumentasi Open API & Webhook',
    };
    requestAdminElevation(
      `Masukkan 6 digit PIN Admin untuk mengakses ${navLabelMap[nav]}.`,
      () => setActiveNav(nav)
    );
  };

  const handleSwitchStaff = (targetStaffId: string) => {
    const target = staffList.find((s) => s.id === targetStaffId);
    if (!target || !target.active) return;

    const check = canSwitchStaffWithoutAuth(target, isAdminUnlocked);
    if (!check.allowed && check.requiresAdminAuth) {
      requestAdminElevation(
        `Masukkan 6 digit PIN untuk beralih ke sesi ${target.name} (Admin).`,
        () => setActiveStaffId(target.id)
      );
      return;
    }

    if (target.staffRole !== 'Admin') {
      setActiveStaffId(target.id);
      if (isAdminUnlocked) {
        setIsAdminUnlocked(false);
      }
      if (!canAccessNavSection(activeNav, target, false)) {
        setActiveNav('pos');
      }
      showToast(`Sesi operator beralih ke ${target.name} (${target.staffRole}).`);
      return;
    }

    setActiveStaffId(target.id);
    showToast(`Sesi Admin aktif: ${target.name}.`);
  };

  const handleUpdateAdminSecurityConfig = (nextConfig: AdminSecurityConfig) => {
    setAdminConfig(nextConfig);
    saveAdminSecurityConfig(nextConfig);
  };

  // --- Cart & Checkout Handlers ---

  const handleAddOrSetCartItem = (product: ProductItem, size: CupSize, quantity: number) => {
    if (!hasPermission(activeStaff, 'canCheckout')) return;
    if (product.stock <= 0) return;
    const clampedQty = Math.max(1, Math.min(product.stock, quantity));
    const unitPriceCents = calculateUnitPriceCents(product.priceCents, size);
    const weightGrams = calculateWeightGrams(product.weightGrams, size);

    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id && l.size === size);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          productName: product.name,
          imageKey: product.imageKey,
          weightGrams,
          quantity: clampedQty,
          unitPriceCents,
        };
        return copy;
      }
      return [
        ...prev,
        {
          id: `line-${product.id}-${size.toLowerCase()}`,
          productId: product.id,
          productName: product.name,
          imageKey: product.imageKey,
          size,
          weightGrams,
          quantity: clampedQty,
          unitPriceCents,
        },
      ];
    });
  };

  const handleUpdateCartLineQty = (lineId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCartLines((prev) => prev.filter((l) => l.id !== lineId));
      return;
    }
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const prod = products.find((p) => p.id === line.productId);
        const maxStock = prod ? Math.max(1, prod.stock) : 99;
        return { ...line, quantity: Math.min(maxStock, nextQty) };
      })
    );
  };

  const handleConfirmPaidOrder = (
    paymentMethod: PaymentMethod,
    paymentRef: string
  ): OrderRecord => {
    const nowMs = Date.now();
    const itemsLabel = cartLines
      .map((l) => `${l.quantity}x ${l.productName} (${l.size})`)
      .join(', ');

    const newOrder: OrderRecord = {
      id: `ord-${orderCounter}-${nowMs.toString().slice(-4)}`,
      orderNumber: nextOrderNumber,
      orderType,
      paymentMethod,
      paymentRef,
      subtotalCents: cartTotals.itemsSubtotalCents,
      discountCents: cartTotals.discountCents,
      totalCents: cartTotals.totalCents,
      itemCount: cartTotals.totalQuantity,
      itemsLabel,
      cashierName: activeStaff.name,
      status: 'completed',
      createdAtMs: nowMs,
      lines: [...cartLines],
    };

    const { updatedProducts, lowStockTriggered } = deductInventoryAndDetectLowStock(
      products,
      cartLines,
      nowMs
    );

    setProducts(updatedProducts);
    setOrders((prev) => [newOrder, ...prev]);
    setCartLines([]);
    setOrderCounter((c) => c + 1);

    fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      syncOrderWithLinesToCloud(cloudUser.uid, newOrder, updatedProducts).catch(() => {});
    }

    pushRealTimeNotification(
      'transaction',
      `Transaksi Berhasil · ${newOrder.orderNumber}`,
      `Pembayaran ${paymentMethod} sebesar ${formatMoney(newOrder.totalCents, currency)} lunas.`
    );

    if (lowStockTriggered.length > 0) {
      const names = lowStockTriggered.map((p) => `${p.name} (sisa ${p.stock})`).join(', ');
      pushRealTimeNotification(
        'low_stock',
        'Peringatan Stok Menipis Real-Time',
        `Segera restock: ${names}.`
      );
    }

    return newOrder;
  };

  // --- Master CRUD: Products ---

  const handleAdjustStock = (productId: string, nextStock: number) => {
    if (!isAdminUnlocked && !hasPermission(activeStaff, 'canManageInventory')) return;
    const clamped = Math.max(0, Math.round(nextStock));
    let targetItem: ProductItem | undefined;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        targetItem = { ...p, stock: clamped, updatedAtMs: Date.now() };
        return targetItem;
      })
    );

    fetch(`/api/v1/products/${productId}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: clamped }),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      updateProductStockInCloud(cloudUser.uid, productId, clamped).catch(() => {});
    }

    if (targetItem && clamped <= targetItem.minStock) {
      pushRealTimeNotification(
        'low_stock',
        `Stok Menipis: ${targetItem.name}`,
        `Persediaan saat ini ${clamped} porsi (batas minimum ${targetItem.minStock}).`
      );
    } else if (targetItem) {
      showToast(`Stok ${targetItem.name} diperbarui menjadi ${clamped} porsi.`);
    }
  };

  const handleCreateProduct = (input: Omit<ProductItem, 'id' | 'updatedAtMs'>) => {
    if (!isAdminUnlocked) return;
    const created: ProductItem = {
      ...input,
      id: `prod-${Date.now()}`,
      updatedAtMs: Date.now(),
    };
    setProducts((prev) => [created, ...prev]);

    fetch('/api/v1/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(created),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      syncProductToCloud(cloudUser.uid, created).catch(() => {});
    }

    showToast(`Produk ${created.name} (${created.sku}) ditambahkan ke katalog.`);
  };

  const handleUpdateProduct = (
    productId: string,
    updates: Omit<ProductItem, 'id' | 'updatedAtMs'>
  ) => {
    if (!isAdminUnlocked) return;
    const updatedProduct: ProductItem = {
      ...updates,
      id: productId,
      updatedAtMs: Date.now(),
    };

    setProducts((prev) => prev.map((p) => (p.id === productId ? updatedProduct : p)));

    // Sync active cart lines if the edited product is currently in the cart
    setCartLines((prev) =>
      prev
        .filter((line) => (line.productId === productId ? updatedProduct.stock > 0 : true))
        .map((line) => {
          if (line.productId !== productId) return line;
          return {
            ...line,
            productName: updatedProduct.name,
            imageKey: updatedProduct.imageKey,
            weightGrams: calculateWeightGrams(updatedProduct.weightGrams, line.size),
            unitPriceCents: calculateUnitPriceCents(updatedProduct.priceCents, line.size),
            quantity: Math.min(line.quantity, Math.max(1, updatedProduct.stock)),
          };
        })
    );

    fetch(`/api/v1/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProduct),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      updateProductInCloud(cloudUser.uid, updatedProduct).catch(() => {});
    }

    showToast(`Data produk ${updatedProduct.name} (${updatedProduct.sku}) berhasil diperbarui.`);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!isAdminUnlocked) return;
    const removed = products.find((p) => p.id === productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCartLines((prev) => prev.filter((l) => l.productId !== productId));

    fetch(`/api/v1/products/${productId}`, { method: 'DELETE' }).catch(() => {});

    if (cloudUser?.emailVerified) {
      deleteProductFromCloud(cloudUser.uid, productId).catch(() => {});
    }
    showToast(`Produk ${removed?.name || ''} berhasil dihapus dari katalog.`);
  };

  // --- Master CRUD: Orders ---

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    if (status === 'refunded' && !isAdminUnlocked && !hasPermission(activeStaff, 'canRefund')) {
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    fetch(`/api/v1/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      updateOrderStatusInCloud(cloudUser.uid, orderId, status).catch(() => {});
    }
    pushRealTimeNotification(
      'transaction',
      'Status Pesanan Diperbarui',
      `Pesanan telah diubah menjadi ${status.toUpperCase()}.`
    );
  };

  const handleEditOrder = (orderId: string, updates: OrderEditInput) => {
    if (!isAdminUnlocked) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
    );

    fetch(`/api/v1/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      updateOrderDetailsInCloud(cloudUser.uid, orderId, updates).catch(() => {});
    }
    showToast('Detail pesanan berhasil diperbarui.');
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!isAdminUnlocked) return;
    const target = orders.find((o) => o.id === orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    fetch(`/api/v1/orders/${orderId}`, { method: 'DELETE' }).catch(() => {});

    if (cloudUser?.emailVerified) {
      deleteOrderFromCloud(cloudUser.uid, orderId).catch(() => {});
    }
    showToast(`Riwayat pesanan ${target?.orderNumber || ''} berhasil dihapus.`);
  };

  // --- Master CRUD: Staff & RBAC ---

  const handleTogglePermission = (staffId: string, perm: keyof RolePermissions) => {
    if (!isAdminUnlocked) return;
    setStaffList((prev) =>
      prev.map((member) => {
        if (member.id !== staffId) return member;
        if (perm === 'canManageUsers' && member.staffRole !== 'Admin') return member;
        const updated = { ...member, [perm]: !member[perm] };
        if (cloudUser?.emailVerified) {
          updateStaffInCloud(cloudUser.uid, updated).catch(() => {});
        }
        return updated;
      })
    );
  };

  const handleAddStaff = (newStaff: Omit<StaffMemberRecord, 'id'>) => {
    if (!isAdminUnlocked) return;
    const record: StaffMemberRecord = { ...newStaff, id: `staff-${Date.now()}` };
    setStaffList((prev) => [...prev, record]);

    fetch('/api/v1/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      syncStaffToCloud(cloudUser.uid, record).catch(() => {});
    }
    showToast(`Karyawan ${record.name} (${record.staffRole}) berhasil ditambahkan.`);
  };

  const handleUpdateStaff = (staffId: string, updates: Omit<StaffMemberRecord, 'id'>) => {
    if (!isAdminUnlocked) return;
    const updatedRecord: StaffMemberRecord = { ...updates, id: staffId };

    setStaffList((prev) => {
      const nextList = prev.map((s) => (s.id === staffId ? updatedRecord : s));
      if (activeStaffId === staffId && (!updatedRecord.active || updatedRecord.staffRole !== 'Admin')) {
        const otherAdmin = nextList.find((s) => s.active && s.staffRole === 'Admin');
        if (otherAdmin) {
          setActiveStaffId(otherAdmin.id);
        }
      }
      return nextList;
    });

    fetch(`/api/v1/staff/${staffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecord),
    }).catch(() => {});

    if (cloudUser?.emailVerified) {
      updateStaffInCloud(cloudUser.uid, updatedRecord).catch(() => {});
    }
    showToast(`Profil karyawan ${updatedRecord.name} berhasil diperbarui.`);
  };

  const handleDeleteStaff = (staffId: string) => {
    if (!isAdminUnlocked) return;
    const check = canDeleteStaffMember(staffList, staffId);
    if (!check.allowed) {
      showToast(check.reason || 'Akun tidak dapat dihapus.');
      return;
    }

    const removed = staffList.find((s) => s.id === staffId);
    const remaining = staffList.filter((s) => s.id !== staffId);
    setStaffList(remaining);

    if (activeStaffId === staffId && remaining.length > 0) {
      const nextAdmin = remaining.find((s) => s.active && s.staffRole === 'Admin') || remaining[0];
      setActiveStaffId(nextAdmin.id);
    }

    fetch(`/api/v1/staff/${staffId}`, { method: 'DELETE' }).catch(() => {});

    if (cloudUser?.emailVerified) {
      deleteStaffFromCloud(cloudUser.uid, staffId).catch(() => {});
    }
    showToast(`Akun staf ${removed?.name || ''} berhasil dihapus.`);
  };

  // --- Cloud Checkpoint, Printer & Push Notification Handlers ---

  const handleCreateCloudBackup = async () => {
    const totalRevenueCents = orders
      .filter((o) => o.status !== 'refunded')
      .reduce((s, o) => s + o.totalCents, 0);
    const checkpoint: CloudBackupRecord = {
      id: `bkp-${Date.now()}`,
      label: `Checkpoint Manual · ${new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      productCount: products.length,
      orderCount: orders.length,
      staffCount: staffList.length,
      totalRevenueCents,
      status: 'verified',
      createdAtMs: Date.now(),
    };

    if (cloudUser?.emailVerified) {
      await createCloudBackupCheckpoint(cloudUser.uid, checkpoint);
    } else {
      setBackups((prev) => [checkpoint, ...prev]);
    }

    pushRealTimeNotification(
      'cloud_sync',
      'Cadangan Data Berhasil Disimpan',
      `${checkpoint.productCount} SKU dan ${checkpoint.orderCount} transaksi telah diamankan.`
    );
  };

  const handleConnectPrinter = async () => {
    const res = await connectBluetoothThermalPrinter();
    setPrinterState({
      connected: res.ok,
      deviceName: res.deviceName,
      mode: res.mode,
      paperWidthMm: 58,
    });
    showToast(res.note);
  };

  const handleEnableBrowserPush = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPushEnabled(perm === 'granted');
      showToast(
        perm === 'granted'
          ? 'Notifikasi push browser diaktifkan.'
          : 'Notifikasi tetap tampil secara real-time di dalam aplikasi.'
      );
    } else {
      setBrowserPushEnabled(true);
      showToast('Notifikasi real-time aktif di pusat notifikasi aplikasi.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9FB] dark:bg-[#111317] text-[#1F1F1F] dark:text-neutral-100 flex flex-col lg:flex-row">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeNav={activeNav}
        onSelectNav={handleSelectNav}
        ordersCount={orders.length}
        lowStockCount={lowStockCount}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        isAdminUnlocked={isAdminUnlocked}
        demoPin={adminConfig.demoPin}
        canViewAnalytics={hasPermission(activeStaff, 'canViewAnalytics')}
        onRequestUnlockAdmin={() =>
          requestAdminElevation('Masukkan 6 digit PIN untuk membuka Mode Admin.')
        }
        onLockAdmin={handleLockAdminMode}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Mobile Compact Header (strictly <= 56px height) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-white dark:bg-[#181B20] border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Buka menu navigasi"
            className="p-2 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-[18px] font-bold tracking-tight whitespace-nowrap">
            <span className="text-[#FF9E67]">Purr&apos;</span>
            <span>Coffee</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              isAdminUnlocked
                ? handleLockAdminMode()
                : requestAdminElevation('Masukkan 6 digit PIN Mode Admin.')
            }
            aria-label={isAdminUnlocked ? 'Kunci Mode Admin' : 'Buka Mode Admin'}
            className={`p-2 rounded-full ${
              isAdminUnlocked
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-[#F7F7F8] dark:bg-[#22262E] text-neutral-600 dark:text-neutral-300'
            }`}
          >
            {isAdminUnlocked ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setNotifDrawerOpen(true)}
            aria-label="Buka notifikasi"
            className="relative p-2 rounded-full bg-[#F7F7F8] dark:bg-[#22262E]"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF9E67] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            aria-label="Buka keranjang kasir"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FF9E67] text-white text-[12.5px] font-semibold tabular-nums"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{cartTotals.totalQuantity}</span>
          </button>
        </div>
      </header>

      {/* Center Main Workspace */}
      <main className="flex-1 min-w-0 pb-20 xl:pb-0">
        {activeNav === 'pos' && (
          <PosCatalogView
            products={products}
            cartLines={cartLines}
            currency={currency}
            unreadNotifications={unreadNotifications}
            onOpenNotifications={() => setNotifDrawerOpen(true)}
            canCheckout={hasPermission(activeStaff, 'canCheckout')}
            onAddOrSetCartItem={handleAddOrSetCartItem}
          />
        )}

        {activeNav === 'analytics' && (
          <AnalyticsView
            orders={orders}
            products={products}
            currency={currency}
            canViewAnalytics={isAdminUnlocked || hasPermission(activeStaff, 'canViewAnalytics')}
            onNotifyExport={showToast}
          />
        )}

        {activeNav === 'inventory' && (
          <InventoryView
            products={products}
            currency={currency}
            canManageInventory={hasPermission(activeStaff, 'canManageInventory')}
            isAdminUnlocked={isAdminUnlocked}
            onRequestAdminForCrud={requestAdminElevation}
            onAdjustStock={handleAdjustStock}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeNav === 'orders' && (
          <OrdersView
            orders={orders}
            currency={currency}
            canRefund={hasPermission(activeStaff, 'canRefund')}
            isAdminUnlocked={isAdminUnlocked}
            onRequestAdminForCrud={requestAdminElevation}
            onUpdateStatus={handleUpdateOrderStatus}
            onEditOrder={handleEditOrder}
            onDeleteOrder={handleDeleteOrder}
            onNotify={showToast}
          />
        )}

        {activeNav === 'users' && (
          <MultiUserView
            staffList={staffList}
            activeStaffId={activeStaff.id}
            isAdminUnlocked={isAdminUnlocked}
            onRequestUnlockAdmin={() =>
              requestAdminElevation('Masukkan 6 digit PIN Admin untuk mengelola staf.')
            }
            onSelectActiveStaff={handleSwitchStaff}
            onTogglePermission={handleTogglePermission}
            onAddStaff={handleAddStaff}
            onUpdateStaff={handleUpdateStaff}
            onDeleteStaff={handleDeleteStaff}
          />
        )}

        {activeNav === 'settings' && (
          <SettingsCloudPrinterView
            isAdminUnlocked={isAdminUnlocked}
            onRequestUnlockAdmin={() =>
              requestAdminElevation('Masukkan 6 digit PIN Admin untuk membuka Pengaturan.')
            }
            adminConfig={adminConfig}
            onUpdateAdminConfig={handleUpdateAdminSecurityConfig}
            lastCloudSyncLabel={lastCloudSyncLabel}
            onCreateCloudBackup={handleCreateCloudBackup}
            backups={backups}
            products={products}
            orders={orders}
            staffList={staffList}
            printerState={printerState}
            onConnectPrinter={handleConnectPrinter}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
            currency={currency}
            canManageCloudApi={isAdminUnlocked || hasPermission(activeStaff, 'canManageCloudApi')}
            onNotify={showToast}
          />
        )}

        {activeNav === 'api' && (
          <ApiDocsView
            isAdminUnlocked={isAdminUnlocked}
            onRequestUnlockAdmin={() =>
              requestAdminElevation('Masukkan 6 digit PIN Admin untuk membuka API & Webhook.')
            }
            canManageCloudApi={isAdminUnlocked || hasPermission(activeStaff, 'canManageCloudApi')}
            onNotify={showToast}
          />
        )}
      </main>

      {/* Right Cart Panel (always visible on xl desktop on POS screen, drawer on smaller screens) */}
      {activeNav === 'pos' ? (
        <CartSidebar
          activeStaff={activeStaff}
          allStaff={staffList}
          isAdminUnlocked={isAdminUnlocked}
          onSwitchStaff={handleSwitchStaff}
          onLockAdmin={handleLockAdminMode}
          cloudUserEmail={cloudUser?.email}
          nextOrderNumber={nextOrderNumber}
          orderType={orderType}
          onChangeOrderType={setOrderType}
          cartLines={cartLines}
          discountMode={discountMode}
          onChangeDiscountMode={setDiscountMode}
          currency={currency}
          canCheckout={hasPermission(activeStaff, 'canCheckout')}
          onUpdateLineQty={handleUpdateCartLineQty}
          onClearCart={() => setCartLines([])}
          onOpenCheckout={() => setCheckoutModalOpen(true)}
          mobileOpen={mobileCartOpen}
          onCloseMobile={() => setMobileCartOpen(false)}
        />
      ) : (
        mobileCartOpen && (
          <CartSidebar
            activeStaff={activeStaff}
            allStaff={staffList}
            isAdminUnlocked={isAdminUnlocked}
            onSwitchStaff={handleSwitchStaff}
            onLockAdmin={handleLockAdminMode}
            cloudUserEmail={cloudUser?.email}
            nextOrderNumber={nextOrderNumber}
            orderType={orderType}
            onChangeOrderType={setOrderType}
            cartLines={cartLines}
            discountMode={discountMode}
            onChangeDiscountMode={setDiscountMode}
            currency={currency}
            canCheckout={hasPermission(activeStaff, 'canCheckout')}
            onUpdateLineQty={handleUpdateCartLineQty}
            onClearCart={() => setCartLines([])}
            onOpenCheckout={() => {
              setMobileCartOpen(false);
              setCheckoutModalOpen(true);
            }}
            mobileOpen={mobileCartOpen}
            onCloseMobile={() => setMobileCartOpen(false)}
          />
        )
      )}

      {/* Tablet / Mobile Compact Bottom Cart Bar when on POS view (< xl) */}
      {activeNav === 'pos' && cartLines.length > 0 && (
        <div className="xl:hidden fixed bottom-3 inset-x-4 z-20">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full h-12 px-5 rounded-full bg-[#333333] text-white shadow-lg flex items-center justify-between text-[13.5px] font-semibold"
          >
            <span>Keranjang · {cartTotals.totalQuantity} item</span>
            <span className="text-[#FF9E67] tabular-nums">
              {formatMoney(cartTotals.totalCents, currency)} · Lihat Cart
            </span>
          </button>
        </div>
      )}

      {/* Admin PIN Verification Modal */}
      <AdminAuthModal
        open={adminModalOpen}
        reasonLabel={adminModalReason}
        config={adminConfig}
        lockout={adminLockout}
        onUpdateLockout={setAdminLockout}
        onSuccessUnlock={handleAdminUnlockSuccess}
        onClose={() => {
          pendingAdminActionRef.current = null;
          setAdminModalOpen(false);
        }}
      />

      {/* Automated Digital Payment & Receipt Modal */}
      <CheckoutPaymentModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        orderNumber={nextOrderNumber}
        orderType={orderType}
        cashierName={activeStaff.name}
        cartLines={cartLines}
        subtotalCents={cartTotals.itemsSubtotalCents}
        discountCents={cartTotals.discountCents}
        totalCents={cartTotals.totalCents}
        currency={currency}
        printerState={printerState}
        onConnectPrinter={handleConnectPrinter}
        onConfirmPaidOrder={handleConfirmPaidOrder}
      />

      {/* Real-Time Push Notification Center */}
      <NotificationDrawer
        open={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        notifications={notifications}
        onMarkAllRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
        browserPushEnabled={browserPushEnabled}
        onEnableBrowserPush={handleEnableBrowserPush}
      />

      {/* Non-intrusive Real-Time Toast Banner */}
      {toastBanner && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-18 xl:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md px-5 py-3 rounded-full bg-[#1F1F1F] text-white dark:bg-white dark:text-neutral-900 text-[12.5px] font-medium shadow-xl whitespace-nowrap truncate"
        >
          {toastBanner}
        </div>
      )}
    </div>
  );
}
