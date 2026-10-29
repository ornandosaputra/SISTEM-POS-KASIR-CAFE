import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  Play,
  RefreshCw,
  Webhook,
} from 'lucide-react';

interface EndpointDoc {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  sampleBody?: Record<string, unknown>;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    summary: 'Health & Capabilities Check',
    description: 'Memeriksa ketersediaan server POS Open API, versi layanan, dan daftar modul integrasi aktif.',
  },
  {
    method: 'GET',
    path: '/api/v1/products',
    summary: 'Read — Daftar Katalog & Stok Real-Time',
    description: 'Mengambil seluruh SKU menu beserta harga Rupiah dan jumlah item menipis (?low_stock=true).',
  },
  {
    method: 'PUT',
    path: '/api/v1/products/prod-cappuccino',
    summary: 'Update — Edit Master Produk & Harga (Rp)',
    description: 'Memperbarui nama, deskripsi, harga jual Rupiah, HPP, atau stok produk berdasarkan ID/SKU.',
    sampleBody: { name: 'Cappucino Signature', priceCents: 29000, costCents: 10500 },
  },
  {
    method: 'PATCH',
    path: '/api/v1/products/prod-cappuccino/stock',
    summary: 'Mutasi Stok Gudang Eksternal',
    description: 'Memperbarui jumlah stok produk dari sistem ERP atau gudang pihak ketiga secara real-time.',
    sampleBody: { delta: 5 },
  },
  {
    method: 'GET',
    path: '/api/v1/staff',
    summary: 'Read — Daftar Karyawan & Peran RBAC',
    description: 'Mengambil seluruh data staf operator kasir, jadwal shift, dan status aktif.',
  },
  {
    method: 'GET',
    path: '/api/v1/orders',
    summary: 'Read — Riwayat Transaksi Harian',
    description: 'Mengambil daftar pesanan kasir, referensi pembayaran digital, dan akumulasi omzet.',
  },
  {
    method: 'POST',
    path: '/api/v1/payments/create-intent',
    summary: 'Buat Sesi Pembayaran Digital Otomatis',
    description: 'Menghasilkan payload QRIS dinamis, nomor Virtual Account, dan token rekonsiliasi otomatis.',
    sampleBody: { orderNumber: 'ORD-3299', amountCents: 101000, method: 'QRIS' },
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/daily',
    summary: 'Ringkasan Analitik Harian & Low-Stock SKU',
    description: 'Mengembalikan pendapatan kotor harian (Rp), jumlah transaksi, AOV, dan daftar SKU stok menipis.',
  },
];

interface ApiDocsViewProps {
  isAdminUnlocked: boolean;
  onRequestUnlockAdmin: () => void;
  canManageCloudApi: boolean;
  onNotify: (msg: string) => void;
}

