// server.js — Render-safe, no-regex catch-all
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// --- CSP & security headers (compatible with current UI)
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

// --- Static roots (case-sensitive in Linux)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Expose data & images from both /public and repo root if present
app.use('/data', express.static(path.join(PUBLIC_DIR, 'data')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/images', express.static(path.join(PUBLIC_DIR, 'images')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// --- Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- Diagnostics: list candidate data paths and directory contents
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
    try { listing.push({ dir, ok: true, files: fs.readdirSync(dir).slice(0, 200) }); }
    catch (e) { listing.push({ dir, ok: false, error: String(e) }); }
  }
  res.json({ cwd: process.cwd(), PUBLIC_DIR, candidates: exists, listing });
});

// --- Helpers
function findProductsFile() {
  const candidates = [
    path.join(PUBLIC_DIR, 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(PUBLIC_DIR, 'products.json'),
    path.join(__dirname, 'products.json')
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return null;
}
function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

// --- API: products
app.get('/api/products', (req, res) => {
  const limit = Math.max(0, Math.min(5000, Number(req.query.limit) || 150));
  const file = findProductsFile();
  let items = [], source = 'none';
  if (file) {
    const j = loadJSON(file) || {};
    const arr = j.items || j.data || j.results || j.products || (Array.isArray(j) ? j : []);
    items = Array.isArray(arr) ? arr.slice(0, limit) : [];
    source = file;
  }
  res.json({ success: true, source, count: items.length, items });
});

// --- API: chat (stub with follow-up)
app.post('/api/chat', (req, res) => {
  const msg = (req.body && req.body.message || '').toLowerCase();
  if (!msg) return res.status(400).json({ success:false, error:'message required' });
  const needs = /(acne|sensitive|irritation|retinol|aha|bha|toning|purple|blue|hair color)/.test(msg);
  if (needs && !/(oily|dry|combination|sensitive)/.test(msg)) {
    return res.json({ success:true, provider:'followup',
      response:'I have a quick question to tailor this for you.',
      followUp:{ key:'skinType', question:'Which best describes your skin? (oily / combination / dry / sensitive)'} });
  }
  return res.json({ success:true, provider:'fallback', response:'Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.' });
});

// --- Catch-all (no regex): send index.html for non-API/diagnostic routes
app.get('*', (req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/') || p === '/api' || p.startsWith('/__') || p === '/healthz') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Start (Render needs 0.0.0.0 + process.env.PORT)
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${HOST}:${PORT}; public=${PUBLIC_DIR}`);
});
