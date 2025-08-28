// Luminous r3 server
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '1mb' }));

// CSP tuned for Unsplash + local assets
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://source.unsplash.com; " +
    "connect-src 'self'; " +
    "font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests"
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

function toCents(v){
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string'){
    const m = v.match(/([\d.,]+)/);
    if (m){ const n = Number(m[1].replace(/,/g,'')); if (Number.isFinite(n)) return n < 1000 ? Math.round(n*100) : Math.round(n); }
  }
  return 0;
}
function sanitizeImage(u){
  if(!u) return '/images/wooden-tray.jpg';
  if(/^https?:\/\//i.test(u)){
    if(/unsplash\.com\/photos\//.test(u)){
      const idPart = u.split('/photos/')[1] || '';
      const id = idPart.split(/[\/?#]/)[0] || '';
      if(id) return 'https://images.unsplash.com/photo-' + id + '?auto=format&fit=crop&w=640&q=80';
    }
    if(/images\.unsplash\.com\/photo-/.test(u)) return u;
    return u;
  }
  const m = u.match(/photo-([a-zA-Z0-9_-]+)/) || u.match(/^([a-zA-Z0-9_-]{5,})$/);
  if(m){ const id = m[1] || m[0]; return 'https://images.unsplash.com/photo-' + id + '?auto=format&fit=crop&w=640&q=80'; }
  if(/\.(jpg|jpeg|png|webp|gif)$/i.test(u)){ return u.startsWith('/images/') ? u : '/images/' + u.replace(/^\//,''); }
  return '/images/wooden-tray.jpg';
}
function normalizeOne(x, i){
  const id = x.id || x.sku || x.SKU || ('sku-' + String(i+1).padStart(4,'0'));
  const name = x.name || x.title || 'Unnamed';
  const brand = x.brand || x.maker || 'Salon';
  const category = x.category || x.type || '—';
  const price = toCents(x.price ?? x.price_cents ?? x.priceCents ?? x.cost);
  const image = sanitizeImage(x.image || x.img || x.photo || '');
  return { id, name, brand, category, price, image };
}
function readJsonMaybe(p){
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    const arr = Array.isArray(j) ? j : (j.items || j.products || j.results || j.data || []);
    return { items: arr, ok: true };
  } catch (e) {
    return { items: [], ok: false, error: String(e) };
  }
}
function pickBestDataset(){
  const candidates = [
    path.join(PUB, 'data', 'products.json'),
    path.join(__dirname, 'public', 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(__dirname, 'products.json'),
  ];
  let best = { items: [], source: 'none' };
  for (const p of candidates){
    const r = readJsonMaybe(p);
    if ((r.items||[]).length > (best.items||[]).length){
      best = { items: r.items, source: p.replace(__dirname, '').replace(/^\/|\\/, '') };
    }
  }
  best.items = (best.items||[]).map(normalizeOne);
  return best;
}
function tokens(s){ return String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }
function score(it, toks){
  const name = (it.name||'').toLowerCase();
  const cat = (it.category||'').toLowerCase();
  const brand = (it.brand||'').toLowerCase();
  let s=0;
  for (const t of toks){
    if (name.includes(t)) s+=4;
    if (cat.includes(t)) s+=3;
    if (brand.includes(t)) s+=2;
  }
  if (toks.includes('shampoo') && /shampoo/i.test(it.category+it.name)) s+=2;
  if (toks.includes('serum')   && /serum/i.test(it.category+it.name)) s+=2;
  if (toks.includes('mask')    && /mask/i.test(it.category+it.name)) s+=2;
  if (toks.includes('spray')   && /spray/i.test(it.category+it.name)) s+=2;
  return s;
}
function searchProducts(all, q){
  const toks = tokens(q||'');
  if (!toks.length) return all.slice();
  return all.map(x => ({ x, s: score(x, toks) }))
            .sort((a,b)=> b.s - a.s)
            .map(o=>o.x);
}

// Products API (server-side matching + paging)
app.get('/api/products', (req, res) => {
  const q = (req.query.q || '').toString();
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const best = pickBestDataset();
  const ranked = searchProducts(best.items, q);
  const total = ranked.length;
  const slice = ranked.slice(offset, offset + limit);
  res.json({ success: true, total, offset, limit, source: best.source, items: slice });
});

// Chat API (deterministic rule text + attach top matches)
app.post('/api/chat', (req, res) => {
  const msg = (req.body && req.body.message || '').toString();
  const q = msg.trim().toLowerCase();
  let response = "Quick guidance:\\n• Book: Blowout or Hydration Facial.\\n• Rationale: maximize shine/hydration.\\n• Retail: color-safe shampoo, bond mask, thermal protectant.\\n• Tip: finish with heat guard.";
  let followUp = null;

  if (/acne|breakout|blemish/.test(q)) {
    response = "To tailor a plan, quick check: oily, combo, dry, or sensitive?";
    followUp = { key: 'skinType', options: ['oily','combination','dry','sensitive'] };
  } else if (/purple.*shampoo|toning/.test(q)) {
    response = "Purple toning shampoos neutralize brassiness. Use 1–2x/week, follow with hydration.";
  } else if (/sensitive.*scalp/.test(q)) {
    response = "Look for fragrance-free, soothing actives (panthenol, oat). Avoid heavy perfumes and high alcohol content.";
  }

  const best = pickBestDataset();
  const ranked = searchProducts(best.items, q).slice(0, 10);
  res.json({ success: true, provider: 'server', response, followUp, products: ranked, source: best.source });
});

// Diagnostics
app.get('/__whoami', (req, res) => {
  res.json({ running: 'server.js (r3)', routes: [
    'GET /api/products', 'POST /api/chat', 'GET /__whoami', 'GET /healthz', 'GET /(static)'
  ]});
});
app.get('/healthz', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Luminous r3 listening on ${HOST}:${PORT}`);
});
