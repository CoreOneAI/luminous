// Luminous — PRODUCTS-ONLY SERVER (diagnostics on; no UI changes)
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// -------- Security headers (relaxed while stabilizing) --------
app.use(function(req, res, next){
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  next();
});

app.use(express.json({ limit: '1mb' }));

// -------- Static --------
const PUB = path.resolve(__dirname, 'public');
app.use(express.static(PUB, { extensions: ['html'] }));

// -------- Health --------
app.get('/healthz', function(req,res){ res.json({ ok: true }); });

// -------- Catalog loader + diagnostics --------
var CATALOG = [];
var SOURCE = 'none';

function listDirSafe(dir){
  try { return fs.readdirSync(dir); } catch (e) { return []; }
}

function loadCatalog(){
  var candidates = [
    path.join(PUB, 'data', 'products.json'),
    path.join(__dirname, 'public', 'data', 'products.json'),
    path.join(__dirname, 'data', 'products.json')
  ];
  for (var i=0;i<candidates.length;i++){
    var p = candidates[i];
    try{
      if (fs.existsSync(p)){
        var raw = fs.readFileSync(p, 'utf8');
        var j = JSON.parse(raw);
        if (Array.isArray(j)) { CATALOG = j; SOURCE = p; return; }
        if (j && Array.isArray(j.items)) { CATALOG = j.items; SOURCE = p; return; }
      }
    }catch(e){
      console.error('[catalog] failed to read', p, e.message);
    }
  }
  console.warn('[catalog] products.json NOT FOUND — using 4-item in-memory fallback so UI stays alive');
  CATALOG = [
    { id:'p001', name:'Color-Safe Shampoo', brand:'Salon', category:'Hair / Shampoo', price:1800, image:'/images/studio-beige.jpg' },
    { id:'p002', name:'Bond Repair Mask',   brand:'Salon', category:'Hair / Mask',     price:2400, image:'/images/zen-stone-serum.jpg' },
    { id:'p003', name:'Thermal Protectant', brand:'Salon', category:'Hair / Spray',    price:2000, image:'/images/wooden-tray.jpg' },
    { id:'p004', name:'Vitamin C Serum',    brand:'Salon', category:'Skin / Serum',    price:2900, image:'/images/hero-almonds.jpg' }
  ];
  SOURCE = 'memory:fallback';
}
loadCatalog();

// manual reload (handy on Render)
app.post('/__reload_catalog', function(req,res){
  loadCatalog();
  res.json({ reloaded: true, source: SOURCE, count: Array.isArray(CATALOG)?CATALOG.length:0 });
});

// list directory (debug Render file system)
app.get('/__ls', function(req,res){
  var dir = (req.query.dir || 'public/data').toString();
  var abs = path.join(__dirname, dir);
  res.json({ dir: abs, files: listDirSafe(abs) });
});

// -------- Search (tokenized with light boosting) --------
function norm(s){ return (s||'').toString().toLowerCase(); }
var COLOR = { red:['red','copper','auburn','ginger'], purple:['purple','violet','brass'], blue:['blue','ash','cool'] };

function scoreProduct(p, tokens){
  var hay = norm([p.name, p.brand, p.category].filter(Boolean).join(' '));
  var s = 0;
  for (var i=0;i<tokens.length;i++){
    var t = tokens[i]; if(!t) continue;
    var matched = false;
    for (var canon in COLOR){
      var list = COLOR[canon];
      for (var j=0;j<list.length;j++){
        if (t.indexOf(list[j]) !== -1){ if (hay.indexOf(canon)!==-1) s += 3; matched = true; break; }
      }
      if (matched) break;
    }
    if (matched) continue;
    if (hay.indexOf(t)!==-1) s += 2;
  }
  var T = tokens.join(' ');
  if (T.indexOf('shampoo')!==-1 && hay.indexOf('shampoo')!==-1) s += 3;
  if (T.indexOf('conditioner')!==-1 && hay.indexOf('conditioner')!==-1) s += 3;
  if (T.indexOf('serum')!==-1 && hay.indexOf('serum')!==-1) s += 2;
  if (T.indexOf('spray')!==-1 && hay.indexOf('spray')!==-1) s += 2;
  if (T.indexOf('sensitive scalp')!==-1 && hay.indexOf('sensitive scalp')!==-1) s += 4;
  return s;
}

function searchCatalog(q){
  var tokens = norm(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return CATALOG.slice();
  var arr = [];
  for (var i=0;i<CATALOG.length;i++){
    var p = CATALOG[i];
    var s = scoreProduct(p, tokens);
    if (s>0) arr.push({p:p,s:s});
  }
  arr.sort(function(a,b){
    if (b.s !== a.s) return b.s - a.s;
    var an = norm(a.p.name), bn = norm(b.p.name);
    if (an<bn) return -1; if (an>bn) return 1; return 0;
  });
  if (arr.length===0) return CATALOG.slice();
  return arr.map(function(x){ return x.p; });
}

// -------- API --------
app.get('/api/products', function(req,res){
  var q = (req.query.q || '').toString();
  var limit = parseInt(req.query.limit,10); if(!limit || limit<1) limit=24; if (limit>200) limit=200;
  var offset = parseInt(req.query.offset,10); if(!offset || offset<0) offset=0;

  var items = searchCatalog(q);
  var total = items.length;
  items = items.slice(offset, offset+limit).map(function(p){
    return {
      id: p.id,
      name: p.name,
      brand: p.brand || '—',
      category: p.category || '—',
      price: (typeof p.price === 'number' ? p.price : 0),
      image: p.image || '/images/studio-beige.jpg'
    };
  });
  res.json({ success:true, source: SOURCE, total: total, offset: offset, limit: limit, items: items });
});

app.post('/api/chat', function(req,res){
  var b = req.body || {};
  var msg = (b.message || '').toString().trim();
  if (!msg) return res.json({ success:true, provider:'fallback', response:'Ask about color-safe care, scalp relief, or routines.' });
  if (msg.toLowerCase().indexOf('acne')!==-1){
    return res.json({
      success:true, provider:'followup',
      response:'I have a quick question to tailor this for you.',
      followUp:{ key:'skinType', question:'Which best describes your skin? (oily / combination / dry / sensitive)' }
    });
  }
  res.json({ success:true, provider:'fallback',
    response:"Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard." });
});

app.get('/__whoami', function(req,res){
  res.json({
    running: path.basename(__filename),
    products: { source: SOURCE, count: Array.isArray(CATALOG)?CATALOG.length:0 },
    public_data_ls: listDirSafe(path.join(PUB,'data')),
    routes: ['GET /api/products','POST /api/chat','POST /__reload_catalog','GET /__ls','GET /healthz','GET /__whoami','(static)']
  });
});

// let express static handle everything else
app.get(/^(?!\/api\/).+/, function(req,res,next){ next(); });

app.listen(PORT, '0.0.0.0', function(){
  console.log('Luminous listening on', PORT, 'source='+SOURCE);
  console.log('[catalog] public/data files:', listDirSafe(path.join(PUB,'data')));
});
