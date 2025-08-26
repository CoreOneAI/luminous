// server.js — UI + API (Node 18+)
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();

// Permissive CSP until all inline CSS/JS are external
app.use((req,res,next)=>{
  res.setHeader('Content-Security-Policy',[
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://images.unsplash.com",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ].join('; '));
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  next();
});

app.use(cors());
app.use(express.json());

// ---------- Static site ----------
const staticDir = path.join(__dirname,'public');
app.get('/favicon.ico', (req,res)=>res.redirect(302,'/favicon.svg'));
app.use(express.static(staticDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control','no-cache');
    else res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  }
}));
app.get('/', (req,res)=>res.sendFile(path.join(staticDir,'index.html')));

// ---------- Health ----------
app.get('/healthz', (_,res)=>res.json({ ok: true }));

// ---------- APIs ----------
app.post('/api/chat', (req,res)=>{
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ success:false, error:'message required' });
  const response = "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Rationale: maximize shine/hydration.\n• Retail: color-safe shampoo, bond mask, thermal protectant.";
  res.json({ success:true, provider:'fallback', response });
});

const PRODUCTS = [
  {id:'p001', name:'Color-Safe Shampoo',  price:1800, category:'Hair'},
  {id:'p002', name:'Bond Repair Mask',    price:2400, category:'Hair'},
  {id:'p003', name:'Thermal Protectant',  price:2000, category:'Hair'},
  {id:'p004', name:'Vitamin C Serum',     price:2900, category:'Skin'},
];
app.get('/api/products', (req,res)=>{
  const q = (req.query.search||'').toString().toLowerCase();
  const items = q ? PRODUCTS.filter(p => (p.name+' '+(p.category||'')).toLowerCase().includes(q)) : PRODUCTS;
  res.json({ success:true, count: items.length, items });
});

const bookings = new Map();
app.post('/api/bookings/create', (req,res)=>{
  const { service, style, price, datetimeISO, notes } = req.body || {};
  if (!service || !datetimeISO) return res.status(400).json({ success:false, error:'service and datetimeISO required' });
  const bookingId = 'bk_' + Math.random().toString(36).slice(2,8);
  const amountCents = Math.max(0, Math.round((Number(price)||0) * 100));
  bookings.set(bookingId, { bookingId, service, style:style||null, amountCents, currency:'usd', datetimeISO, notes:notes||'', status:'unpaid', createdAt:new Date().toISOString() });
  res.json({ success:true, bookingId, status:'unpaid', checkoutUrl:null });
});

// ---------- Debug: list registered routes ----------
app.get('/__whoami', (req,res)=>{
  const list = (app._router.stack||[])
    .filter(r=>r.route && r.route.path)
    .map(r=>`${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
  res.json({ running:'server.js', routes:list });
});

// ---------- Wildcard AFTER APIs ----------
app.get(/^\/(?!api\/).+/, (req,res)=>res.sendFile(path.join(staticDir,'index.html')));

app.listen(PORT, ()=>console.log('Luminous listening on', PORT));
