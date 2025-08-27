// Luminous unified server (v2) — adds priceCents support + robust normalization
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// --- Security & JSON ---
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: '*'}));

// --- CSP (allow Unsplash + data/blob and same-origin) ---
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
  next();
});

// --- Helpers ---
const DATA_PATH = path.join(process.cwd(), 'data', 'products.json');

function toCents(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    // If it's a big integer (>= 1000) assume cents; if decimal/small assume dollars
    if (Number.isInteger(val) && val >= 1000) return val;
    return Math.round(val * 100);
  }
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase().replace(/[, ]/g, '');
    const m = s.match(/(\d+(\.\d+)?)/);
    if (!m) return 0;
    return Math.round(parseFloat(m[1]) * 100);
  }
  return 0;
}

function normImage(im) {
  if (!im) return null;
  const s = String(im).trim();
  if (/^https?:\/\//i.test(s)) return s;
  // ensure leading slash and URL-encode spaces
  return '/' + encodeURI(s.replace(/^\/+/, ''));
}

function firstDefined(obj, keys, fallback = undefined) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

function normalizeProduct(p, idx) {
  if (!p || typeof p !== 'object') p = {};
  const id = String(firstDefined(p, ['id','sku','code'], 'p' + (idx+1)));
  const name = String(firstDefined(p, ['name','title'], 'Untitled'));
  const brand = firstDefined(p, ['brand','line'], '');
  const category = firstDefined(p, ['category','type'], '');
  // Accept many price shapes, preferring cents keys
  const rawPrice = firstDefined(p, ['price_cents','priceCents','price_cent','priceUSD','priceUsd','price_usd','price'], 0);
  const priceCents = toCents(rawPrice);
  const image = normImage(firstDefined(p, ['image','image_url','photo'], ''));
  const usage = firstDefined(p, ['usage','howTo','how_to'], '');
  const country = firstDefined(p, ['country','origin'], '');
  return { id, name, brand, category, price: priceCents, image, usage, country };
}

function loadCatalog() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const rawFile = fs.readFileSync(DATA_PATH, 'utf8');
      const raw = JSON.parse(rawFile);
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];
      return arr.map((p, i) => normalizeProduct(p, i));
    }
  } catch (e) {
    console.error('Failed to read products.json', e);
  }
  // Fallback seed
  return [
    { id:'p001', name:'Color-Safe Shampoo', price:1800, category:'Hair' },
    { id:'p002', name:'Bond Repair Mask',   price:2400, category:'Hair' },
    { id:'p003', name:'Thermal Protectant', price:2200, category:'Hair' },
    { id:'p004', name:'Vitamin C Serum',    price:2900, category:'Skin' },
  ].map((p,i)=>normalizeProduct(p,i));
}

let CATALOG = loadCatalog();

// Hot reload catalog on change (optional)
try {
  fs.watch(path.dirname(DATA_PATH), { persistent:false }, (evt, file) => {
    if (file && file.endsWith('products.json')) {
      try { CATALOG = loadCatalog(); console.log('Catalog reloaded. count=', CATALOG.length); } catch{}
    }
  });
} catch{}

// --- Routes ---
app.get('/healthz', (req,res)=> res.json({ ok:true }));

app.get('/__whoami', (req,res)=>{
  res.json({
    running: 'server.js',
    routes: [
      'GET /favicon.ico',
      'GET /',
      'GET /healthz',
      'POST /api/chat',
      'GET /api/products',
      'POST /api/bookings/create',
      'GET /__whoami',
      'GET /^(?!api\\/).+'
    ]
  });
});

app.get('/api/products', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const items = !q ? CATALOG : CATALOG.filter(p => (
    (p.name||'').toLowerCase().includes(q) ||
    (p.brand||'').toLowerCase().includes(q) ||
    (p.category||'').toLowerCase().includes(q)
  ));
  res.json({ success:true, count: items.length, items });
});

// Minimal advisor with follow-up
app.post('/api/chat', (req, res) => {
  const msg = ((req.body && req.body.message) || '').toString().toLowerCase();
  const ctx = (req.body && req.body.context) || { answers:{} };

  // Simple follow-up flow
  if (msg.includes('acne') && !ctx.answers?.skinType) {
    return res.json({
      success:true,
      provider:'followup',
      response:'I have a quick question to tailor this for you.',
      followUp:{
        key:'skinType',
        question:'Which best describes your skin? (oily / combination / dry / sensitive)',
        options:['Oily','Combination','Dry','Sensitive']
      }
    });
  }
  if (ctx.answers?.skinType) {
    const type = String(ctx.answers.skinType).toLowerCase();
    const picks = CATALOG
      .filter(p => (p.category||'').toLowerCase().includes('skin') || (p.name||'').match(/serum|cleanser|spf|mask/i))
      .slice(0, 6);
    return res.json({
      success:true,
      provider:'fallback',
      response:`Plan for ${type} skin: gentle cleanser, targeted serum, and daily SPF.`,
      products: picks
    });
  }

  // General guidance
  const picks = CATALOG.slice(0, 6);
  res.json({
    success:true,
    provider:'fallback',
    response: 'Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Rationale: maximize shine/hydration.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.',
    products: picks
  });
});

// Booking stub
app.post('/api/bookings/create', (req, res) => {
  const b = req.body || {};
  const bookingId = 'BK' + Math.random().toString(36).slice(2,8).toUpperCase();
  res.json({ success:true, bookingId, received: b });
});

// Static files
const PUB = path.join(process.cwd(), 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// Favicon (SVG in /public preferred)
app.get('/favicon.ico', (req,res)=> res.status(204).end());

// SPA-ish fallback for non-API routes
app.get(/^\/(?!api\/).+/, (req, res) => {
  const idx = path.join(PUB, 'index.html');
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.type('text/plain').send('Luminous running.');
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind publicly (Render)
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT}`);
});
