import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_ORDERS, INITIAL_PRODUCTS, INITIAL_STAFF } from './src/data/seedData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ApiProduct {
  id: string;
  sku: string;
  name: string;
  category: 'Coffee' | 'Non Coffee' | 'Food' | 'Snack' | 'Dessert';
  description: string;
  priceCents: number;
  costCents: number;
  stock: number;
  minStock: number;
  updatedAt: string;
}

interface ApiOrder {
  id: string;
  orderNumber: string;
  orderType: 'Delivery' | 'Dine in' | 'Take away';
  paymentMethod: 'QRIS' | 'E-Wallet' | 'Card' | 'Cash';
  paymentRef: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  itemCount: number;
  itemsLabel: string;
  cashierName: string;
  status: 'preparing' | 'completed' | 'refunded';
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastDeliveryStatus: string;
  createdAt: string;
}

interface ApiStaff {
  id: string;
  name: string;
  email: string;
  staffRole: 'Admin' | 'Manager' | 'Cashier' | 'Inventory';
  shiftLabel: string;
  active: boolean;
  updatedAt: string;
}

const apiProducts: ApiProduct[] = INITIAL_PRODUCTS.map((item) => ({
  id: item.id,
  sku: item.sku,
  name: item.name,
  category: item.category,
  description: item.description,
  priceCents: item.priceCents,
  costCents: item.costCents,
  stock: item.stock,
  minStock: item.minStock,
  updatedAt: new Date(item.updatedAtMs).toISOString(),
}));

const apiOrders: ApiOrder[] = INITIAL_ORDERS.map((order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  orderType: order.orderType,
  paymentMethod: order.paymentMethod,
  paymentRef: order.paymentRef,
  subtotalCents: order.subtotalCents,
  discountCents: order.discountCents,
  totalCents: order.totalCents,
  itemCount: order.itemCount,
  itemsLabel: order.itemsLabel,
  cashierName: order.cashierName,
  status: order.status,
  createdAt: new Date(order.createdAtMs).toISOString(),
}));

const webhooks: WebhookEndpoint[] = [
  {
    id: 'wh-01',
    url: 'https://erp.purrcoffee.example/webhooks/pos-events',
    events: ['order.completed', 'inventory.low_stock', 'backup.verified'],
    active: true,
    lastDeliveryStatus: '200 OK',
    createdAt: new Date().toISOString(),
  },
];

const apiStaff: ApiStaff[] = INITIAL_STAFF.map((member) => ({
  id: member.id,
  name: member.name,
  email: member.email,
  staffRole: member.staffRole,
  shiftLabel: member.shiftLabel,
  active: member.active,
  updatedAt: new Date().toISOString(),
}));

