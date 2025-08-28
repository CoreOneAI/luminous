/**
 * Luminous — Products API fix (no index changes)
 * Focus: make /api/products return the right items (many), correct prices, robust search, and pagination.
 * Drop this file at project root as server.js. Requires: express, cors
 *
 * Endpoints:
 *   GET  /api/products?q=&offset=&limit=
 *   POST /api/chat            (simple fallback so chat page doesn't break)
 *   POST /api/bookings/create (stub)
 *   GET  /healthz
 *   GET  /__whoami
 *   Static /public + catch-all
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// CSP that allows your current inline CSS/JS and local images
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

var PUBLIC_DIR = path.join(process.cwd(), 'public');
var PRODUCTS_PATH = path.join(PUBLIC_DIR, 'data', 'products.json');

// ---------- Load & normalize catalog once ----------
var CATALOG = [];
var CATALOG_SOURCE = '';
try {
  var raw = fs.readFileSync(PRODUCTS_PATH, 'utf-8');
  var parsed = JSON.parse(raw);
  if (parsed && parsed.items && Array.isArray(parsed.items)) {
    CATALOG = parsed.items;
  } else if (Array.isArray(parsed)) {
    CATALOG = parsed;
  } else {
    CATALOG = [];
  }
  CATALOG_SOURCE = 'disk:' + PRODUCTS_PATH;
} catch (e) {
  console.error('Failed to read products.json:', e.message);
  CATALOG = [];
  CATALOG_SOURCE = 'error:missing products.json';
}

function normalizeItem(it, idx) {
  var id = (it && it.id != null) ? String(it.id) : ('sku-' + String(idx+1).padStart(4,'0'));
  var name = it && it.name ? String(it.name) : 'Product';
  var brand = it && it.brand ? String(it.brand) : '';
  var category = it && it.category ? String(it.category) : '';
  // price normalization: prefer integer cents; coerce plain "24.99" -> 2499
  var price = it ? it.price : 0;
  if (typeof price === 'string') {
    var m = price.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (m) {
      var dollars = parseInt(m[1], 10);
      var cents = m[2] ? parseInt(m[2], 10) : 0;
      if (m[2] && m[2].length === 1) cents = cents * 10;
      price = dollars * 100 + cents;
    } else {
      price = 0;
    }
  }
  if (typeof price !== 'number' || isNaN(price)) price = 0;
  var image = it && it.image ? String(it.image) : '';
  var hay = (name + ' ' + brand + ' ' + category).toLowerCase();
  var tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
  return { id: id, name: name, brand: brand, category: category, price: price, image: image, hay: hay, tokens: tokens };
}
var ITEMS = CATALOG.map(normalizeItem);

// ---------- Search helpers ----------
function tokenizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/["']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
var SYN = {
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
  var out = {};
  for (var i=0;i<terms.length;i++) {
    var t = terms[i];
    out[t] = true;
    if (SYN[t]) {
      for (var j=0;j<SYN[t].length;j++) out[SYN[t][j]] = true;
    }
  }
  return Object.keys(out);
}
function scoreItem(item, terms, rawQ) {
  var s = 0;
  for (var i=0;i<terms.length;i++) {
    var t = terms[i];
    if (item.hay.indexOf(t) !== -1) s += 3;
    if (item.category && item.category.toLowerCase().indexOf(t) !== -1) s += 2;
  }
  if (rawQ && item.name && item.name.toLowerCase().indexOf(rawQ.toLowerCase()) !== -1) s += 5;
  return s;
}

// ---------- API: /api/products ----------
app.get('/api/products', function(req, res) {
  var q = (req.query.q || '').toString().trim();
  var limit = parseInt(req.query.limit || '50', 10);
  var offset = parseInt(req.query.offset || '0', 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;
  if (isNaN(offset) || offset < 0) offset = 0;

  var results = ITEMS;

  if (q) {
    var terms = expandTerms(tokenizeQuery(q));
    var scored = [];
    for (var i=0;i<ITEMS.length;i++) {
      var it = ITEMS[i];
      var s = scoreItem(it, terms, q);
      if (s > 0) scored.push({ it: it, s: s });
    }
    scored.sort(function(a,b){ return b.s - a.s; });
    results = [];
    for (var k=0;k<scored.length;k++) results.push(scored[k].it);

    // Gentle fallback: if no results and query has a common keyword, try that single word
    if (results.length === 0) {
      var m = q.match(/\b(shampoo|conditioner|serum|spray|mask)\b/i);
      if (m) {
        var t = m[1].toLowerCase();
        var tmp = [];
        for (var z=0; z<ITEMS.length; z++) if (ITEMS[z].hay.indexOf(t) !== -1) tmp.push(ITEMS[z]);
        results = tmp;
      }
    }
  }

  var total = results.length;
  var slice = results.slice(offset, offset + limit);
  var clean = [];
  for (var c=0;c<slice.length;c++) {
    var item = {
      id: slice[c].id,
      name: slice[c].name,
      brand: slice[c].brand,
      category: slice[c].category,
      price: slice[c].price,
      image: slice[c].image
    };
    clean.push(item);
  }

  res.json({
    success: true,
    source: CATALOG_SOURCE,
    total: total,
    offset: offset,
    limit: limit,
    items: clean
  });
});

// ---------- Minimal chat + bookings (unchanged) ----------
app.post('/api/chat', function(req, res) {
  var message = (req.body && req.body.message || '').toString();
  var lower = message.toLowerCase();
  var followUp = null;
  if (/(acne|breakout|oily|dry|mask|serum|shampoo|color|frizz|purple|red)/.test(lower)) {
    followUp = { key: 'need', question: 'Are you shopping hair or skin today?', options: ['Hair','Skin'] };
  }
  res.json({
    success: true,
    provider: 'fallback',
    response: "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Rationale: maximize shine/hydration.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard.",
    followUp: followUp
  });
});

app.post('/api/bookings/create', function(req, res) {
  var bookingId = 'bk_' + Math.random().toString(36).slice(2,8);
  res.json({ success: true, bookingId: bookingId, received: req.body || {} });
});

app.get('/healthz', function(req, res){ res.json({ ok: true }); });
app.get('/__whoami', function(req, res){
  res.json({
    running: 'server.js',
    routes: [
      'GET /api/products',
      'POST /api/chat',
      'POST /api/bookings/create',
      'GET /__whoami',
      'GET /healthz',
      'GET /* (static/public catch-all)'
    ]
  });
});

// ---------- Static + catch-all ----------
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('*', function(req, res, next) {
  if (req.path.indexOf('/api/') === 0) return next();
  var indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(200).send('<!DOCTYPE html><title>Luminous</title><p>Welcome</p>');
});

var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, '0.0.0.0', function(){
  console.log('Luminous listening on ' + PORT + '.');
});
