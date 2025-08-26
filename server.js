// server.js — Luminous all-in-one (UI + API + diagnostics)
// Node 18+ (global fetch). Start: `node server.js`
// Render: Build `npm install`, Start `node server.js`

const express = require('express');
const cors = require('cors');
const path = require('path');

// ---------- Config ----------
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0'; // IMPORTANT for Render
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''; // optional

// ---------- App ----------
const app = express();

// Minimal CSP: allow our inline for now; OK to tighten after moving all inline CSS/JS to files
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://images.unsplash.com",
    "connect-src 'self' https://api.openai.com https://api.pexels.com",
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

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------- Static (public/) ----------
const staticDir = path.join(__dirname, 'public');
app.get('/favicon.ico', (_, res) => res.redirect(302, '/favicon.svg'));
app.use(express.static(staticDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));
app.get('/', (_, res) => res.sendFile(path.join(staticDir, 'index.html')));

// ---------- Health & Diagnostics ----------
app.get('/healthz', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/__whoami', (_, res) => {
  const list = (app._router.stack || [])
    .filter(r => r.route && r.route.path)
    .map(r => `${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
  res.json({ running: 'server.js', routes: list });
});

// ---------- In-memory products (fallback) ----------
const FALLBACK_PRODUCTS = [
  { id: 'p001', name: 'Color-Safe Shampoo', category: 'Hair', priceCents: 1800, image: 'https://images.unsplash.com/photo-1582095133179-2988d1a4f5b0?q=80&w=800&auto=format&fit=crop' },
  { id: 'p002', name: 'Bond Repair Mask', category: 'Hair', priceCents: 2400, image: 'https://images.unsplash.com/photo-1582095132990-7e83d90c1071?q=80&w=800&auto=format&fit=crop' },
  { id: 'p003', name: 'Thermal Protectant', category: 'Hair', priceCents: 2000, image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop' },
  { id: 'p004', name: 'Vitamin C Serum', category: 'Skin', priceCents: 2900, image: 'https://images.unsplash.com/photo-1556229010-aa3f7ff66b2c?q=80&w=800&auto=format&fit=crop' }
];

// Optional: load data/products.json if present
let PRODUCTS = FALLBACK_PRODUCTS;
try {
  PRODUCTS = require(path.join(__dirname, 'data', 'products.json'));
  if (!Array.isArray(PRODUCTS) || PRODUCTS.length === 0) PRODUCTS = FALLBACK_PRODUCTS;
} catch { /* keep fallback */ }

// ---------- Products API ----------
app.get('/api/products', (req, res) => {
  const q = (req.query.search || '').toString().trim().toLowerCase();
  const cat = (req.query.category || '').toString().trim().toLowerCase();
  let items = PRODUCTS;
  if (q) items = items.filter(p => (p.name + ' ' + (p.category || '')).toLowerCase().includes(q));
  if (cat) items = items.filter(p => (p.category || '').toLowerCase() === cat);
  res.json({ success: true, count: items.length, items });
});
app.get('/api/products/:id', (req, res) => {
  const item = PRODUCTS.find(p => p.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'not_found' });
  res.json({ success: true, item });
});

// ---------- Image Search (Pexels optional; curated fallback) ----------
const FALLBACK_IMAGES = {
  shampoo: [
    'https://images.unsplash.com/photo-1582095133179-2988d1a4f5b0?q=80&w=800&auto=format&fit=crop'
  ],
  serum: [
    'https://images.unsplash.com/photo-1556229010-aa3f7ff66b2c?q=80&w=800&auto=format&fit=crop'
  ],
  nails: [
    'https://images.unsplash.com/photo-1591843336032-9c9b272306f2?q=80&w=800&auto=format&fit=crop'
  ]
};
app.get('/api/images', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ success: false, error: 'q required' });

  // Preferred: Pexels API (legal + predictable)
  if (PEXELS_API_KEY) {
    try {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=10`, {
        headers: { Authorization: PEXELS_API_KEY }
      });
      if (!r.ok) throw new Error(`pexels ${r.status}`);
      const data = await r.json();
      const images = (data.photos || []).map(p => p.src?.medium || p.src?.original).filter(Boolean);
      return res.json({ success: true, provider: 'pexels', count: images.length, images });
    } catch (err) {
      // fall through to curated fallback
    }
  }

  // Fallback: curated Unsplash image URLs we already use
  const key = q.toLowerCase().includes('shampoo') ? 'shampoo'
    : q.toLowerCase().includes('serum') ? 'serum'
    : q.toLowerCase().includes('nail') ? 'nails'
    : 'serum';
  return res.json({ success: true, provider: 'fallback', count: (FALLBACK_IMAGES[key] || []).length, images: FALLBACK_IMAGES[key] || [] });
});

// ---------- Bookings (stub) ----------
const bookings = new Map();
app.post('/api/bookings/create', (req, res) => {
  const { service, style, price, datetimeISO, notes } = req.body || {};
  if (!service || !datetimeISO) return res.status(400).json({ success: false, error: 'service and datetimeISO required' });
  const bookingId = 'bk_' + Math.random().toString(36).slice(2, 8);
  const amountCents = Math.max(0, Math.round((Number(price) || 0) * 100));
  const record = { bookingId, service, style: style || null, amountCents, currency: 'usd', datetimeISO, notes: notes || '', status: 'unpaid', createdAt: new Date().toISOString() };
  bookings.set(bookingId, record);
  res.json({ success: true, ...record });
});

