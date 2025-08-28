// Luminous unified server — products-first fix (no UI changes)
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Minimal security headers (kept permissive for this stage) ---
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow Unsplash + local images; no cross-site scripts; inline allowed for simplicity
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
    "upgrade-insecure-requests",
  ].join('; '));
  next();
});

app.use(express.json({ limit: '1mb' }));

// --- Static site ---
const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// --- Health ---
app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- Load catalog once ---
const DATA_PATHS = [
  path.join(PUB, 'data', 'products.json'),
  path.join(__dirname, 'public', 'data', 'products.json'), // alt
  path.join(__dirname, 'data', 'products.json'),            // alt
];
let CATALOG = [];
let CATALOG_SOURCE = 'none';

function loadCatalog() {
  for (const p of DATA_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const j = JSON.parse(raw);
        if (Array.isArray(j)) { CATALOG = j; CATALOG_SOURCE = p; return; }
        if (Array.isArray(j.items)) { CATALOG = j.items; CATALOG_SOURCE = p; return; }
      }
    } catch (e) {
      console.error('Failed to read products.json at', p, e.message);
    }
  }
  console.warn('No products.json found — using tiny fallback');
  CATALOG = [
    { id:'p001', name:'Color-Safe Shampoo', brand:'Salon', category:'Hair / Shampoo', price:1800, image:'/images/studio-beige.jpg' },
    { id:'p002', name:'Bond Repair Mask', brand:'Salon', category:'Hair / Mask', price:2400, image:'/images/zen-stone-serum.jpg' },
    { id:'p003', name:'Thermal Protectant', brand:'Salon', category:'Hair / Spray', price:2000, image:'/images/wooden-tray.jpg' },
    { id:'p004', name:'Vitamin C Serum', brand:'Salon', category:'Skin / Serum', price:2900, image:'/images/hero-almonds.jpg' },
  ];
  CATALOG_SOURCE = 'memory:fallback';
}
loadCatalog();

// --- Helpers for robust searching ---
function norm(s){ return (s||'').toString().toLowerCase(); }
const COLOR_SYNONYM = {
  red:['red','copper','auburn','ginger'],
  purple:['purple','violet','blonde toning','brass'],
  blue:['blue','ash','cool'],
};
function tokenScore(p, tokens) {
  const hay = norm([p.name, p.brand, p.category].filter(Boolean).join(' '));
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    let matched = false;
    for (const [canon, list] of Object.entries(COLOR_SYNONYM)) {
      if (list.some(w => t.includes(w))) {
        if (hay.includes(canon)) { score += 3; matched = true; break; }
      }
    }
    if (matched) continue;
    if (hay.includes(t)) score += 2;
  }
  const T = tokens.join(' ');
  if (/shampoo/.test(T) && /shampoo/.test(hay)) score += 3;
  if (/conditioner/.test(T) && /conditioner/.test(hay)) score += 3;
  if (/serum/.test(T) && /serum/.test(hay)) score += 2;
  if (/sensitive scalp/.test(T) && /sensitive scalp/.test(hay)) score += 4;
  return score;
}
function searchCatalog(q) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return CATALOG.slice();
  const scored = CATALOG.map(p => ({ p, s: tokenScore(p, tokens) }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s || norm(a.p.name).localeCompare(norm(b.p.name)));
  return scored.map(x => x.p);
}

// --- /api/products ---
app.get('/api/products', (req,res) => {
  const q = (req.query.q || '').toString();
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 24));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  let items = searchCatalog(q);
  const total = items.length;
  items = items.slice(offset, offset + limit);

  items = items.map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand || '—',
    category: p.category || '—',
    price: (typeof p.price === 'number' ? p.price : 0),
    image: p.image || '/images/studio-beige.jpg',
  }));

  res.json({ success:true, source: CATALOG_SOURCE, total, offset, limit, items });
});

// --- /api/chat --- (simple, deterministic; does not affect products)
app.post('/api/chat', async (req,res) => {
  const msg = (req.body && req.body.message || '').toString().trim();
  if (!msg) return res.json({ success:true, provider:'fallback', response: 'Ask me about hair color care, scalp concerns, or routines.' });

  let response = "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.";
  const lower = msg.toLowerCase();
  let followUp = null;
  if (lower.includes('acne')) {
    response = "I have a quick question to tailor this for you.";
    followUp = { key: 'skinType', question: "Which best describes your skin? (oily / combination / dry / sensitive)" };
  }
  res.json({ success:true, provider:'fallback', response, followUp });
});

// --- Diagnostics ---
app.get('/__whoami', (req,res) => {
  res.json({
    running: path.basename(__filename),
    products: { source: CATALOG_SOURCE, count: Array.isArray(CATALOG) ? CATALOG.length : 0 },
    routes: [
      'GET /api/products',
      'POST /api/chat',
      'GET /healthz',
      'GET /__whoami',
      'GET /(static)'
    ]
  });
});

// Fallback to static for any non-API paths
app.get(/^(?!\/api\/).+/, (req,res,next) => next());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Luminous listening on ${PORT}. Catalog source: ${CATALOG_SOURCE}`);
});
