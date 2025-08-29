// Luminous Salon API (no UI changes) — robust catalog loading + search
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

app.use((req,res,next)=>{
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; " +
    "base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests"
  );
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Access-Control-Allow-Origin','*');
  next();
});

const STATIC_DIR = path.resolve(process.cwd(), 'public');
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { extensions: ['html'] }));
}

let CATALOG = [];
let INDEX = [];
let SOURCE = 'none';

function normalizePriceCents(prod) {
  const candidates = [prod.price_cents, prod.priceCents, prod.price, prod.msrp];
  let v = candidates.find(x => x !== undefined && x !== null && x !== '');
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? (v >= 100 ? v : Math.round(v*100)) : 0;
  if (typeof v === 'string') {
    const dollars = parseFloat(v.replace(/[^0-9.,-]/g,'').replace(/,/g,''));
    if (!isNaN(dollars)) return Math.round(dollars * 100);
  }
  return 0;
}

function buildSearchIndexItem(p) {
  const fields = [
    p.name, p.brand, p.category, p.description, p.usage,
    ...(p.tags || []), ...(p.benefits || []),
    ...((p.traits && p.traits.hairType) || []),
    ...((p.traits && p.traits.concerns) || []),
    ...((p.traits && p.traits.ingredients) || [])
  ].filter(Boolean).join(' ').toLowerCase();
  return { ref: p, hay: fields };
}

const ALIASES = {
  'anti-aging': ['anti aging','antiaging','fine lines','wrinkles','retinol','peptide','peptides','vitamin c','ascorbic','hyaluronic','ha','antioxidant','niacinamide','aha','bha','glycolic','lactic'],
  'hydration': ['hydrating','hyaluronic','moisturizing','ceramide','glycerin'],
  'brighten':  ['brightening','vitamin c','niacinamide','pigment','dark spots','spots','tone'],
  'frizz':     ['anti-frizz','smoothing','smooth'],
  'purple shampoo': ['toning','brass','violet','blonde','silver'],
  'bond':      ['olaplex','bonding','bond repair','plex']
};

function expandQuery(q) {
  const base = (q || '').toLowerCase().trim();
  if (!base) return [];
  const needles = new Set([base]);
  for (const [key, vals] of Object.entries(ALIASES)) {
    if (base.includes(key)) vals.forEach(v => needles.add(v));
  }
  base.split(/\s+/).forEach(t => t && needles.add(t));
  return Array.from(needles);
}

function scoreProduct(hay, needles) {
  let score = 0;
  for (const n of needles) if (n && hay.includes(n)) score++;
  return score;
}

function searchCatalog(q) {
  const needles = expandQuery(q);
  if (!needles.length) return CATALOG.slice();
  const scored = [];
  for (const item of INDEX) {
    const s = scoreProduct(item.hay, needles);
    if (s > 0) scored.push({ s, p: item.ref });
  }
  scored.sort((a,b)=>
    (b.s - a.s) ||
    ((b.p.inStock === true) - (a.p.inStock === true)) ||
    String(a.p.brand||'').localeCompare(String(b.p.brand||'')) ||
    String(a.p.name||'').localeCompare(String(b.p.name||''))
  );
  return scored.map(x=>x.p);
}

function toClient(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand || '—',
    category: p.category || '—',
    price: normalizePriceCents(p),
    image: p.image || '/images/placeholder.svg',
    description: p.description,
    benefits: p.benefits,
    usage: p.usage,
    inStock: p.inStock !== false
  };
}

function setCatalog(products, sourceLabel) {
  CATALOG = Array.isArray(products) ? products : [];
  INDEX = CATALOG.map(buildSearchIndexItem);
  SOURCE = sourceLabel;
}

function loadCatalog() {
  const cand = [];
  const envPath = process.env.CATALOG_PATH;
  if (envPath) cand.push(envPath);
  cand.push('salon_inventory.json');
  cand.push(path.join('data','salon_inventory.json'));
  cand.push(path.join('data','products.json'));
  cand.push(path.join('public','data','products.json'));

  let loaded = false;
  for (const rel of cand) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) {
      try {
        const raw = fs.readFileSync(abs, 'utf8');
        const json = JSON.parse(raw);
        const arr = Array.isArray(json) ? json : (json.items || json.products || []);
        if (Array.isArray(arr)) {
          setCatalog(arr, `disk:${abs}`);
          console.log(`[catalog] loaded ${arr.length} from ${abs}`);
          loaded = true; break;
        }
      } catch (e) {
        console.error(`[catalog] failed to parse ${abs}:`, e.message);
      }
    }
  }
  if (!loaded) {
    setCatalog([], 'none');
    console.warn('[catalog] no catalog found; API will return empty results');
  }
}
loadCatalog();

app.get('/__whoami', (req,res)=>{
  res.json({
    running: 'server.js',
    source: SOURCE,
    products: { count: CATALOG.length },
    env: { PORT: process.env.PORT || null, CATALOG_PATH: process.env.CATALOG_PATH || null }
  });
});

app.post('/__reload_catalog', (req,res)=>{
  loadCatalog();
  res.json({ ok:true, source: SOURCE, count: CATALOG.length });
});

app.get('/api/products', (req,res)=>{
  const q = req.query.q || '';
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit||'24',10)));
  const offset = Math.max(0, parseInt(req.query.offset||'0',10));
  const base = q ? searchCatalog(q) : CATALOG.slice();
  const slice = base.slice(offset, offset+limit).map(toClient);
  res.json({
    success: true,
    source: SOURCE,
    total: base.length,
    count: slice.length,
    items: slice
  });
});

app.post('/api/chat', (req,res)=>{
  const message = (req.body && req.body.message || '').toString().trim();
  const items = searchCatalog(message).slice(0, 12).map(toClient);
  let provider = 'catalog';
  let response = 'Here are options that fit.';
  let followUp = null;

  if (!message) {
    response = 'Hi! Ask about routines, ingredients, or products. I’ll answer and show matching items below.';
  }

  if (items.length === 0) {
    provider = 'followup';
    response = 'I have a quick question to tailor this for you.';
    if (/hair|frizz|curl|blonde|brass|purple/i.test(message)) {
      followUp = { key:'hairType', question:'Which best describes your hair? (straight / wavy / curly / coily)' };
    } else if (/skin|aging|wrinkle|hydration|acne/i.test(message)) {
      followUp = { key:'skinType', question:'Which best describes your skin? (oily / combination / dry / sensitive)' };
    } else {
      followUp = { key:'concern', question:'What’s the main goal? (hydration / frizz / volume / repair / tone)' };
    }
  }

  res.json({ success:true, provider, response, items, followUp });
});

app.post('/api/bookings/create', (req,res)=>{
  const b = req.body || {};
  const id = 'bk_' + Math.random().toString(36).slice(2,10);
  res.json({ success:true, bookingId:id, echo:b });
});

app.get('/healthz', (req,res)=>res.json({ ok:true }));

app.get('/', (req,res)=>{
  if (fs.existsSync(path.join(STATIC_DIR, 'index.html'))) {
    res.sendFile(path.join(STATIC_DIR,'index.html'));
  } else {
    res.type('text/plain').send('Luminous API');
  }
});

const PORT = parseInt(process.env.PORT || '10000', 10);
app.listen(PORT, '0.0.0.0', ()=>{
  console.log(`Luminous listening on ${PORT}. source=${SOURCE}`);
});
