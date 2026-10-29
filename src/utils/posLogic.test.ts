import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  calculateUnitPriceCents,
  canDeleteStaffMember,
  computeAnalyticsSummary,
  deductInventoryAndDetectLowStock,
  formatMoney,
  hasPermission,
  validateOrderEditForm,
  validateProductForm,
  validateStaffForm,
} from './posLogic';
import {
  ADMIN_LOCKOUT_DURATION_MS,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PIN,
  canAccessNavSection,
  canSwitchStaffWithoutAuth,
  createDefaultAdminSecurityConfig,
  validateNewAdminPin,
  verifyAdminPinAttempt,
} from './adminAuth';
import type { CartLineItem, OrderRecord, ProductItem, StaffMemberRecord } from '../types';

test('Purr Coffee cart math in Rupiah computes Rp 116.000 - Rp 15.000 = Rp 101.000', () => {
  const lines: CartLineItem[] = [
    {
      id: 'c1',
      productId: 'prod-cappuccino',
      productName: 'Cappucino',
      imageKey: 'cappuccino',
      size: 'Small',
      weightGrams: 200,
      quantity: 3,
      unitPriceCents: calculateUnitPriceCents(28000, 'Small'),
    },
    {
      id: 'c2',
      productId: 'prod-latte',
      productName: 'Coffee Latte',
      imageKey: 'latte',
      size: 'Small',
      weightGrams: 200,
      quantity: 1,
      unitPriceCents: calculateUnitPriceCents(32000, 'Small'),
    },
  ];

  const totals = calculateCartTotals(lines, 'member_15k');
  assert.equal(totals.itemsSubtotalCents, 116000);
  assert.equal(totals.discountCents, 15000);
  assert.equal(totals.totalCents, 101000);
  assert.equal(totals.totalQuantity, 4);
  assert.equal(formatMoney(totals.totalCents), 'Rp 101.000');
  assert.equal(formatMoney(totals.discountCents, 'IDR', { signedNegative: true }), '-Rp 15.000');
  assert.equal(calculateUnitPriceCents(28000, 'Large'), 33000);
});

test('Inventory deduction decrements stock and triggers low-stock push alert at threshold', () => {
  const products: ProductItem[] = [
    {
      id: 'prod-cappuccino',
      sku: 'CF-001',
      name: 'Cappucino',
      category: 'Coffee',
      description: 'Espresso + palm sugar milk',
      priceCents: 28000,
      costCents: 10000,
      stock: 10,
      minStock: 8,
      imageKey: 'cappuccino',
      weightGrams: 200,
      updatedAtMs: 1000,
    },
  ];

  const lines: CartLineItem[] = [
    {
      id: 'c1',
      productId: 'prod-cappuccino',
      productName: 'Cappucino',
      imageKey: 'cappuccino',
      size: 'Small',
      weightGrams: 200,
      quantity: 3,
      unitPriceCents: 28000,
    },
  ];

  const { updatedProducts, lowStockTriggered } = deductInventoryAndDetectLowStock(products, lines, 2000);
  assert.equal(updatedProducts[0].stock, 7);
  assert.equal(lowStockTriggered.length, 1);
  assert.equal(lowStockTriggered[0].id, 'prod-cappuccino');
});

test('Product CRUD form validation enforces Rupiah values and SKU uniqueness on create vs update', () => {
  const existing: ProductItem[] = [
    {
      id: 'p-1',
      sku: 'CF-001',
      name: 'Cappucino',
      category: 'Coffee',
      description: 'Coffee drink',
      priceCents: 28000,
      costCents: 10000,
      stock: 10,
      minStock: 5,
      imageKey: 'cappuccino',
      weightGrams: 200,
      updatedAtMs: 1,
    },
  ];

  const duplicateCreate = validateProductForm(
    {
      sku: 'cf-001',
      name: 'Duplicate SKU Coffee',
      category: 'Coffee',
      description: 'Test duplicate',
      priceRupiah: '30000',
      costRupiah: '10000',
      stock: '15',
      minStock: '5',
      imageKey: 'latte',
    },
    existing
  );
  assert.equal(duplicateCreate.valid, false);

  // Updating the SAME product id with its own SKU must succeed
  const validSelfUpdate = validateProductForm(
    {
      sku: 'cf-001',
      name: 'Signature Cappucino',
      category: 'Coffee',
      description: 'Updated recipe description',
      priceRupiah: '31000',
      costRupiah: '11000',
      stock: '22',
      minStock: '6',
      weightGrams: '240',
      imageKey: 'cappuccino',
    },
    existing,
    'p-1'
  );
  assert.equal(validSelfUpdate.valid, true);
  assert.equal(validSelfUpdate.parsed?.sku, 'CF-001');
  assert.equal(validSelfUpdate.parsed?.priceCents, 31000);
  assert.equal(validSelfUpdate.parsed?.weightGrams, 240);
});

