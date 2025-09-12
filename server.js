// server.cjs  — CommonJS, simple + stable
const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';

const app = express();

// --- Basic security/CORS (loose for now; tighten later) ---
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

// --- Static ---
const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAI: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL
  });
});

// --- Load products.json into memory (and cheap reload on demand) ---
let CATALOG = [];
const PRODUCTS_PATH = path.join(PUB, 'products.json');

function loadCatalog() {
  try {
    const txt = fs.readFileSync(PRODUCTS_PATH, 'utf8');
    const json = JSON.parse(txt);
    if (Array.isArray(json)) {
      CATALOG = json;
      console.log(`[PRODUCTS] Loaded ${CATALOG.length} items`);
    } else {
      throw new Error('products.json is not an array');
    }
  } catch (e) {
    console.error('[PRODUCTS] Failed to load products.json:', e.message);
    CATALOG = [];
  }
}
loadCatalog();

// Optional small helper to reload on demand
app.post('/admin/reload-products', (req, res) => {
  loadCatalog();
  res.json({ ok: true, count: CATALOG.length });
});

// --- API: products (filterable) ---
app.get('/api/products', (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const category = (req.query.category || '').toString().trim().toLowerCase();
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
  const limit  = Math.max(1, Math.min(50, parseInt(req.query.limit || '16', 10)));

  let rows = CATALOG;

  if (category) {
    rows = rows.filter(p => (p.category || '').toLowerCase() === category);
  }
  if (q) {
    rows = rows.filter(p => {
      const hay = [
        p.name, p.brand, p.category, p.description,
        ...(Array.isArray(p.tags) ? p.tags : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  const total = rows.length;
  const items = rows.slice(offset, offset + limit);

  res.json({ success: true, total, items });
});

// --- Ask AI (OpenAI proxy) ---
app.post('/ask', async (req, res) => {
  try {
    const message = (req.body && req.body.message) ? String(req.body.message) : '';
    if (!message) return res.status(400).json({ error: 'Missing message' });
    if (!OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY missing' });

    // Node 18+ has global fetch
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a friendly, concise beauty stylist assistant. Be clear, calm, and helpful.' },
          { role: 'user', content: message }
        ],
        temperature: 0.6,
        max_tokens: 500
      })
    });

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Sorry, I couldn’t find that.';
    res.setHeader('X-Provider', 'openai');
    res.setHeader('X-Model', OPENAI_MODEL);
    res.json({ provider: 'openai', model: OPENAI_MODEL, reply });
  } catch (err) {
    console.error('ASK error', err);
    res.status(500).json({ error: 'ask_failed' });
  }
});

// --- Fallback to index.html for top-level routes (optional SPA-like) ---
app.get('/', (req, res) => res.sendFile(path.join(PUB, 'index.html')));

// --- Start ---
app.listen(PORT, () => {
  console.log(`Luminous listening on ${PORT} { hasOpenAI: ${Boolean(OPENAI_API_KEY)} }`);
});