export function ApiDocsView({
  isAdminUnlocked,
  onRequestUnlockAdmin,
  canManageCloudApi,
  onNotify,
}: ApiDocsViewProps) {
  const [apiKey, setApiKey] = useState('pk_live_purr_9f82a41c77e10b3d');
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc>(ENDPOINTS[0]);
  const [codeLang, setCodeLang] = useState<'curl' | 'javascript'>('curl');
  const [liveResponse, setLiveResponse] = useState<string>(
    '// Klik "Uji Endpoint Langsung" untuk memanggil server REST API v1'
  );
  const [liveStatus, setLiveStatus] = useState<string>('');
  const [testing, setTesting] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState('https://erp.mitra-bisnis.id/webhooks/purrcoffee');
  const [webhookStatus, setWebhookStatus] = useState('');

  if (!isAdminUnlocked) {
    return (
      <div className="p-6 sm:p-10 max-w-xl mx-auto">
        <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-[20px] font-bold text-neutral-900 dark:text-neutral-100">
            API Key &amp; Webhook Dikunci
          </h1>
          <p className="text-[13.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Kredensial produksi X-API-Key dan endpoint integrasi pihak ketiga dibatasi khusus untuk Administrator.
          </p>
          <button
            type="button"
            onClick={onRequestUnlockAdmin}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13.5px] font-semibold cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Buka Mode Admin</span>
          </button>
        </div>
      </div>
    );
  }

  const rotateKey = () => {
    const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
    setApiKey(`pk_live_purr_${token}`);
    onNotify('API Key produksi baru berhasil diterbitkan.');
  };

  const copyApiKey = () => {
    navigator.clipboard?.writeText(apiKey).catch(() => {});
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  const runLiveRequest = async (ep: EndpointDoc) => {
    setTesting(true);
    const t0 = performance.now();
    try {
      const res = await fetch(ep.path, {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: ep.sampleBody ? JSON.stringify(ep.sampleBody) : undefined,
      });
      const json = await res.json();
      const elapsed = Math.round(performance.now() - t0);
      setLiveStatus(`${res.status} ${res.statusText} · ${elapsed} ms`);
      setLiveResponse(JSON.stringify(json, null, 2));
    } catch (err) {
      setLiveStatus('Network Error');
      setLiveResponse(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/v1/webhooks/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['order.completed', 'inventory.low_stock'],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setWebhookStatus(`Terdaftar (${data.data.id}) · Event: order.completed, inventory.low_stock`);
      onNotify('Endpoint Webhook pihak ketiga berhasil disimpan.');
    } else {
      setWebhookStatus(data.message || 'URL webhook tidak valid.');
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlSnippet = `curl -X ${selectedEndpoint.method} "${originUrl}${selectedEndpoint.path}" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json"${
    selectedEndpoint.sampleBody ? ` \\\n  -d '${JSON.stringify(selectedEndpoint.sampleBody)}'` : ''
  }`;

  const jsSnippet = `const response = await fetch("${originUrl}${selectedEndpoint.path}", {\n  method: "${selectedEndpoint.method}",\n  headers: {\n    "X-API-Key": "${apiKey}",\n    "Content-Type": "application/json"\n  }${
    selectedEndpoint.sampleBody
      ? `,\n  body: JSON.stringify(${JSON.stringify(selectedEndpoint.sampleBody)})`
      : ''
  }\n});\nconst payload = await response.json();\nconsole.log(payload);`;

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            Integrasi Sistem Pihak Ketiga &amp; Dokumentasi Open API CRUD
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Hubungkan Purr&apos;Coffee POS dengan software akuntansi, ERP gudang, dan aplikasi pemesanan eksternal melalui REST API v1 &amp; Webhook.
          </p>
        </div>

        <a
          href="/api/v1/openapi.json"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-700 text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-100 hover:border-[#FF9E67] whitespace-nowrap shrink-0"
        >
          <ExternalLink className="w-4 h-4 text-[#FF9E67]" />
          <span>Spesifikasi OpenAPI 3.1 (.json)</span>
        </a>
      </div>

      {/* API Key & Webhook Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#FF9E67]" />
            <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
              Kredensial Otentikasi (X-API-Key)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] font-mono text-[12.5px] text-neutral-800 dark:text-neutral-200 truncate">
              {apiKey}
            </code>
            <button
              type="button"
              onClick={copyApiKey}
              aria-label="Salin API Key"
              className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-[#FF9E67] cursor-pointer"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            {canManageCloudApi && (
              <button
                type="button"
                onClick={rotateKey}
                aria-label="Putar ulang API Key baru"
                className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-[#FF9E67] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[12px] text-neutral-400">
            Sertakan pada header HTTP <code className="font-mono">X-API-Key</code> atau{' '}
            <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
          </p>
        </div>

        <form
          onSubmit={handleRegisterWebhook}
          className="bg-white dark:bg-[#181B20] rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-[#FF9E67]" />
            <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
              Webhook Real-Time (Order &amp; Stok Menipis)
            </h2>
          </div>

          <div className="flex gap-2">
            <label htmlFor="webhook-endpoint-input" className="sr-only">
              URL Endpoint Webhook
            </label>
            <input
              id="webhook-endpoint-input"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 text-[12.5px] font-mono"
            />
            <button
              type="submit"
              disabled={!canManageCloudApi}
              className="px-4 py-2 rounded-xl bg-[#333333] hover:bg-neutral-800 disabled:opacity-50 text-white text-[12.5px] font-semibold whitespace-nowrap cursor-pointer"
            >
              Simpan Webhook
            </button>
          </div>
          {webhookStatus && (
            <p className="text-[12px] text-emerald-600 dark:text-emerald-400">{webhookStatus}</p>
          )}
        </form>
      </div>

      {/* Interactive Reference & Live Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-white dark:bg-[#181B20] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
          {ENDPOINTS.map((ep) => {
            const active = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
            return (
              <button
                key={`${ep.method}-${ep.path}`}
                type="button"
                onClick={() => setSelectedEndpoint(ep)}
                className={`w-full text-left p-4 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#FF9E67]/10'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : ep.method === 'POST'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                          : ep.method === 'DELETE'
                            ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-[12.5px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {ep.path}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-neutral-500 dark:text-neutral-400">
                  {ep.summary}
                </p>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100">
                {selectedEndpoint.summary}
              </h2>
              <p className="text-[12.5px] text-neutral-500 mt-0.5">
                {selectedEndpoint.description}
              </p>
            </div>

            <button
              type="button"
              disabled={testing}
              onClick={() => runLiveRequest(selectedEndpoint)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testing ? 'Memanggil...' : 'Uji Endpoint Langsung'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2">
            {(['curl', 'javascript'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setCodeLang(lang)}
                className={`px-3 py-1 rounded-lg text-[12px] font-semibold cursor-pointer ${
                  codeLang === lang
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-500'
                }`}
              >
                {lang === 'curl' ? 'cURL' : 'JavaScript (fetch)'}
              </button>
            ))}
          </div>

          <pre className="p-4 rounded-xl bg-[#14171C] text-neutral-100 font-mono text-[12px] overflow-x-auto leading-relaxed">
            {codeLang === 'curl' ? curlSnippet : jsSnippet}
          </pre>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                Respons Server Langsung
              </span>
              {liveStatus && (
                <span className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {liveStatus}
                </span>
              )}
            </div>
            <pre className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#111317] border border-neutral-200 dark:border-neutral-800 font-mono text-[12px] text-neutral-800 dark:text-neutral-200 max-h-64 overflow-auto">
              {liveResponse}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
