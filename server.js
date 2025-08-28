// server.js (r2) — picks largest dataset + sanitizes image URLs to avoid ORB
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// --- Security headers (CSP allows Unsplash image domains)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://source.unsplash.com",
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

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/data', express.static(path.join(PUBLIC_DIR, 'data')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/images', express.static(path.join(PUBLIC_DIR, 'images')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/healthz', (req, res) => res.json({ ok: true, version: 'server-r2' }));
app.get('/__whoami', (req, res) => res.json({ running: 'server.js (r2)', routes: app._router.stack.filter(l=>l.route).map(l=>`${Object.keys(l.route.methods).map(m=>m.toUpperCase()).join(',')} ${l.route.path}`) }));
app.get('/__files', (req, res) => {
  const c = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json'),
  ];
  res.json({ public: PUBLIC_DIR, candidates: c.map(p => ({ path: p, exists: fs.existsSync(p), size: fs.existsSync(p) ? fs.statSync(p).size : 0 })) });
});

// ---------- Data helpers
function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function extractItems(j) {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  return j.items || j.data || j.results || j.products || [];
}
function toCents(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const m = v.match(/([\d.,]+)/);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (!Number.isFinite(n)) return 0;
      return n < 1000 ? Math.round(n * 100) : Math.round(n);
    }
  }
  if (v && typeof v.price_cents === 'number') return Math.round(v.price_cents);
  return 0;
}
// fix common Unsplash shorthands to a safe, direct image URL
function sanitizeImage(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) {
    // already absolute, but make sure it's the images domain (pages HTML will cause ORB)
    if (/unsplash\.com\/photos\//.test(u)) {
      // convert a page URL to images CDN if possible
      const id = u.split('/photos/')[1]?.split(/[/?#]/)[0] || '';
      if (id) return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=640&q=80`;
    }
    return u;
  }
  // bare "photo-xxxxxxxxxxx" or just an ID → convert
  const idMatch = u.match(/photo-([a-zA-Z0-9_-]+)/) || u.match(/^([a-zA-Z0-9_-]{5,})$/);
  if (idMatch) {
    const id = idMatch[1] || idMatch[0];
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=640&q=80`;
  }
  // if it's a filename, make it local images path
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(u)) {
    return u.startsWith('/images/') ? u : `/images/${u.replace(/^\/+/, '')}`;
  }
  return '';
}
function normalizeItem(x, i = 0) {
  const id = x.id || x.sku || x.SKU || `sku-${String(i+1).padStart(4, '0')}`;
  const name = x.name || x.title || 'Unnamed';
  const brand = x.brand || x.maker || 'Salon';
  const category = x.category || x.type || '—';
  const price = toCents(x.price ?? x.price_cents ?? x.priceCents ?? x.cost);
  const image = sanitizeImage(x.image || x.img || x.photo || '');
  return { id, name, brand, category, price, image };
}
function chooseBestProducts() {
  const candidates = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json'),
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
  best.items = best.items.map((x, i) => normalizeItem(x, i));
  return best;
}

// ---------- API
app.get('/api/products', (req, res) => {
  const limit = Math.max(0, Math.min(5000, Number(req.query.limit) || 150));
  const best = chooseBestProducts();
  const items = best.items.slice(0, limit);
  res.json({ success: true, version: 'server-r2', source: best.file || 'none', count: items.length, items });
});

app.post('/api/chat', (req, res) => {
  const msg = (req.body && req.body.message || '').toLowerCase();
  if (!msg) return res.status(400).json({ success: false, error: 'message required' });
  const needs = /(acne|sensitive|irritation|retinol|aha|bha|toning|purple|blue|hair color|scalp)/.test(msg);
  if (needs && !/(oily|dry|combination|sensitive)/.test(msg)) {
    return res.json({ success: true, provider: 'followup',
      response: 'I have a quick question to tailor this for you.',
      followUp: { key: 'skinType', question: 'Which best describes your skin? (oily / combination / dry / sensitive)' } });
  }
  return res.json({ success: true, provider: 'fallback',
    response: 'Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.' });
});

// ---------- Catch-all (serve SPA pages)
app.get('*', (req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/') || p.startsWith('/__') || p === '/healthz') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Luminous r2 listening on ${HOST}:${PORT} (public=${PUBLIC_DIR})`));
