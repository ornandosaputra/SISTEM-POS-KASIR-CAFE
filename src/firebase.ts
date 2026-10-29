import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  OperationType,
  type CloudBackupRecord,
  type OrderRecord,
  type ProductItem,
  type StaffMemberRecord,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

export async function signInWithGoogleCloud(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  if (user.emailVerified && user.email) {
    const publicPath = `users/${user.uid}/public/profile`;
    const privatePath = `users/${user.uid}/private/info`;
    try {
      await setDoc(doc(db, publicPath), {
        uid: user.uid,
        displayName: (user.displayName || 'Store Manager').slice(0, 80),
        storeName: "Purr'Coffee Flagship",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, privatePath), {
        uid: user.uid,
        email: user.email.slice(0, 160),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, publicPath);
    }
  }
  return user;
}

export async function signOutCloud(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

export async function syncProductToCloud(uid: string, product: ProductItem): Promise<void> {
  const docId = sanitizeId(`${uid}_${product.id}`);
  const path = `products/${docId}`;
  try {
    await setDoc(doc(db, 'products', docId), {
      ownerId: uid,
      sku: sanitizeId(product.sku).slice(0, 32),
      name: product.name.slice(0, 100),
      category: product.category,
      description: product.description.slice(0, 300),
      priceCents: Math.max(0, Math.round(product.priceCents)),
      costCents: Math.max(0, Math.round(product.costCents)),
      stock: Math.max(0, Math.round(product.stock)),
      minStock: Math.max(0, Math.round(product.minStock)),
      imageKey: sanitizeId(product.imageKey).slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateProductInCloud(uid: string, product: ProductItem): Promise<void> {
  const docId = sanitizeId(`${uid}_${product.id}`);
  const path = `products/${docId}`;
  try {
    await updateDoc(doc(db, 'products', docId), {
      sku: sanitizeId(product.sku).slice(0, 32),
      name: product.name.slice(0, 100),
      category: product.category,
      description: product.description.slice(0, 300),
      priceCents: Math.max(0, Math.round(product.priceCents)),
      costCents: Math.max(0, Math.round(product.costCents)),
      stock: Math.max(0, Math.round(product.stock)),
      minStock: Math.max(0, Math.round(product.minStock)),
      imageKey: sanitizeId(product.imageKey).slice(0, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('no document to update')) {
      await syncProductToCloud(uid, product);
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateProductStockInCloud(uid: string, productId: string, nextStock: number): Promise<void> {
  const docId = sanitizeId(`${uid}_${productId}`);
  const path = `products/${docId}`;
  try {
    await updateDoc(doc(db, 'products', docId), {
      stock: Math.max(0, Math.round(nextStock)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProductFromCloud(uid: string, productId: string): Promise<void> {
  const docId = sanitizeId(`${uid}_${productId}`);
  const path = `products/${docId}`;
  try {
    await deleteDoc(doc(db, 'products', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncOrderWithLinesToCloud(
  uid: string,
  order: OrderRecord,
  allProducts: ProductItem[]
): Promise<void> {
  const orderDocId = sanitizeId(`${uid}_${order.id}`);
  const orderPath = `orders/${orderDocId}`;
  try {
    const batch = writeBatch(db);

    // Ensure referenced products exist in the same or prior state for relational integrity
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    for (const line of order.lines) {
      const p = productMap.get(line.productId);
      if (p) {
        const prodDocId = sanitizeId(`${uid}_${p.id}`);
        batch.set(doc(db, 'products', prodDocId), {
          ownerId: uid,
          sku: sanitizeId(p.sku).slice(0, 32),
          name: p.name.slice(0, 100),
          category: p.category,
          description: p.description.slice(0, 300),
          priceCents: Math.max(0, Math.round(p.priceCents)),
          costCents: Math.max(0, Math.round(p.costCents)),
          stock: Math.max(0, Math.round(p.stock)),
          minStock: Math.max(0, Math.round(p.minStock)),
          imageKey: sanitizeId(p.imageKey).slice(0, 64),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    batch.set(doc(db, 'orders', orderDocId), {
      ownerId: uid,
      orderNumber: sanitizeId(order.orderNumber).slice(0, 24),
      orderType: order.orderType,
      paymentMethod: order.paymentMethod,
      paymentRef: sanitizeId(order.paymentRef).slice(0, 64),
      subtotalCents: Math.max(0, Math.round(order.subtotalCents)),
      discountCents: Math.max(0, Math.round(order.discountCents)),
      totalCents: Math.max(0, Math.round(order.totalCents)),
      itemCount: Math.max(1, Math.round(order.itemCount)),
      itemsLabel: order.itemsLabel.slice(0, 400),
      cashierName: order.cashierName.slice(0, 80),
      status: order.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const line of order.lines) {
      const lineDocId = sanitizeId(line.id);
      const prodDocId = sanitizeId(`${uid}_${line.productId}`);
      batch.set(doc(db, 'orders', orderDocId, 'line_items', lineDocId), {
        ownerId: uid,
        orderId: orderDocId,
        productId: prodDocId,
        productName: line.productName.slice(0, 100),
        size: line.size,
        quantity: Math.max(1, Math.round(line.quantity)),
        unitPriceCents: Math.max(0, Math.round(line.unitPriceCents)),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, orderPath);
  }
}

export async function updateOrderStatusInCloud(
  uid: string,
  orderId: string,
  status: 'preparing' | 'completed' | 'refunded'
): Promise<void> {
  const orderDocId = sanitizeId(`${uid}_${orderId}`);
  const path = `orders/${orderDocId}`;
  try {
    await updateDoc(doc(db, 'orders', orderDocId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderDetailsInCloud(
  uid: string,
  orderId: string,
  updates: {
    orderType: OrderRecord['orderType'];
    paymentMethod: OrderRecord['paymentMethod'];
    paymentRef: string;
    cashierName: string;
    status: OrderRecord['status'];
  }
): Promise<void> {
  const orderDocId = sanitizeId(`${uid}_${orderId}`);
  const path = `orders/${orderDocId}`;
  try {
    await updateDoc(doc(db, 'orders', orderDocId), {
      orderType: updates.orderType,
      paymentMethod: updates.paymentMethod,
      paymentRef: sanitizeId(updates.paymentRef).slice(0, 64),
      cashierName: updates.cashierName.slice(0, 80),
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderFromCloud(uid: string, orderId: string): Promise<void> {
  const orderDocId = sanitizeId(`${uid}_${orderId}`);
  const path = `orders/${orderDocId}`;
  try {
    await deleteDoc(doc(db, 'orders', orderDocId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncStaffToCloud(uid: string, staff: StaffMemberRecord): Promise<void> {
  const docId = sanitizeId(`${uid}_${staff.id}`);
  const path = `staff_members/${docId}`;
  try {
    await setDoc(doc(db, 'staff_members', docId), {
      ownerId: uid,
      name: staff.name.slice(0, 80),
      staffRole: staff.staffRole,
      shiftLabel: staff.shiftLabel.slice(0, 40),
      active: Boolean(staff.active),
      canCheckout: Boolean(staff.canCheckout),
      canRefund: Boolean(staff.canRefund),
      canManageInventory: Boolean(staff.canManageInventory),
      canViewAnalytics: Boolean(staff.canViewAnalytics),
      canManageUsers: Boolean(staff.canManageUsers),
      canManageCloudApi: Boolean(staff.canManageCloudApi),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateStaffInCloud(uid: string, staff: StaffMemberRecord): Promise<void> {
  const docId = sanitizeId(`${uid}_${staff.id}`);
  const path = `staff_members/${docId}`;
  try {
    await updateDoc(doc(db, 'staff_members', docId), {
      name: staff.name.slice(0, 80),
      staffRole: staff.staffRole,
      shiftLabel: staff.shiftLabel.slice(0, 40),
      active: Boolean(staff.active),
      canCheckout: Boolean(staff.canCheckout),
      canRefund: Boolean(staff.canRefund),
      canManageInventory: Boolean(staff.canManageInventory),
      canViewAnalytics: Boolean(staff.canViewAnalytics),
      canManageUsers: Boolean(staff.canManageUsers),
      canManageCloudApi: Boolean(staff.canManageCloudApi),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('no document to update')) {
      await syncStaffToCloud(uid, staff);
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStaffFromCloud(uid: string, staffId: string): Promise<void> {
  const docId = sanitizeId(`${uid}_${staffId}`);
  const path = `staff_members/${docId}`;
  try {
    await deleteDoc(doc(db, 'staff_members', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCloudBackupCheckpoint(
  uid: string,
  backup: CloudBackupRecord
): Promise<void> {
  const docId = sanitizeId(`${uid}_${backup.id}`);
  const path = `cloud_backups/${docId}`;
  try {
    await setDoc(doc(db, 'cloud_backups', docId), {
      ownerId: uid,
      label: backup.label.slice(0, 100),
      productCount: Math.max(0, Math.round(backup.productCount)),
      orderCount: Math.max(0, Math.round(backup.orderCount)),
      staffCount: Math.max(0, Math.round(backup.staffCount)),
      totalRevenueCents: Math.max(0, Math.round(backup.totalRevenueCents)),
      status: backup.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeMerchantWorkspace(
  uid: string,
  callbacks: {
    onProducts: (items: ProductItem[]) => void;
    onOrders: (orders: OrderRecord[]) => void;
    onBackups: (backups: CloudBackupRecord[]) => void;
    onSyncPulse: () => void;
  }
): Unsubscribe {
  const unsubProducts = onSnapshot(
    query(collection(db, 'products'), where('ownerId', '==', uid)),
    (snap) => {
      if (!snap.empty) {
        const mapped: ProductItem[] = snap.docs.map((d) => {
          const data = d.data();
          const rawId = d.id.startsWith(`${uid}_`) ? d.id.slice(uid.length + 1) : d.id;
          return {
            id: rawId,
            sku: String(data.sku || 'CF-000'),
            name: String(data.name || 'Item'),
            category: (data.category as ProductItem['category']) || 'Coffee',
            description: String(data.description || ''),
            priceCents: Number(data.priceCents) || 0,
            costCents: Number(data.costCents) || 0,
            stock: Number(data.stock) || 0,
            minStock: Number(data.minStock) || 5,
            imageKey: String(data.imageKey || 'cappuccino'),
            weightGrams: 200,
            updatedAtMs: data.updatedAt?.toMillis?.() || Date.now(),
          };
        });
        callbacks.onProducts(mapped);
        callbacks.onSyncPulse();
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    }
  );

  const unsubOrders = onSnapshot(
    query(collection(db, 'orders'), where('ownerId', '==', uid)),
    (snap) => {
      if (!snap.empty) {
        const mapped: OrderRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            const rawId = d.id.startsWith(`${uid}_`) ? d.id.slice(uid.length + 1) : d.id;
            return {
              id: rawId,
              orderNumber: String(data.orderNumber || 'ORD-0000'),
              orderType: (data.orderType as OrderRecord['orderType']) || 'Dine in',
              paymentMethod: (data.paymentMethod as OrderRecord['paymentMethod']) || 'QRIS',
              paymentRef: String(data.paymentRef || 'PAY-000'),
              subtotalCents: Number(data.subtotalCents) || 0,
              discountCents: Number(data.discountCents) || 0,
              totalCents: Number(data.totalCents) || 0,
              itemCount: Number(data.itemCount) || 1,
              itemsLabel: String(data.itemsLabel || ''),
              cashierName: String(data.cashierName || 'Cashier'),
              status: (data.status as OrderRecord['status']) || 'completed',
              createdAtMs: data.createdAt?.toMillis?.() || Date.now(),
              lines: [],
            };
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        callbacks.onOrders(mapped);
        callbacks.onSyncPulse();
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );

  const unsubBackups = onSnapshot(
    query(collection(db, 'cloud_backups'), where('ownerId', '==', uid)),
    (snap) => {
      if (!snap.empty) {
        const mapped: CloudBackupRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            const rawId = d.id.startsWith(`${uid}_`) ? d.id.slice(uid.length + 1) : d.id;
            return {
              id: rawId,
              label: String(data.label || 'Cloud Checkpoint'),
              productCount: Number(data.productCount) || 0,
              orderCount: Number(data.orderCount) || 0,
              staffCount: Number(data.staffCount) || 0,
              totalRevenueCents: Number(data.totalRevenueCents) || 0,
              status: (data.status as CloudBackupRecord['status']) || 'verified',
              createdAtMs: data.createdAt?.toMillis?.() || Date.now(),
            };
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        callbacks.onBackups(mapped);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cloud_backups');
    }
  );

  return () => {
    unsubProducts();
    unsubOrders();
    unsubBackups();
  };
}
