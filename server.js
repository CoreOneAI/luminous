// server.js (Render-hardened)
const express = require('express');
const path = require('path');

const app = express();

// --- Basics
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// --- CSP: permissive but safe for your stack
app.use((req, res, next) => {
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
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// --- Static (must exist in repo; case-sensitive in prod)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// --- Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- Whoami for quick inspection in prod
app.get('/__whoami', (req, res) => {
  const routes = [];
  app._router.stack.forEach(mw => {
    if (mw.route && mw.route.path) {
      const methods = Object.keys(mw.route.methods).map(m => m.toUpperCase()).join(',');
      routes.push(`${methods} ${mw.route.path}`);
    } else if (mw.name === 'router' && mw.handle.stack) {
      mw.handle.stack.forEach(h => {
        if (h.route) {
          const methods = Object.keys(h.route.methods).map(m => m.toUpperCase()).join(',');
          routes.push(`${methods} ${h.route.path}`);
        }
      });
    }
  });
  res.json({ running: 'server.js', routes });
});

// --- Data helpers
const fs = require('fs');
function loadJSON(file) {
  try {
    const p = path.join(PUBLIC_DIR, file);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// --- API: products (live first, fallback to static)
app.get('/api/products', (req, res) => {
  const limit = Math.max(0, Math.min(5000, Number(req.query.limit) || 150));
  // source of truth: public/data/products.json
  const j = loadJSON('data/products.json') || loadJSON('products.json') || { items: [] };
  const items = (j.items || j.data || j.results || j.products || (Array.isArray(j) ? j : [])).slice(0, limit);
  res.json({ success: true, source: 'disk:public/data/products.json', count: items.length, items });
});

// --- API: chat (uses follow-up + fallback text; plug real LLM later)
app.post('/api/chat', (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message required' });
  }

  const q = message.toLowerCase();
  // very light intent to keep UX responsive
  const needsFollowUp =
    /(acne|sensitive|irritation|allergy|retinol|aha|bha|peel|toner|serum|hair color|toning|purple|blue)/.test(q);

  if (needsFollowUp && !/skin (type|tone)|oily|dry|combination|sensitive/.test(q)) {
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

  // crisp, safe fallback
  return res.json({
    success: true,
    provider: 'fallback',
    response: [
      'Quick guidance:',
      '• Book: Blowout or Hydration Facial.',
      '• Rationale: maximize shine/hydration.',
      '• Retail: color-safe shampoo, bond mask, thermal protectant.',
      '• Tip: finish with heat guard.'
    ].join('\n')
  });
});

// --- SPA-friendly: serve index.html for non-API routes
app.get(/^\/(?!api\/).+/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Start (Render requires 0.0.0.0 and process.env.PORT)
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT}`);
});
