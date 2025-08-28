// Luminous — ONE LAST FIX: product API first, UI untouched except pages below.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Light security headers (allow inline while stabilizing) ---
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
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

// --- Static ---
const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// --- Health ---
app.get('/healthz', (req,res)=>res.json({ok:true}));

// --- Load catalog (supports array or {items:[...]}) ---
const PATHS = [
  path.join(PUB, 'data', 'products.json'),
  path.join(__dirname, 'public', 'data', 'products.json'),
  path.join(__dirname, 'data', 'products.json'),
];
let CATALOG = [];
let SOURCE = 'none';
function loadCatalog() {
  for (const p of PATHS) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const j = JSON.parse(raw);
        if (Array.isArray(j)) { CATALOG = j; SOURCE = p; return; }
        if (Array.isArray(j.items)) { CATALOG = j.items; SOURCE = p; return; }
      }
    } catch (e) { console.error('products.json error at', p, e.message); }
  }
  // tiny safety fallback only if none found
  CATALOG = [
    { id:'p001', name:'Color-Safe Shampoo', brand:'Salon', category:'Hair / Shampoo', price:1800, image:'/images/studio-beige.jpg' },
    { id:'p002', name:'Bond Repair Mask', brand:'Salon', category:'Hair / Mask', price:2400, image:'/images/zen-stone-serum.jpg' },
    { id:'p003', name:'Thermal Protectant', brand:'Salon', category:'Hair / Spray', price:2000, image:'/images/wooden-tray.jpg' },
    { id:'p004', name:'Vitamin C Serum', brand:'Salon', category:'Skin / Serum', price:2900, image:'/images/hero-almonds.jpg' },
  ];
  SOURCE = 'memory:fallback';
}
loadCatalog();

// --- Search helpers ---
const norm = s => (s||'').toString().toLowerCase();
const COLOR = { red:['red','copper','auburn','ginger'], purple:['purple','violet','brass'], blue:['blue','ash','cool'] };

function scoreProduct(p, tokens) {
  const hay = norm([p.name, p.brand, p.category].filter(Boolean).join(' '));
  let s = 0;
  for (const t of tokens) {
    if (!t) continue;
    let matched = false;
    for (const [canon, list] of Object.entries(COLOR)) {
      if (list.some(w => t.includes(w))) { if (hay.includes(canon)) s += 3; matched = true; break; }
    }
    if (matched) continue;
    if (hay.includes(t)) s += 2;
  }
  const T = tokens.join(' ');
  if (/shampoo/.test(T) && /shampoo/.test(hay)) s += 3;
  if (/conditioner/.test(T) && /conditioner/.test(hay)) s += 3;
  if (/serum/.test(T) && /serum/.test(hay)) s += 2;
  if (/spray/.test(T) && /spray/.test(hay)) s += 2;
  if (/sensitive scalp/.test(T) && /sensitive scalp/.test(hay)) s += 4;
  return s;
}

function search(q) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return CATALOG.slice();
  const arr = CATALOG.map(p => ({p, s: scoreProduct(p, tokens)}))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s || norm(a.p.name).localeCompare(norm(b.p.name)))
    .map(x => x.p);
  // If nothing matched, return entire catalog (so UI never shows "0 forever")
  return arr.length ? arr : CATALOG.slice();
}

// --- API: products ---
app.get('/api/products', (req,res)=>{
  const q = (req.query.q||'').toString();
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit,10) || 24));
  const offset = Math.max(0, parseInt(req.query.offset,10) || 0);

  let items = search(q);
  const total = items.length;
  items = items.slice(offset, offset + limit).map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand || '—',
    category: p.category || '—',
    price: (typeof p.price === 'number' ? p.price : 0),
    image: p.image || '/images/studio-beige.jpg',
  }));

  res.json({ success:true, source: SOURCE, total, count: total, offset, limit, items });
});

// --- API: chat (simple, deterministic, does NOT cap products) ---
app.post('/api/chat', (req,res)=>{
  const msg = (req.body?.message||'').toString().trim();
  if (!msg) return res.json({ success:true, provider:'fallback', response:'Ask about color-safe care, scalp relief, or routines.' });
  let response = "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.";
  if (msg.toLowerCase().includes('acne')) {
    response = "I have a quick question to tailor this for you.";
    return res.json({ success:true, provider:'followup', response, followUp:{ key:'skinType', question:'Which best describes your skin? (oily / combination / dry / sensitive)'} });
  }
  res.json({ success:true, provider:'fallback', response });
});

// --- Diagnostics ---
app.get('/__whoami', (req,res)=>{
  res.json({
    running: path.basename(__filename),
    products: { source: SOURCE, count: Array.isArray(CATALOG) ? CATALOG.length : 0 },
    routes: ['GET /api/products','POST /api/chat','GET /healthz','GET /__whoami','(static)']
  });
});

// Non-API falls through to static
app.get(/^(?!\/api\/).+/, (req,res,next)=>next());

app.listen(PORT, '0.0.0.0', ()=>console.log(`Luminous listening on ${PORT}. source=${SOURCE}`));
