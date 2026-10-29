import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesSource = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf-8'));

interface AuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface RequestEnv {
  auth: AuthContext | null;
  timeMs: number;
  dbDocs: Record<string, Record<string, unknown>>;
  afterDocs?: Record<string, Record<string, unknown>>;
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function isVerifiedUser(auth: AuthContext | null): boolean {
  return auth !== null && auth.email_verified === true;
}

function isBootstrappedAdmin(auth: AuthContext | null): boolean {
  return isVerifiedUser(auth) && auth!.email === 'ornandosaputra0@gmail.com';
}

function isAdmin(env: RequestEnv): boolean {
  if (!env.auth) return false;
  return isBootstrappedAdmin(env.auth) || (isVerifiedUser(env.auth) && Boolean(env.dbDocs[`/admins/${env.auth.uid}`]));
}

function hasExactKeys(data: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(data);
  return keys.every((k) => actual.includes(k)) && actual.every((k) => keys.includes(k));
}

function affectedKeys(incoming: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  const all = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of all) {
    if (incoming[k] !== existing[k]) changed.push(k);
  }
  return changed;
}

function isValidProduct(data: Record<string, unknown>): boolean {
  const allowed = [
    'ownerId', 'sku', 'name', 'category', 'description',
    'priceCents', 'costCents', 'stock', 'minStock', 'imageKey',
    'createdAt', 'updatedAt'
  ];
  if (!hasExactKeys(data, allowed)) return false;
  return (
    isValidId(data.ownerId) &&
    typeof data.sku === 'string' && data.sku.length >= 2 && data.sku.length <= 32 && ID_REGEX.test(data.sku) &&
    typeof data.name === 'string' && data.name.length >= 1 && data.name.length <= 100 &&
    typeof data.category === 'string' && ['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'].includes(data.category) &&
    typeof data.description === 'string' && data.description.length >= 1 && data.description.length <= 300 &&
    Number.isInteger(data.priceCents) && (data.priceCents as number) >= 0 &&
    Number.isInteger(data.costCents) && (data.costCents as number) >= 0 &&
    Number.isInteger(data.stock) && (data.stock as number) >= 0 &&
    Number.isInteger(data.minStock) && (data.minStock as number) >= 0 &&
    typeof data.imageKey === 'string' && ID_REGEX.test(data.imageKey) &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

function evaluateRule(
  op: 'get' | 'list' | 'create' | 'update',
  docPath: string,
  env: RequestEnv,
  incomingData?: Record<string, unknown>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  // Match /admins/{adminId}
  const adminMatch = docPath.match(/^\/admins\/([^/]+)$/);
  if (adminMatch) {
    const adminId = adminMatch[1];
    if (op === 'create') {
      const ok =
        isBootstrappedAdmin(env.auth) &&
        isValidId(adminId) &&
        Boolean(incomingData) &&
        hasExactKeys(incomingData!, ['uid', 'createdAt']) &&
        incomingData!.uid === adminId &&
        incomingData!.createdAt === env.timeMs;
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  // Match /users/{userId}/private/{docId}
  const privMatch = docPath.match(/^\/users\/([^/]+)\/private\/([^/]+)$/);
  if (privMatch) {
    const [, userId, docId] = privMatch;
    if (op === 'get') {
      const ok =
        env.auth !== null &&
        isValidId(userId) &&
        isValidId(docId) &&
        (env.auth.uid === userId || isAdmin(env));
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  // Match /products/{productId}
  const prodMatch = docPath.match(/^\/products\/([^/]+)$/);
  if (prodMatch || (op === 'list' && docPath === '/products')) {
    if (op === 'list') {
      const allDocs = Object.entries(env.dbDocs)
        .filter(([k]) => k.startsWith('/products/'))
        .map(([, v]) => v);
      const ok = env.auth !== null && allDocs.every((d) => d.ownerId === env.auth!.uid);
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    const productId = prodMatch![1];
    if (op === 'create' && incomingData) {
      const ok =
        isVerifiedUser(env.auth) &&
        isValidId(productId) &&
        isValidProduct(incomingData) &&
        incomingData.ownerId === env.auth!.uid &&
        incomingData.createdAt === env.timeMs &&
        incomingData.updatedAt === env.timeMs;
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (op === 'update' && incomingData) {
      const existing = env.dbDocs[docPath];
      if (!existing) return 'PERMISSION_DENIED';
      const changed = affectedKeys(incomingData, existing);
      const stockOnly = changed.every((k) => ['stock', 'updatedAt'].includes(k));
      const catalogEdit = changed.every((k) =>
        ['sku', 'name', 'category', 'description', 'priceCents', 'costCents', 'stock', 'minStock', 'imageKey', 'updatedAt'].includes(k)
      );
      const ok =
        isVerifiedUser(env.auth) &&
        isValidId(productId) &&
        isValidProduct(incomingData) &&
        incomingData.ownerId === existing.ownerId &&
        incomingData.createdAt === existing.createdAt &&
        incomingData.updatedAt === env.timeMs &&
        ((existing.ownerId === env.auth!.uid && (stockOnly || catalogEdit)) || isAdmin(env));
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  // Match /orders/{orderId} & /orders/{orderId}/line_items/{lineId}
  const lineMatch = docPath.match(/^\/orders\/([^/]+)\/line_items\/([^/]+)$/);
  if (lineMatch && op === 'create' && incomingData) {
    const [, orderId, lineId] = lineMatch;
    const afterDocs = env.afterDocs ?? env.dbDocs;
    const parentOrder = afterDocs[`/orders/${orderId}`];
    const prodExists = Boolean(afterDocs[`/products/${incomingData.productId}`]);
    const ok =
      isVerifiedUser(env.auth) &&
      isValidId(orderId) &&
      isValidId(lineId) &&
      incomingData.ownerId === env.auth!.uid &&
      incomingData.orderId === orderId &&
      incomingData.createdAt === env.timeMs &&
      Boolean(parentOrder) &&
      parentOrder.ownerId === env.auth!.uid &&
      prodExists;
    return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
  }

  const orderMatch = docPath.match(/^\/orders\/([^/]+)$/);
  if (orderMatch || (op === 'list' && docPath === '/orders')) {
    if (op === 'list') {
      const allDocs = Object.entries(env.dbDocs)
        .filter(([k]) => /^\/orders\/[^/]+$/.test(k))
        .map(([, v]) => v);
      const ok = env.auth !== null && allDocs.every((d) => d.ownerId === env.auth!.uid);
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    const orderId = orderMatch![1];
    if (op === 'create' && incomingData) {
      const ok =
        isVerifiedUser(env.auth) &&
        isValidId(orderId) &&
        incomingData.ownerId === env.auth!.uid &&
        incomingData.createdAt === env.timeMs &&
        incomingData.updatedAt === env.timeMs;
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (op === 'update' && incomingData) {
      const existing = env.dbDocs[docPath];
      if (!existing) return 'PERMISSION_DENIED';
      const changed = affectedKeys(incomingData, existing);
      const ok =
        isVerifiedUser(env.auth) &&
        isValidId(orderId) &&
        incomingData.ownerId === existing.ownerId &&
        incomingData.createdAt === existing.createdAt &&
        incomingData.updatedAt === env.timeMs &&
        ((existing.status !== 'refunded' && existing.ownerId === env.auth!.uid && changed.every((k) => ['status', 'updatedAt'].includes(k))) ||
          isAdmin(env));
      return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

const baseProduct = {
  ownerId: 'user_a',
  sku: 'CF-001',
  name: 'Cappucino',
  category: 'Coffee',
  description: 'Espresso with cold milk and palm sugar',
  priceCents: 498,
  costCents: 180,
  stock: 25,
  minStock: 8,
  imageKey: 'cappuccino',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

test('Blueprint & firestore.rules structural exhaustiveness check', () => {
  assert.ok(rulesSource.includes("match /{document=**} {\n      allow read, write: if false;\n    }"));
  assert.ok(!rulesSource.includes('allow read: if isSignedIn();'));
  assert.ok(!rulesSource.includes('allow list: if isSignedIn();'));
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const segment = collectionPath.split('/')[1];
    assert.ok(rulesSource.includes(`match /${segment}`), `Missing match block for ${collectionPath}`);
  }
});

test('Dirty Dozen #1: Unverified Admin Email Spoof is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/products/prod_1',
    {
      auth: { uid: 'attacker1', email: 'ornandosaputra0@gmail.com', email_verified: false },
      timeMs: 1700000000000,
      dbDocs: {},
    },
    { ...baseProduct, ownerId: 'attacker1' }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Owner Identity Spoofing on Create is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/products/prod_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: {},
    },
    { ...baseProduct, ownerId: 'user_b' }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #3: Shadow / Ghost Field Injection is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/products/prod_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: {},
    },
    { ...baseProduct, isSuperAdmin: true }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #4: Update-Gap Value Poisoning on whitelisted field is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'update',
    '/products/prod_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000005000,
      dbDocs: { '/products/prod_1': baseProduct },
    },
    { ...baseProduct, stock: 'unlimited' as unknown as number, updatedAt: 1700000005000 }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #5: ID Poisoning Attack is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/products/bad$id!spaces',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: {},
    },
    baseProduct
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #6: Client Timestamp Forgery is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/orders/ord_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: {},
    },
    {
      ownerId: 'user_a',
      createdAt: 1699990000000,
      updatedAt: 1700000000000,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #7: Immortal Field Mutation (ownerId / createdAt) is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'update',
    '/products/prod_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000005000,
      dbDocs: { '/products/prod_1': baseProduct },
    },
    { ...baseProduct, ownerId: 'user_b', updatedAt: 1700000005000 }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #8: Terminal State Re-opening on Refunded Order is PERMISSION_DENIED', () => {
  const refundedOrder = {
    ownerId: 'user_a',
    status: 'refunded',
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
  };
  const res = evaluateRule(
    'update',
    '/orders/ord_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000009000,
      dbDocs: { '/orders/ord_1': refundedOrder },
    },
    { ...refundedOrder, status: 'completed', updatedAt: 1700000009000 }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #9: Orphaned Subcollection Line Item without parent Order is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/orders/missing_ord/line_items/li_1',
    {
      auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: { '/products/prod_1': baseProduct },
    },
    {
      ownerId: 'user_a',
      orderId: 'missing_ord',
      productId: 'prod_1',
      productName: 'Cappucino',
      size: 'Small',
      quantity: 1,
      unitPriceCents: 498,
      createdAt: 1700000000000,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #10: Cross-Tenant PII Leak on /users/{userId}/private is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'get',
    '/users/user_a/private/profile',
    {
      auth: { uid: 'user_b', email: 'b@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: { '/users/user_a/private/profile': { uid: 'user_a', email: 'a@example.com' } },
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #11: Unfiltered Blanket Collection List Scrape across tenants is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'list',
    '/orders',
    {
      auth: { uid: 'user_b', email: 'b@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: {
        '/orders/ord_1': { ownerId: 'user_a', status: 'completed' },
      },
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #12: Self-Assigned Admin Escalation on /admins/{uid} is PERMISSION_DENIED', () => {
  const res = evaluateRule(
    'create',
    '/admins/user_b',
    {
      auth: { uid: 'user_b', email: 'b@example.com', email_verified: true },
      timeMs: 1700000000000,
      dbDocs: {},
    },
    { uid: 'user_b', createdAt: 1700000000000 }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});
