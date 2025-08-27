// server.js — choose the largest products dataset; Render-safe
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// --- Headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ].join('; '));
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// --- Static
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/data', express.static(path.join(PUBLIC_DIR, 'data')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/images', express.static(path.join(PUBLIC_DIR, 'images')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// --- Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- Diagnostics
app.get('/__files', (req, res) => {
  const candidates = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json')
  ];
  const exists = candidates.map(p => ({ path: p, exists: fs.existsSync(p) }));
  res.json({ PUBLIC_DIR, candidates: exists });
});

// --- Helpers
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function extractItems(j) {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  return j.items || j.data || j.results || j.products || [];
}
function normalizePriceCents(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const m = v.match(/([\d.,]+)/);
    if (m) {
      const n = Number(m[1].replace(/,/g,''));
      // if value looks like 12.34 treat as dollars; if 1234 treat as cents
      if (!Number.isFinite(n)) return 0;
      return (n < 1000 ? Math.round(n * 100) : Math.round(n));
    }
  }
  if (v && typeof v.price_cents === 'number') return Math.round(v.price_cents);
  return 0;
}
function normalizeItem(x, idx=0) {
  const id = x.id || x.sku || x.SKU || `sku-${String(idx+1).padStart(4,'0')}`;
  const name = x.name || x.title || 'Unnamed';
  const brand = x.brand || x.maker || 'Salon';
  const category = x.category || x.type || '—';
  const price = normalizePriceCents(x.price ?? x.price_cents ?? x.priceCents ?? x.cost);
  const image = x.image || x.img || x.photo || '';
  return { id, name, brand, category, price, image };
}

// --- Choose largest dataset among candidates
function chooseBestProducts() {
  const candidates = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json')
  ];
  let best = { file: null, items: [] };
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const j = readJSON(p);
    const arr = extractItems(j);
    if (Array.isArray(arr) && arr.length > (best.items?.length || 0)) {
      best = { file: p, items: arr };
    }
  }
  // normalize
  best.items = best.items.map((x,i)=>normalizeItem(x,i));
  return best;
}

// --- API: products
app.get('/api/products', (req, res) => {
  const limit = Math.max(0, Math.min(5000, Number(req.query.limit) || 150));
  const best = chooseBestProducts();
  const items = best.items.slice(0, limit);
  res.json({ success: true, source: best.file || 'none', count: items.length, items });
});

// --- API: chat (stub follow-up)
app.post('/api/chat', (req, res) => {
  const msg = (req.body && req.body.message || '').toLowerCase();
  if (!msg) return res.status(400).json({ success:false, error:'message required' });
  const needs = /(acne|sensitive|irritation|retinol|aha|bha|toning|purple|blue|hair color|scalp)/.test(msg);
  if (needs && !/(oily|dry|combination|sensitive)/.test(msg)) {
    return res.json({ success:true, provider:'followup',
      response:'I have a quick question to tailor this for you.',
      followUp:{ key:'skinType', question:'Which best describes your skin? (oily / combination / dry / sensitive)'} });
  }
  return res.json({ success:true, provider:'fallback', response:'Quick guidance:\\n• Book: Blowout or Hydration Facial.\\n• Retail: color-safe shampoo, bond mask, thermal protectant.\\n• Tip: finish with heat guard.' });
});

// --- Catch-all
app.get('*', (req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/') || p === '/api' || p.startsWith('/__') || p === '/healthz') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Start
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT}; public=${PUBLIC_DIR}`);
});
