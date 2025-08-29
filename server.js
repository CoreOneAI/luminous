// Luminous — clean server.js (Render-friendly)
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// -------- Security headers (relaxed CSP while stabilizing) --------
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  next();
});

app.use(express.json({ limit: '1mb' }));

// -------- Static files --------
const PUB = path.resolve(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// -------- Catalog loader --------
let CATALOG = [];
let SOURCE = 'none';

function safeReadJSON(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function loadCatalog() {
  const ENV = process.env.CATALOG_PATH;
  const candidates = [
    ENV && path.resolve(__dirname, ENV),
    path.join(PUB, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json')
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const j = safeReadJSON(p);
      if (Array.isArray(j)) { CATALOG = j; SOURCE = p; return; }
      if (j && Array.isArray(j.items)) { CATALOG = j.items; SOURCE = p; return; }
    }
  }

  // Fallback sample (keeps UI alive; replace once file is present)
  CATALOG = [
    { id:'p001', name:'Color-Safe Shampoo', brand:'Salon', category:'Hair / Shampoo', price:1800, image:'/images/studio-beige.jpg' },
    { id:'p002', name:'Bond Repair Mask',   brand:'Salon', category:'Hair / Mask',     price:2400, image:'/images/zen-stone-serum.jpg' },
    { id:'p003', name:'Thermal Protectant', brand:'Salon', category:'Hair / Spray',    price:2000, image:'/images/wooden-tray.jpg' },
    { id:'p004', name:'Vitamin C Serum',    brand:'Salon', category:'Skin / Serum',    price:2900, image:'/images/hero-almonds.jpg' }
  ];
  SOURCE = 'memory:fallback';
}

function listDirSafe(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

// Init
loadCatalog();

// -------- Diagnostics --------
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/__whoami', (req, res) => {
  res.json({
    running: path.basename(__filename),
    node: process.version,
    products: { source: SOURCE, count: Array.isArray(CATALOG) ? CATALOG.length : 0 },
    public_data_ls: listDirSafe(path.join(PUB, 'data')),
    routes: [
      'GET /api/products',
      'POST /api/chat',
      'POST /api/bookings/create',
      'POST /__reload_catalog',
      'GET /__ls',
      'GET /healthz',
      'GET /__whoami',
      '(static)'
    ]
  });
});

app.get('/__ls', (req, res) => {
  const dir = String(req.query.dir || 'public/data');
  const abs = path.join(__dirname, dir);
  res.json({ dir: abs, files: listDirSafe(abs) });
});

app.post('/__reload_catalog', (req, res) => {
  loadCatalog();
  res.json({ reloaded: true, source: SOURCE, count: Array.isArray(CATALOG) ? CATALOG.length : 0 });
});

// -------- Search helpers --------
function norm(s) { return (s || '').toString().toLowerCase(); }
function tokenize(q) { return norm(q).split(/\s+/).filter(Boolean); }

function score(p, tokens) {
  const hay = norm([p.name, p.brand, p.category].filter(Boolean).join(' '));
  let s = 0;
  for (const t of tokens) {
    if (hay.includes(t)) s += 2;
  }
  if (hay.includes('shampoo') && tokens.includes('shampoo')) s += 2;
  if (hay.includes('conditioner') && tokens.includes('conditioner')) s += 2;
  if (hay.includes('serum') && tokens.includes('serum')) s += 1;
  if (hay.includes('spray') && tokens.includes('spray')) s += 1;
  return s;
}

function searchCatalog(q) {
  const tokens = tokenize(q);
  if (tokens.length === 0) return CATALOG.slice();
  const matches = [];
  for (const p of CATALOG) {
    const s = score(p, tokens);
    if (s > 0) matches.push({ p, s });
  }
  matches.sort((a, b) => (b.s - a.s) || (norm(a.p.name) < norm(b.p.name) ? -1 : 1));
  return (matches.length ? matches.map(x => x.p) : CATALOG.slice());
}

// -------- APIs --------
app.get('/api/products', (req, res) => {
  const q = String(req.query.q || '');
  let limit = parseInt(req.query.limit, 10); if (!limit || limit < 1) limit = 24; if (limit > 200) limit = 200;
  let offset = parseInt(req.query.offset, 10); if (!offset || offset < 0) offset = 0;

  const itemsSrc = searchCatalog(q);
  const total = itemsSrc.length;
  const items = itemsSrc.slice(offset, offset + limit).map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand || '—',
    category: p.category || '—',
    price: (typeof p.price === 'number' ? p.price : 0),
    image: p.image || '/placeholder.png'
  }));
  res.json({ success: true, source: SOURCE, total, offset, limit, items });
});

app.post('/api/chat', (req, res) => {
  const msg = String((req.body && req.body.message) || '').trim().toLowerCase();
  if (!msg) {
    return res.json({ success: true, provider: 'fallback', response: 'Ask about color-safe care, scalp relief, or routines.' });
  }
  if (msg.includes('acne')) {
    return res.json({
      success: true,
      provider: 'followup',
      response: 'I have a quick question to tailor this for you.',
      followUp: { key: 'skinType', question: 'Which best describes your skin? (oily / combination / dry / sensitive)' }
    });
  }
  return res.json({
    success: true, provider: 'fallback',
    response: "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard."
  });
});

app.post('/api/bookings/create', (req, res) => {
  const b = req.body || {};
  const id = 'bk_' + Math.random().toString(36).slice(2, 10);
  res.json({ success: true, bookingId: id, received: b });
});

// -------- Start --------
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${PORT}. Catalog source: ${SOURCE}`);
  console.log('[catalog] public/data files:', listDirSafe(path.join(PUB, 'data')));
});
