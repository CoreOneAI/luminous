// Luminous all-in-one server (UI + API) — r1
// Binds to 0.0.0.0 and serves /data so chat fallbacks work on Render.

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '1mb' }));

// --- Security headers (relaxed enough for our inline CSS/JS and images) ---
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// --- Static assets ---
const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// Serve /data/* from ./data (so /data/products.json is reachable)
const DATA_DIR = path.join(__dirname, 'data');
if (fs.existsSync(DATA_DIR)) {
  app.use('/data', express.static(DATA_DIR));
}

// --- Helpers: load catalog from disk (various locations) ---
function loadCatalogFromDisk() {
  const candidates = [
    path.join(PUB, 'data', 'products.json'),
    path.join(PUB, 'products.json'),
    path.join(DATA_DIR, 'products.json'),
    path.join(__dirname, 'products.json'),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf-8');
      const j = JSON.parse(raw);
      let arr = Array.isArray(j) ? j : (Array.isArray(j.items) ? j.items : []);
      if (!Array.isArray(arr)) arr = [];
      return { path: p, items: arr };
    } catch (e) {
      console.warn('[catalog] failed to parse', p, e.message);
    }
  }
  return { path: null, items: [] };
}

function normalizeProduct(p) {
  const obj = {
    id: String(p.id ?? p.sku ?? p._id ?? p.code ?? Math.random().toString(36).slice(2)),
    name: p.name ?? p.title ?? 'Unnamed',
    brand: p.brand ?? p.maker ?? p.vendor ?? '',
    category: p.category ?? p.type ?? p.family ?? '',
    price: p.price_cents ?? p.priceCents ?? p.price_usd ?? p.priceUsd ?? p.priceUSD ?? p.price ?? 0,
    image: p.image ?? p.image_url ?? p.photo ?? p.img ?? ''
  };
  return obj;
}

// --- API: products ---
app.get('/api/products', (req, res) => {
  const limit = Math.max(1, Math.min( Number(req.query.limit || 200), 5000 ));
  const { path: usedPath, items } = loadCatalogFromDisk();
  const normalized = items.map(normalizeProduct);
  return res.json({
    success: true,
    source: usedPath ? ('disk:' + path.relative(__dirname, usedPath)) : 'none',
    count: normalized.length,
    items: normalized.slice(0, limit),
  });
});

// --- API: chat (simple deterministic fallback + light follow-up) ---
app.post('/api/chat', (req, res) => {
  const msg = String((req.body && req.body.message) || '').toLowerCase();
  // quick follow-up example
  if (/(acne|breakout)/.test(msg)) {
    return res.json({
      success: true,
      provider: 'followup',
      response: 'I have a quick question to tailor this for you.',
      followUp: {
        key: 'skinType',
        question: 'Which best describes your skin? (oily / combination / dry / sensitive)'
      }
    });
  }
  return res.json({
    success: true,
    provider: 'fallback',
    response: [
      "Quick guidance:",
      "• Book: Blowout or Hydration Facial.",
      "• Rationale: maximize shine/hydration.",
      "• Retail: color-safe shampoo, bond mask, thermal protectant.",
      "• Tip: finish with heat guard."
    ].join("\n")
  });
});

// --- API: bookings ---
app.post('/api/bookings/create', (req, res) => {
  const body = req.body || {};
  const id = 'bk_' + Math.random().toString(36).slice(2, 8);
  res.json({ success: true, bookingId: id, echo: body });
});

// --- Diagnostics ---
app.get('/__whoami', (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).map(x=>x.toUpperCase()).join(',');
      routes.push(`${methods} ${m.route.path}`);
    } else if (m.name === 'router' && m.handle && m.handle.stack) {
      m.handle.stack.forEach((h)=>{
        if (h.route && h.route.path) {
          const methods = Object.keys(h.route.methods).map(x=>x.toUpperCase()).join(',');
          routes.push(`${methods} ${h.route.path}`);
        }
      });
    }
  });
  res.json({ running: 'server.js', routes });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- SPA-ish fallback (serve index for unknown non-API routes) ---
app.get(/^\/(?!api\/).+/, (req, res) => {
  res.sendFile(path.join(PUB, 'index.html'));
});

// --- Start ---
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.BIND_HOST || '0.0.0.0'; // IMPORTANT for Render
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT}`);
});