// ---------- Chat with slot-filling + product payload ----------
const sessions = new Map();
const TONES = ['fair','light','medium','olive','brown','deep','dark'];
const SKIN_TYPES = ['oily','dry','combination','combo','normal','sensitive'];

app.post('/api/chat', async (req, res) => {
  const { message, tone = 'concise', includeProducts = true, sessionId } = req.body || {};
  if (!message) return res.status(400).json({ success:false, error:'message required' });

  const text = message.toLowerCase();
  const isAcne = /acne|breakout|pimple/.test(text);
  const isHair = /hair|frizz|dry|blonde|color/.test(text);

  const sessKey = sessionId || 'default';
  const sess = sessions.get(sessKey) || { intent: null, slots: {} };

  if (isAcne) sess.intent = 'acne';
  if (isHair) sess.intent = 'hair';

  const slots = sess.slots;
  if (isAcne && !slots.skinTone) {
    const toneHit = TONES.find(t => text.includes(t));
    if (toneHit) slots.skinTone = toneHit;
  }
  if (isAcne && !slots.skinType) {
    const st = SKIN_TYPES.find(t => text.includes(t));
    if (st) slots.skinType = (st === 'combo' ? 'combination' : st);
  }
  if (isAcne && slots.sensitive == null) {
    if (text.includes('sensitive')) slots.sensitive = true;
  }
  if (isHair && slots.colorTreated == null) {
    if (/blonde|color|toner|bleach/.test(text)) slots.colorTreated = true;
  }
  if (isHair && !slots.hairNeed) {
    if (/dry|frizz/.test(text)) slots.hairNeed = 'hydrate';
    if (/heat|iron|dryer/.test(text)) slots.hairNeed = slots.hairNeed || 'protect';
  }

  if (sess.intent === 'acne') {
    const missing = [];
    if (!slots.skinTone) missing.push('skin tone (fair / medium / deep)');
    if (!slots.skinType) missing.push('skin type (oily / dry / combination / sensitive)');
    if (missing.length) {
      sessions.set(sessKey, { intent:'acne', slots });
      return res.json({ success:true, provider:'luminous', response: `To tailor an acne routine, I need your ${missing.join(' and ')}. How would you describe it?`, products:[] });
    }
  }
  if (sess.intent === 'hair') {
    const missing = [];
    if (slots.colorTreated == null) missing.push('Is your hair color-treated or blonde?');
    if (!slots.hairNeed) missing.push('Are you targeting hydration or heat protection today?');
    if (missing.length) {
      sessions.set(sessKey, { intent:'hair', slots });
      return res.json({ success:true, provider:'luminous', response: missing.join(' '), products:[] });
    }
  }

  const plan = (() => {
    if (sess.intent === 'acne') {
      const tone = slots.skinTone || 'your tone';
      const st = slots.skinType || 'your skin type';
      return { primary:'Calming Acne Facial', addon:'Blue Light Therapy', retail:['Gentle Gel Cleanser','Niacinamide Serum','SPF 30 Mineral'], blurb:`For ${st} on ${tone}, focus on non‑comedogenic, fragrance‑free steps.` };
    }
    if (sess.intent === 'hair') {
      const need = slots.hairNeed || 'hydration';
      const ct = slots.colorTreated ? 'color-treated' : 'natural';
      return { primary: need==='protect' ? 'Gloss + Heat Shield Blowout' : 'Hydration Mask + Blowout', addon: slots.colorTreated ? 'Bond Builder Add-In' : 'Scalp Treatment', retail: slots.colorTreated ? ['Color-Safe Shampoo','Bond Repair Mask','Thermal Protectant'] : ['Hydrating Shampoo','Deep Mask','Thermal Protectant'], blurb:`For ${ct} hair, we’ll target ${need}.` };
    }
    return { primary:'Hydration Facial', addon:'Brow Shaping', retail:['Vitamin C Serum','Thermal Protectant'], blurb:'Balanced routine to boost glow and protect.' };
  })();

  const responseText =
`• Book: ${plan.primary} (+ ${plan.addon})
• Why: ${plan.blurb}
• Retail: ${plan.retail.join(', ')}
• Tip: sort by “best‑selling in‑salon” and check usage notes.`;

  let outProducts = [];
  if (includeProducts) {
    const want = [];
    if (sess.intent === 'acne') want.push('serum','cleanser','spf','mask','toner');
    if (sess.intent === 'hair') {
      if (slots.hairNeed === 'protect') want.push('protectant','shield','spray');
      else want.push('mask','shampoo','conditioner');
      if (slots.colorTreated) want.push('color','bond');
    }
    if (!want.length) want.push('serum','mask','shampoo');

    const matches = (PRODUCTS || FALLBACK_PRODUCTS).filter(p => {
      const hay = (p.name + ' ' + (p.category||'') + ' ' + (p.tags||[]).join(' ')).toLowerCase();
      return want.some(w => hay.includes(w));
    }).slice(0, 24);

    outProducts = matches.map(p => ({
      name: p.name,
      brand: p.brand || '',
      price: p.priceCents != null ? `$${Math.round(p.priceCents/100)}` : '$25',
      imageUrl: p.image || '',
      country: p.country || '',
      description: p.usage || '',
      category: p.category || ''
    }));
  }

  sessions.set(sessKey, { intent: sess.intent, slots });
  return res.json({ success:true, provider:'luminous', response: responseText, products: outProducts });
});

// ---------- Error Handling ----------
app.use((err, req, res, next) => {
  console.error('ERROR', err);
  res.status(500).json({ success: false, error: 'server_error' });
});

// ---------- Start ----------
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT}`);
});
