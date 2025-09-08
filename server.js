'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const __ROOT = __dirname;
const __PUBLIC = path.join(__ROOT, 'public');

app.disable('x-powered-by');

// Serve static assets
app.use(express.static(__PUBLIC, { extensions: ['html'] }));

// Find products.json either in /public or repo root
const pubProducts = path.join(__PUBLIC, 'products.json');
const rootProducts = path.join(__ROOT, 'products.json');

function productsFile() {
  if (fs.existsSync(pubProducts)) return pubProducts;
  if (fs.existsSync(rootProducts)) return rootProducts;
  return null;
}

// Health
app.get('/health', (_req, res) => {
  const file = productsFile();
  let count = 0;
  try {
    if (file) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) count = data.length;
    }
  } catch (_) {}
  res.json({
    ok: true,
    node: process.version,
    productsFile: file ? path.relative(__ROOT, file) : null,
    count
  });
});

// Products JSON (both routes work)
app.get(['/products.json', '/api/products'], (req, res) => {
  const file = productsFile();
  if (!file) return res.status(404).json({ error: 'products.json not found' });
  res.sendFile(file);
});

// Front page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__PUBLIC, 'index.html'));
});

// 404 (for anything else under this simple app)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Luminous listening on ${PORT}`);
});