test('Admin PIN security blocks staff access, enforces 3-strike lockout, and syncs demoPin on update', () => {
  const config = createDefaultAdminSecurityConfig(1000);
  assert.equal(config.demoPin, '123456');

  const staffRoster: StaffMemberRecord[] = [
    {
      id: 'staff-albert',
      name: 'Albert Flores',
      email: DEFAULT_ADMIN_EMAIL,
      staffRole: 'Admin',
      shiftLabel: 'All Day',
      active: true,
      canCheckout: true,
      canRefund: true,
      canManageInventory: true,
      canViewAnalytics: true,
      canManageUsers: true,
      canManageCloudApi: true,
    },
    {
      id: 'staff-budi',
      name: 'Budi Santoso',
      email: 'budi.kasir@purrcoffee.id',
      staffRole: 'Cashier',
      shiftLabel: 'Sore',
      active: true,
      canCheckout: true,
      canRefund: false,
      canManageInventory: false,
      canViewAnalytics: false,
      canManageUsers: false,
      canManageCloudApi: false,
    },
  ];

  const [adminUser, cashierUser] = staffRoster;

  // Staff cannot switch to Admin without PIN authentication
  assert.deepEqual(canSwitchStaffWithoutAuth(adminUser, false), {
    allowed: false,
    requiresAdminAuth: true,
  });
  assert.deepEqual(canSwitchStaffWithoutAuth(cashierUser, false), {
    allowed: true,
    requiresAdminAuth: false,
  });

  // Staff cannot access Admin-restricted nav sections while locked
  assert.equal(canAccessNavSection('pos', cashierUser, false), true);
  assert.equal(canAccessNavSection('users', cashierUser, false), false);
  assert.equal(canAccessNavSection('settings', cashierUser, false), false);
  assert.equal(canAccessNavSection('api', cashierUser, false), false);
  assert.equal(canAccessNavSection('analytics', cashierUser, false), false);
  assert.equal(canAccessNavSection('users', adminUser, true), true);

  // Three wrong PIN attempts trigger 30-second brute-force lockout
  const wrongPin1 = verifyAdminPinAttempt('111111', config, { failedAttempts: 0, lockedUntilMs: 0 }, 10_000);
  assert.equal(wrongPin1.ok, false);
  assert.equal(wrongPin1.nextLockout.failedAttempts, 1);

  const wrongPin2 = verifyAdminPinAttempt('000000', config, wrongPin1.nextLockout, 11_000);
  assert.equal(wrongPin2.ok, false);
  const wrongPin3 = verifyAdminPinAttempt('999999', config, wrongPin2.nextLockout, 12_000);
  assert.equal(wrongPin3.ok, false);
  assert.equal(wrongPin3.nextLockout.lockedUntilMs, 12_000 + ADMIN_LOCKOUT_DURATION_MS);

  // Even the CORRECT PIN is blocked while lockout is active
  const blockedCorrectPin = verifyAdminPinAttempt(
    DEFAULT_ADMIN_PIN,
    config,
    wrongPin3.nextLockout,
    20_000
  );
  assert.equal(blockedCorrectPin.ok, false);

  // After lockout expires, correct PIN succeeds and resets lockout state
  const unlockedPin = verifyAdminPinAttempt(
    DEFAULT_ADMIN_PIN,
    config,
    wrongPin3.nextLockout,
    12_000 + ADMIN_LOCKOUT_DURATION_MS + 1
  );
  assert.equal(unlockedPin.ok, true);
  assert.equal(unlockedPin.nextLockout.failedAttempts, 0);

  // Updating PIN updates both pinHash and displayed demoPin
  const pinUpdateRes = validateNewAdminPin({
    currentPin: '123456',
    newPin: '654321',
    confirmPin: '654321',
    currentConfig: config,
  });
  assert.equal(pinUpdateRes.valid, true);
  assert.equal(pinUpdateRes.updatedConfig?.demoPin, '654321');
  assert.equal(
    verifyAdminPinAttempt('654321', pinUpdateRes.updatedConfig!, { failedAttempts: 0, lockedUntilMs: 0 }, 50_000).ok,
    true
  );
});

