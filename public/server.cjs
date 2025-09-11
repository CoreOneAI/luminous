// server.cjs  — CommonJS, minimal & stable
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// ---- config/env ----
const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ---- middleware ----
app.use(cors()); // keep simple/allow all for now
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- static ----
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// ---- load products once (for /api/products) ----
let PRODUCTS = [];
try {
  const p = path.join(PUBLIC_DIR, 'products.json');
  if (fs.existsSync(p)) {
    PRODUCTS = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`[PRODUCTS] Loaded ${PRODUCTS.length} products`);
  } else {
    console.log('[PRODUCTS] public/products.json not found (ok if you only use static)');
  }
} catch (e) {
  console.error('[PRODUCTS] Failed to load:', e.message);
  PRODUCTS = [];
}

// ---- health ----
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAI: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL,
  });
});

// ---- optional: simple product search/paginate ----
// front-end can call /api/products?q=retinol&offset=0&limit=12
app.get('/api/products', (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const limit = Math.max(Math.min(parseInt(req.query.limit || '12', 10), 50), 1);

    let filtered = PRODUCTS;
    if (q) {
      filtered = PRODUCTS.filter(p => {
        const hay = [
          p.name, p.brand, p.category, p.description, p.usage, p.ingredients, p.suitableFor, (p.tags || []).join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    res.json({ success: true, total, items });
  } catch (err) {
    console.error('api/products error:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

// ---- chat (/ask) ----
app.post('/ask', async (req, res) => {
  const message = (req.body && req.body.message) ? String(req.body.message) : '';
  if (!message) {
    return res.status(400).json({ provider: 'openai', model: OPENAI_MODEL, reply: 'Please include a message.' });
  }

  // If no key present, keep the server usable with a friendly fallback
  if (!OPENAI_API_KEY) {
    res.set('X-Provider', 'baseline');
    res.set('X-Model', 'none');
    return res.json({
      provider: 'baseline',
      model: 'none',
      reply: 'Hi! The AI key is not configured on this server yet. Please try again later.',
    });
  }

  try {
    // Use native fetch in Node 18+
    const sys = `You are a friendly, professional salon stylist assistant.
- Be concise, warm, and practical.
- If the user mentions a skin concern, undertone, or event, tailor advice.
- Avoid medical claims; stay within beauty care guidance.`;

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: message }
      ],
      temperature: 0.7
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const body = await r.text().catch(()=>'');
      console.error('OpenAI error:', r.status, body);
      res.set('X-Provider', 'openai');
      res.set('X-Model', OPENAI_MODEL);
      return res.status(502).json({
        provider: 'openai',
        model: OPENAI_MODEL,
        reply: 'Sorry—our stylist assistant is having trouble responding right now.'
      });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not find that.';
    res.set('X-Provider', 'openai');
    res.set('X-Model', OPENAI_MODEL);
    return res.json({ provider: 'openai', model: OPENAI_MODEL, reply });
  } catch (err) {
    console.error('ask error:', err);
    res.set('X-Provider', 'openai');
    res.set('X-Model', OPENAI_MODEL);
    return res.status(500).json({
      provider: 'openai',
      model: OPENAI_MODEL,
      reply: 'An error occurred while processing your request. Please try again.'
    });
  }
});

// ---- fallback to index.html (SPA-ish) ----
app.get('*', (req, res) => {
  try {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  } catch {
    res.status(404).send('Not found');
  }
});

// ---- start ----
app.listen(PORT, () => {
  console.log(`Luminous listening on ${PORT} { hasOpenAI: ${Boolean(OPENAI_API_KEY)} }`);
});