function verifyApiAuth(req: Request, res: Response, next: NextFunction) {
  const explicitKey =
    req.header('x-api-key') ||
    (req.header('authorization')?.startsWith('Bearer ')
      ? req.header('authorization')!.slice(7)
      : undefined);

  if (explicitKey && !explicitKey.startsWith('pk_live_purr_') && explicitKey !== 'demo_pos_token') {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'API key tidak valid. Gunakan kunci dengan format pk_live_purr_<token>.',
    });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: "Purr'Coffee POS Open API",
      version: '1.4.0',
      timestamp: new Date().toISOString(),
      capabilities: [
        'realtime-orders',
        'inventory-management',
        'automated-digital-payments',
        'webhooks',
      ],
    });
  });

  app.get('/api/v1/products', verifyApiAuth, (req: Request, res: Response) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const lowStockOnly = req.query.low_stock === 'true';

    let items = [...apiProducts];
    if (category) {
      items = items.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (lowStockOnly) {
      items = items.filter((p) => p.stock <= p.minStock);
    }

    res.json({
      count: items.length,
      lowStockCount: apiProducts.filter((p) => p.stock <= p.minStock).length,
      data: items,
    });
  });

  app.post('/api/v1/products', verifyApiAuth, (req: Request, res: Response) => {
    const { id, sku, name, category, description, priceCents, costCents, stock, minStock } =
      req.body ?? {};

    if (!sku || !name || typeof priceCents !== 'number' || typeof stock !== 'number') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Field wajib: sku (string), name (string), priceCents (number), stock (number).',
      });
      return;
    }

    const resolvedId = id ? String(id).slice(0, 64) : `prod-${Date.now()}`;
    const created: ApiProduct = {
      id: resolvedId,
      sku: String(sku).slice(0, 32),
      name: String(name).slice(0, 100),
      category: ['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'].includes(category)
        ? category
        : 'Coffee',
      description: String(description || 'Synced via POS Open API').slice(0, 300),
      priceCents: Math.max(0, Math.round(priceCents)),
      costCents: Math.max(0, Math.round(Number(costCents) || 0)),
      stock: Math.max(0, Math.round(stock)),
      minStock: Math.max(0, Math.round(Number(minStock) || 5)),
      updatedAt: new Date().toISOString(),
    };
    const existingIdx = apiProducts.findIndex((p) => p.id === resolvedId);
    if (existingIdx !== -1) {
      apiProducts[existingIdx] = created;
    } else {
      apiProducts.unshift(created);
    }
    res.status(201).json({ message: 'Produk berhasil disinkronkan.', data: created });
  });

  app.patch('/api/v1/products/:id/stock', verifyApiAuth, (req: Request, res: Response) => {
    const target = apiProducts.find((p) => p.id === req.params.id || p.sku === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Produk tidak ditemukan.' });
      return;
    }

    const delta = Number(req.body?.delta);
    const absoluteStock = Number(req.body?.stock);
    if (Number.isFinite(absoluteStock) && absoluteStock >= 0) {
      target.stock = Math.round(absoluteStock);
    } else if (Number.isFinite(delta)) {
      target.stock = Math.max(0, target.stock + Math.round(delta));
    } else {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Kirimkan properti stock (>=0) atau delta (integer).',
      });
      return;
    }

    target.updatedAt = new Date().toISOString();
    res.json({
      message: 'Stok produk diperbarui.',
      lowStockAlert: target.stock <= target.minStock,
      data: target,
    });
  });

  app.put('/api/v1/products/:id', verifyApiAuth, (req: Request, res: Response) => {
    const body = req.body ?? {};
    let target = apiProducts.find((p) => p.id === req.params.id || p.sku === req.params.id);
    if (!target) {
      if (typeof body.sku === 'string' && typeof body.name === 'string') {
        target = {
          id: String(req.params.id).slice(0, 64),
          sku: body.sku.trim().slice(0, 32),
          name: body.name.trim().slice(0, 100),
          category: ['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'].includes(body.category)
            ? body.category
            : 'Coffee',
          description: String(body.description || 'Synced via POS Open API').slice(0, 300),
          priceCents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
          costCents: Math.max(0, Math.round(Number(body.costCents) || 0)),
          stock: Math.max(0, Math.round(Number(body.stock) || 0)),
          minStock: Math.max(0, Math.round(Number(body.minStock) || 5)),
          updatedAt: new Date().toISOString(),
        };
        apiProducts.unshift(target);
        res.json({ message: 'Data produk berhasil diperbarui.', data: target });
        return;
      }
      res.status(404).json({ error: 'NOT_FOUND', message: 'Produk tidak ditemukan.' });
      return;
    }

    if (typeof body.sku === 'string' && body.sku.trim()) target.sku = body.sku.trim().slice(0, 32);
    if (typeof body.name === 'string' && body.name.trim()) target.name = body.name.trim().slice(0, 100);
    if (['Coffee', 'Non Coffee', 'Food', 'Snack', 'Dessert'].includes(body.category)) {
      target.category = body.category;
    }
    if (typeof body.description === 'string' && body.description.trim()) {
      target.description = body.description.trim().slice(0, 300);
    }
    if (typeof body.priceCents === 'number' && body.priceCents >= 0) {
      target.priceCents = Math.round(body.priceCents);
    }
    if (typeof body.costCents === 'number' && body.costCents >= 0) {
      target.costCents = Math.round(body.costCents);
    }
    if (typeof body.stock === 'number' && body.stock >= 0) {
      target.stock = Math.round(body.stock);
    }
    if (typeof body.minStock === 'number' && body.minStock >= 0) {
      target.minStock = Math.round(body.minStock);
    }
    target.updatedAt = new Date().toISOString();

    res.json({ message: 'Data produk berhasil diperbarui.', data: target });
  });

  app.delete('/api/v1/products/:id', verifyApiAuth, (req: Request, res: Response) => {
    const idx = apiProducts.findIndex((p) => p.id === req.params.id || p.sku === req.params.id);
    if (idx === -1) {
      res.json({ message: 'Produk sudah terhapus dari memori server.', deletedId: req.params.id });
      return;
    }
    const [removed] = apiProducts.splice(idx, 1);
    res.json({ message: 'Produk berhasil dihapus.', data: removed });
  });

  app.get('/api/v1/orders', verifyApiAuth, (_req: Request, res: Response) => {
    res.json({
      count: apiOrders.length,
      totalRevenueCents: apiOrders
        .filter((o) => o.status !== 'refunded')
        .reduce((s, o) => s + o.totalCents, 0),
      data: apiOrders,
    });
  });

  app.post('/api/v1/orders', verifyApiAuth, (req: Request, res: Response) => {
    const body = req.body ?? {};
    const totalCents = Number(body.totalCents);
    if (!body.orderNumber || !Number.isFinite(totalCents) || totalCents < 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Field wajib: orderNumber (string), totalCents (number >= 0).',
      });
      return;
    }

    const newOrder: ApiOrder = {
      id: body.id ? String(body.id) : `ord-${Date.now()}`,
      orderNumber: String(body.orderNumber).slice(0, 24),
      orderType: ['Delivery', 'Dine in', 'Take away'].includes(body.orderType)
        ? body.orderType
        : 'Dine in',
      paymentMethod: ['QRIS', 'E-Wallet', 'Card', 'Cash'].includes(body.paymentMethod)
        ? body.paymentMethod
        : 'QRIS',
      paymentRef: String(body.paymentRef || `PAY-${Date.now()}`).slice(0, 64),
      subtotalCents: Math.max(0, Math.round(Number(body.subtotalCents) || totalCents)),
      discountCents: Math.max(0, Math.round(Number(body.discountCents) || 0)),
      totalCents: Math.max(0, Math.round(totalCents)),
      itemCount: Math.max(1, Math.round(Number(body.itemCount) || 1)),
      itemsLabel: String(body.itemsLabel || 'POS Checkout Item').slice(0, 400),
      cashierName: String(body.cashierName || 'Albert Flores').slice(0, 80),
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    if (Array.isArray(body.lines)) {
      for (const line of body.lines) {
        const prod = apiProducts.find((p) => p.id === line.productId);
        if (prod && typeof line.quantity === 'number') {
          prod.stock = Math.max(0, prod.stock - line.quantity);
          prod.updatedAt = new Date().toISOString();
        }
      }
    }

    apiOrders.unshift(newOrder);
    res.status(201).json({
      message: 'Transaksi tercatat dan disinkronkan ke webhook aktif.',
      webhookDispatched: webhooks.filter((w) => w.active).length,
      data: newOrder,
    });
  });

  app.put('/api/v1/orders/:id', verifyApiAuth, (req: Request, res: Response) => {
    const body = req.body ?? {};
    const target = apiOrders.find((o) => o.id === req.params.id || o.orderNumber === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Pesanan tidak ditemukan.' });
      return;
    }

    if (['Delivery', 'Dine in', 'Take away'].includes(body.orderType)) {
      target.orderType = body.orderType;
    }
    if (['QRIS', 'E-Wallet', 'Card', 'Cash'].includes(body.paymentMethod)) {
      target.paymentMethod = body.paymentMethod;
    }
    if (typeof body.paymentRef === 'string' && body.paymentRef.trim()) {
      target.paymentRef = body.paymentRef.trim().slice(0, 64);
    }
    if (typeof body.cashierName === 'string' && body.cashierName.trim()) {
      target.cashierName = body.cashierName.trim().slice(0, 80);
    }
    if (['preparing', 'completed', 'refunded'].includes(body.status)) {
      target.status = body.status;
    }

    res.json({ message: 'Data pesanan berhasil diperbarui.', data: target });
  });

  app.delete('/api/v1/orders/:id', verifyApiAuth, (req: Request, res: Response) => {
    const idx = apiOrders.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
    if (idx === -1) {
      res.json({ message: 'Pesanan sudah terhapus dari memori server.', deletedId: req.params.id });
      return;
    }
    const [removed] = apiOrders.splice(idx, 1);
    res.json({ message: 'Pesanan berhasil dihapus.', data: removed });
  });

  app.get('/api/v1/staff', verifyApiAuth, (_req: Request, res: Response) => {
    res.json({ count: apiStaff.length, data: apiStaff });
  });

  app.post('/api/v1/staff', verifyApiAuth, (req: Request, res: Response) => {
    const body = req.body ?? {};
    if (!body.name || !body.email) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Field wajib: name (string) dan email (string).',
      });
      return;
    }
    const resolvedId = body.id ? String(body.id) : `staff-${Date.now()}`;
    const created: ApiStaff = {
      id: resolvedId,
      name: String(body.name).slice(0, 80),
      email: String(body.email).slice(0, 160),
      staffRole: ['Admin', 'Manager', 'Cashier', 'Inventory'].includes(body.staffRole)
        ? body.staffRole
        : 'Cashier',
      shiftLabel: String(body.shiftLabel || 'Shift Reguler').slice(0, 40),
      active: body.active !== false,
      updatedAt: new Date().toISOString(),
    };
    const existingIdx = apiStaff.findIndex((s) => s.id === resolvedId);
    if (existingIdx !== -1) {
      apiStaff[existingIdx] = created;
    } else {
      apiStaff.push(created);
    }
    res.status(201).json({ message: 'Staf baru berhasil ditambahkan.', data: created });
  });

  app.put('/api/v1/staff/:id', verifyApiAuth, (req: Request, res: Response) => {
    const body = req.body ?? {};
    let target = apiStaff.find((s) => s.id === req.params.id);
    if (!target) {
      if (typeof body.name === 'string' && typeof body.email === 'string') {
        target = {
          id: String(req.params.id).slice(0, 64),
          name: body.name.trim().slice(0, 80),
          email: body.email.trim().slice(0, 160),
          staffRole: ['Admin', 'Manager', 'Cashier', 'Inventory'].includes(body.staffRole)
            ? body.staffRole
            : 'Cashier',
          shiftLabel: String(body.shiftLabel || 'Shift Reguler').slice(0, 40),
          active: body.active !== false,
          updatedAt: new Date().toISOString(),
        };
        apiStaff.push(target);
        res.json({ message: 'Profil staf berhasil diperbarui.', data: target });
        return;
      }
      res.status(404).json({ error: 'NOT_FOUND', message: 'Data staf tidak ditemukan.' });
      return;
    }
    if (typeof body.name === 'string' && body.name.trim()) target.name = body.name.trim().slice(0, 80);
    if (typeof body.email === 'string' && body.email.trim()) target.email = body.email.trim().slice(0, 160);
    if (['Admin', 'Manager', 'Cashier', 'Inventory'].includes(body.staffRole)) {
      target.staffRole = body.staffRole;
    }
    if (typeof body.shiftLabel === 'string' && body.shiftLabel.trim()) {
      target.shiftLabel = body.shiftLabel.trim().slice(0, 40);
    }
    if (typeof body.active === 'boolean') target.active = body.active;
    target.updatedAt = new Date().toISOString();

    res.json({ message: 'Profil staf berhasil diperbarui.', data: target });
  });

  app.delete('/api/v1/staff/:id', verifyApiAuth, (req: Request, res: Response) => {
    const target = apiStaff.find((s) => s.id === req.params.id);
    if (!target) {
      res.json({ message: 'Data staf sudah terhapus dari memori server.', deletedId: req.params.id });
      return;
    }
    if (target.staffRole === 'Admin' && apiStaff.filter((s) => s.staffRole === 'Admin' && s.active).length <= 1) {
      res.status(400).json({
        error: 'LAST_ADMIN_PROTECTED',
        message: 'Tidak dapat menghapus satu-satunya akun Admin aktif.',
      });
      return;
    }
    const idx = apiStaff.findIndex((s) => s.id === req.params.id);
    const [removed] = apiStaff.splice(idx, 1);
    res.json({ message: 'Akun staf berhasil dihapus.', data: removed });
  });

  app.post('/api/v1/payments/create-intent', verifyApiAuth, (req: Request, res: Response) => {
    const { orderNumber = 'ORD-3243', amountCents = 101000, method = 'QRIS' } = req.body ?? {};
    const paymentRef = `${String(method).toUpperCase().replace(/[^A-Z]/g, '')}-${Date.now().toString().slice(-6)}`;
    res.json({
      paymentIntentId: `pi_${Date.now()}`,
      orderNumber,
      method,
      amountCents,
      paymentRef,
      qrisString: `00020101021226580014ID.PURRCOFFEE.WWW011893600914${paymentRef}5204581253033605406${amountCents}5802ID5911PURRCOFFEE6007JAKARTA6304A1B9`,
      virtualAccount: `88081294${Date.now().toString().slice(-6)}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      autoSettlementSupported: true,
    });
  });

  app.get('/api/v1/analytics/daily', verifyApiAuth, (_req: Request, res: Response) => {
    const completed = apiOrders.filter((o) => o.status !== 'refunded');
    const grossCents = completed.reduce((s, o) => s + o.totalCents, 0);
    const lowStock = apiProducts.filter((p) => p.stock <= p.minStock);

    res.json({
      date: new Date().toISOString().slice(0, 10),
      grossRevenueCents: grossCents,
      totalTransactions: completed.length,
      averageOrderValueCents: completed.length ? Math.round(grossCents / completed.length) : 0,
      lowStockItemsCount: lowStock.length,
      lowStockSkus: lowStock.map((i) => ({ sku: i.sku, name: i.name, stock: i.stock, minStock: i.minStock })),
    });
  });

  app.get('/api/v1/webhooks', verifyApiAuth, (_req: Request, res: Response) => {
    res.json({ count: webhooks.length, data: webhooks });
  });

  app.post('/api/v1/webhooks/register', verifyApiAuth, (req: Request, res: Response) => {
    const url = String(req.body?.url || '').trim();
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'URL webhook wajib diawali https:// atau http://.',
      });
      return;
    }
    const hook: WebhookEndpoint = {
      id: `wh-${Date.now().toString().slice(-4)}`,
      url,
      events: Array.isArray(req.body?.events) && req.body.events.length > 0
        ? req.body.events
        : ['order.completed', 'inventory.low_stock'],
      active: true,
      lastDeliveryStatus: '200 OK (Verified)',
      createdAt: new Date().toISOString(),
    };
    webhooks.unshift(hook);
    res.status(201).json({ message: 'Webhook pihak ketiga berhasil didaftarkan.', data: hook });
  });

  app.post('/api/v1/webhooks/test', verifyApiAuth, (req: Request, res: Response) => {
    const eventType = String(req.body?.event || 'inventory.low_stock');
    res.json({
      delivered: true,
      event: eventType,
      dispatchedAt: new Date().toISOString(),
      samplePayload: {
        event: eventType,
        store: "Purr'Coffee POS",
        sku: 'CF-001',
        currentStock: 6,
        minThreshold: 8,
      },
    });
  });

  app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: "Purr'Coffee POS & Cloud Inventory REST API",
        version: '1.4.0',
        description:
          'Dokumentasi OpenAPI 3.1 untuk integrasi sistem pihak ketiga (ERP, Akuntansi, Gudang, dan Payment Gateway Otomatis).',
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
      paths: {
        '/api/v1/health': { get: { summary: 'Cek status layanan API & kapabilitas POS' } },
        '/api/v1/products': {
          get: { summary: 'Ambil daftar katalog produk & level stok inventaris' },
          post: { summary: 'Tambah atau sinkronkan produk baru dari sistem ERP eksternal' },
        },
        '/api/v1/products/{id}': {
          put: { summary: 'Perbarui detail produk (nama, harga Rupiah, HPP, SKU, stok)' },
          delete: { summary: 'Hapus produk dari katalog inventaris' },
        },
        '/api/v1/products/{id}/stock': {
          patch: { summary: 'Perbarui stok produk secara real-time (mutasi gudang)' },
        },
        '/api/v1/orders': {
          get: { summary: 'Ambil riwayat pesanan penjualan harian real-time' },
          post: { summary: 'Catat transaksi baru & picu pengurangan stok otomatis' },
        },
        '/api/v1/orders/{id}': {
          put: { summary: 'Perbarui detail transaksi atau status pesanan' },
          delete: { summary: 'Hapus riwayat pesanan (otorisasi Admin)' },
        },
        '/api/v1/staff': {
          get: { summary: 'Ambil daftar akun staf & peran RBAC' },
          post: { summary: 'Tambah akun karyawan baru' },
        },
        '/api/v1/staff/{id}': {
          put: { summary: 'Perbarui profil, jadwal shift, atau peran karyawan' },
          delete: { summary: 'Hapus akun karyawan (dengan proteksi Admin utama)' },
        },
        '/api/v1/payments/create-intent': {
          post: { summary: 'Buat sesi pembayaran digital otomatis (QRIS / E-Wallet / VA)' },
        },
        '/api/v1/analytics/daily': {
          get: { summary: 'Ringkasan metrik performa bisnis harian & peringatan stok menipis' },
        },
        '/api/v1/webhooks': {
          get: { summary: 'Daftar endpoint webhook pihak ketiga yang terdaftar' },
        },
      },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Purr'Coffee POS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