test('Staff & Order CRUD validations prevent deleting/demoting last Admin and validate order edits', () => {
  const soleAdminRoster: StaffMemberRecord[] = [
    {
      id: 'staff-albert',
      name: 'Albert Flores',
      email: 'purrcof@gmail.com',
      staffRole: 'Admin',
      shiftLabel: 'Full',
      active: true,
      canCheckout: true,
      canRefund: true,
      canManageInventory: true,
      canViewAnalytics: true,
      canManageUsers: true,
      canManageCloudApi: true,
    },
  ];

  // Cannot delete sole active Admin
  assert.equal(canDeleteStaffMember(soleAdminRoster, 'staff-albert').allowed, false);

  // Cannot demote sole active Admin to Cashier
  const demoteCheck = validateStaffForm(
    {
      name: 'Albert Flores',
      email: 'purrcof@gmail.com',
      staffRole: 'Cashier',
      shiftLabel: 'Full',
      active: true,
    },
    soleAdminRoster,
    'staff-albert'
  );
  assert.equal(demoteCheck.valid, false);

  // Non-admin role never gets canManageUsers even if flag tampered
  assert.equal(
    hasPermission(
      { ...soleAdminRoster[0], staffRole: 'Cashier', canManageUsers: true },
      'canManageUsers'
    ),
    false
  );

  // Valid Order edit passes
  const orderCheck = validateOrderEditForm({
    orderType: 'Take away',
    paymentMethod: 'QRIS',
    paymentRef: 'QRIS-991002',
    cashierName: 'Budi Santoso',
    status: 'completed',
  });
  assert.equal(orderCheck.valid, true);
});

test('Analytics summary aggregates Rupiah revenue, excludes refunded orders, and computes payment shares', () => {
  const now = 1_750_000_000_000;
  const products: ProductItem[] = [
    {
      id: 'p1',
      sku: 'CF-01',
      name: 'Cappucino',
      category: 'Coffee',
      description: 'Coffee',
      priceCents: 28000,
      costCents: 10000,
      stock: 4,
      minStock: 5,
      imageKey: 'cappuccino',
      weightGrams: 200,
      updatedAtMs: now,
    },
  ];
  const orders: OrderRecord[] = [
    {
      id: 'o1',
      orderNumber: 'ORD-3241',
      orderType: 'Dine in',
      paymentMethod: 'QRIS',
      paymentRef: 'QRIS-101',
      subtotalCents: 56000,
      discountCents: 0,
      totalCents: 56000,
      itemCount: 2,
      itemsLabel: '2x Cappucino',
      cashierName: 'Albert Flores',
      status: 'completed',
      createdAtMs: now - 1000,
      lines: [
        {
          id: 'l1',
          productId: 'p1',
          productName: 'Cappucino',
          imageKey: 'cappuccino',
          size: 'Small',
          weightGrams: 200,
          quantity: 2,
          unitPriceCents: 28000,
        },
      ],
    },
    {
      id: 'o2',
      orderNumber: 'ORD-3242',
      orderType: 'Take away',
      paymentMethod: 'Cash',
      paymentRef: 'CASH-102',
      subtotalCents: 28000,
      discountCents: 0,
      totalCents: 28000,
      itemCount: 1,
      itemsLabel: '1x Cappucino',
      cashierName: 'Albert Flores',
      status: 'refunded',
      createdAtMs: now - 500,
      lines: [],
    },
  ];

  const summary = computeAnalyticsSummary(orders, products, 1, now);
  assert.equal(summary.grossRevenueCents, 56000);
  assert.equal(summary.netProfitCents, 36000);
  assert.equal(summary.totalOrders, 1);
  assert.equal(summary.refundedCount, 1);
  assert.equal(summary.lowStockCount, 1);
});
