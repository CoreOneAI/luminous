/**
 * Luminous — Products API fix r2 (focused on product/pricing)
 * Drop in project root as server.js.
 *
 * Changes over r1:
 *  - Multi-path discovery for products.json (public/data | /data | env PRODUCTS_JSON)
 *  - Accepts priceCents/price_cents/price (string or number)
 *  - /__catalog diagnostics to prove path, exists, count
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// CSP suitable for local images and your current inline CSS/JS
app.use(function(req, res, next) {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com; " +
    "connect-src 'self'; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'self'; " +
    "upgrade-insecure-requests"
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

// ---- Find products.json from multiple candidates ----
const CANDIDATES = [];
if (process.env.PRODUCTS_JSON) CANDIDATES.push(path.resolve(process.env.PRODUCTS_JSON));
CANDIDATES.push(path.join(PUBLIC_DIR, 'data', 'products.json'));     // preferred
CANDIDATES.push(path.join(ROOT, 'data', 'products.json'));          // alt

let PRODUCTS_PATH = null;
for (const p of CANDIDATES) {
  try { if (fs.existsSync(p)) { PRODUCTS_PATH = p; break; } } catch(e){}
}

// ---- Load & normalize ----
let RAW_CATALOG = [];
let CATALOG_SOURCE = PRODUCTS_PATH ? ('disk:' + PRODUCTS_PATH) : 'error:no path found';
let FILE_STAT = null;

function toCents(val) {
  if (typeof val === 'number' && Number.isFinite(val)) {
    // Heuristic: treat integers >= 100 as cents; small integers as dollars*100
    if (Number.isInteger(val) && val >= 100) return val;
    return Math.round(val * 100);
  }
  if (typeof val === 'string') {
    const m = val.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (m) {
      const dollars = parseInt(m[1],10);
      let cents = m[2] ? parseInt(m[2],10) : 0;
      if (m[2] && m[2].length === 1) cents *= 10;
      return dollars*100 + cents;
    }
  }
  return 0;
}

try {
  if (!PRODUCTS_PATH) throw new Error('products.json not found in candidates: ' + CANDIDATES.join(', '));
  FILE_STAT = fs.statSync(PRODUCTS_PATH);
  const raw = fs.readFileSync(PRODUCTS_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  RAW_CATALOG = (parsed && Array.isArray(parsed.items)) ? parsed.items :
                (Array.isArray(parsed) ? parsed : []);
} catch (e) {
  console.error('Catalog load error:', e.message);
  RAW_CATALOG = [];
}

function normalizeItem(it, idx) {
  const id = (it && it.id != null) ? String(it.id) : ('sku-' + String(idx+1).padStart(4,'0'));
  const name = it && it.name ? String(it.name) : 'Product';
  const brand = it && it.brand ? String(it.brand) : '';
  const category = it && it.category ? String(it.category) : '';
  // price: support priceCents / price_cents / price
  let price = 0;
  if (it && (it.priceCents != null)) price = toCents(it.priceCents);
  else if (it && (it.price_cents != null)) price = toCents(it.price_cents);
  else if (it && (it.price != null)) price = toCents(it.price);
  const image = it && it.image ? String(it.image) : '';
  const hay = (name + ' ' + brand + ' ' + category).toLowerCase();
  const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
  return { id, name, brand, category, price, image, hay, tokens };
}

const ITEMS = RAW_CATALOG.map(normalizeItem);

// ---- Search helpers ----
function tokenizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/["']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
const SYN = {
  purple: ['purple','violet','silver'],
  red: ['red','copper'],
  toner: ['toner','toning','tone'],
  serum: ['serum','elixir','ampoule'],
  shampoo: ['shampoo','cleanser','wash'],
  conditioner: ['conditioner','cond','condtnr'],
  mask: ['mask','masque'],
  spray: ['spray','mist']
};
function expandTerms(terms) {
  const out = new Set();
  for (const t of terms) {
    out.add(t);
    if (SYN[t]) SYN[t].forEach(x => out.add(x));
  }
  return Array.from(out);
}
function scoreItem(item, terms, rawQ) {
  let s = 0;
  for (const t of terms) {
    if (item.hay.indexOf(t) !== -1) s += 3;
    if (item.category && item.category.toLowerCase().indexOf(t) !== -1) s += 2;
  }
  if (rawQ && item.name && item.name.toLowerCase().indexOf(rawQ.toLowerCase()) !== -1) s += 5;
  return s;
}

// ---- /api/products ----
app.get('/api/products', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  let limit = parseInt(req.query.limit || '50', 10);
  let offset = parseInt(req.query.offset || '0', 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;
  if (isNaN(offset) || offset < 0) offset = 0;

  let results = ITEMS;
  if (q) {
    const terms = expandTerms(tokenizeQuery(q));
    const scored = [];
    for (let i=0;i<ITEMS.length;i++) {
      const it = ITEMS[i];
      const s = scoreItem(it, terms, q);
      if (s > 0) scored.push({ it, s });
    }
    scored.sort((a,b)=> b.s - a.s);
    results = scored.map(r => r.it);
    if (results.length === 0) {
      const m = q.match(/\b(shampoo|conditioner|serum|spray|mask)\b/i);
      if (m) {
        const t = m[1].toLowerCase();
        results = ITEMS.filter(x => x.hay.indexOf(t) !== -1);
      }
    }
  }

  const total = results.length;
  const slice = results.slice(offset, offset + limit).map(({ hay, tokens, ...rest }) => rest);
  res.json({ success:true, source: CATALOG_SOURCE, total, offset, limit, items: slice });
});

// ---- Minimal chat + bookings (unchanged behavior; not the focus) ----
app.post('/api/chat', (req,res) => {
  const message = (req.body && req.body.message || '').toString();
  const lower = message.toLowerCase();
  let followUp = null;
  if (/(acne|breakout|oily|dry|mask|serum|shampoo|color|frizz|purple|red)/.test(lower)) {
    followUp = { key: 'need', question: 'Are you shopping hair or skin today?', options: ['Hair','Skin'] };
  }
  res.json({ success:true, provider:'fallback',
    response: "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Rationale: maximize shine/hydration.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.",
    followUp });
});

app.post('/api/bookings/create', (req,res)=>{
  const bookingId = 'bk_' + Math.random().toString(36).slice(2,8);
  res.json({ success:true, bookingId, received: req.body || {} });
});

// ---- Diagnostics: prove path & count ----
app.get('/__catalog', (req,res)=>{
  let bytes = null;
  try { if (FILE_STAT) bytes = FILE_STAT.size; } catch(e){}
  res.json({
    pathTried: CANDIDATES,
    pathSelected: PRODUCTS_PATH,
    exists: !!PRODUCTS_PATH,
    sizeBytes: bytes,
    items: ITEMS.length,
    sample: ITEMS.slice(0,3).map(x => ({ id:x.id, name:x.name, category:x.category, price:x.price }))
  });
});

// ---- Static + catch-all ----
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('*', (req, res, next) => {
  if (req.path.indexOf('/api/') === 0 || req.path.indexOf('/__') === 0) return next();
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(200).send('<!DOCTYPE html><title>Luminous</title><p>Welcome</p>');
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, '0.0.0.0', ()=> console.log('Luminous listening on ' + PORT + '.'));
