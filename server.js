// server.js — data-path hardened for Render
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// ---- Security headers (permissive but safe for current stack)
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

// ---- Static dirs (case-sensitive in Linux)
const STATIC_DIR = process.env.STATIC_DIR || 'public';
const PUBLIC_DIR = path.join(__dirname, STATIC_DIR);

// Serve /public (index/chat/catalog, images, etc.)
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Also map explicit subpaths in case your assets are at different roots
// (e.g., repo has /data or /images outside /public).
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// ---- Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---- Debug: inspect which files exist in container
app.get('/__files', (req, res) => {
  const candidates = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json')
  ];
  const exists = candidates.map(p => ({ path: p, exists: fs.existsSync(p) }));
  const listing = [];
  for (const dir of [PUBLIC_DIR, path.join(PUBLIC_DIR,'data'), path.join(__dirname,'data')]) {
    try {
      const files = fs.readdirSync(dir).slice(0, 200);
      listing.push({ dir, ok: true, files });
    } catch (e) {
      listing.push({ dir, ok: false, error: String(e) });
    }
  }
  res.json({
    cwd: process.cwd(),
    STATIC_DIR, PUBLIC_DIR,
    candidates: exists,
    listing
  });
});

// ---- Helper to find JSON in multiple common locations
function findFirstExisting() {
  const candidates = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadJSONSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ---- API: products (live from disk; 0-copy transform)
app.get('/api/products', (req, res) => {
  const limit = Math.max(0, Math.min(5000, Number(req.query.limit) || 150));
  const file = findFirstExisting();
  let items = [];
  let source = 'none';

  if (file) {
    const j = loadJSONSafe(file) || {};
    const arr = j.items || j.data || j.results || j.products || (Array.isArray(j) ? j : []);
    items = Array.isArray(arr) ? arr.slice(0, limit) : [];
    source = file;
  }

  res.json({ success: true, source, count: items.length, items });
});

// ---- API: chat (simple follow-up + fallback; plug real LLM later)
app.post('/api/chat', (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message required' });
  }
  const q = message.toLowerCase();
  const needsFollowUp =
    /(acne|sensitive|irritation|allergy|retinol|aha|bha|peel|toner|serum|hair color|toning|purple|blue)/.test(q);

  if (needsFollowUp && !/skin (type|tone)|oily|dry|combination|sensitive/.test(q)) {
    return res.json({
      success: true,
      provider: 'followup',
      response: 'I have a quick question to tailor this for you.',
      followUp: { key: 'skinType', question: 'Which best describes your skin? (oily / combination / dry / sensitive)' }
    });
  }

  return res.json({
    success: true,
    provider: 'fallback',
    response: [
      'Quick guidance:',
      '• Book: Blowout or Hydration Facial.',
      '• Rationale: maximize shine/hydration.',
      '• Retail: color-safe shampoo, bond mask, thermal protectant.',
      '• Tip: finish with heat guard.'
    ].join('\\n')
  });
});

// ---- SPA-friendly: serve index.html for non-API routes
app.get(/^\\/(?!api\\/).+/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---- Start (Render needs 0.0.0.0 & process.env.PORT)
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT} (static dir: ${PUBLIC_DIR})`);
});
