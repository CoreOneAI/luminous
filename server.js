// server.js  (ESM, no UI changes needed)
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

// --- paths / app ---
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: "1mb" }));

// --- security headers / CSP (allow Unsplash images) ---
const CSP = [
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
].join("; ");

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// --- static files ---
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// --- catalog loading / normalization ---
const CANDIDATES = [
  process.env.CATALOG_PATH,            // e.g. "salon_inventory.json" or "products.json"
  "public/data/products.json",
  "data/products.json",
  "products.json"
].filter(Boolean);

let CATALOG = [];
let CATALOG_SOURCE = null;

function fileExists(p) {
  try { return p && fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; }
}
function resolveCatalog() {
  for (const rel of CANDIDATES) {
    const abs = path.resolve(process.cwd(), rel);
    if (fileExists(abs)) return { abs, rel };
  }
  return null;
}
function normalizeItem(r = {}) {
  const price = (typeof r.price === "number") ? r.price
             : (typeof r.priceCents === "number") ? r.priceCents
             : 0;
  return {
    id: r.id || r.sku || r.SKU || String(Math.random()).slice(2),
    name: r.name || r.title || "Product",
    brand: r.brand || r.Brand || "—",
    category: r.category || r.Category || "—",
    price,                                      // cents; UI expects product.price
    image: r.image || r.Image || "/images/placeholder.jpg",
    description: r.description || r.Description || "",
    usage: r.usage || r.Usage || "",
    keywords: (r.keywords || r.tags || r.Tags || "").toString().toLowerCase()
  };
}
function loadCatalog() {
  const found = resolveCatalog();
  if (!found) {
    CATALOG = [];
    CATALOG_SOURCE = "NONE";
    console.warn("[catalog] no file found, returning empty catalog");
    return;
  }
  const json = JSON.parse(fs.readFileSync(found.abs, "utf8"));
  const arr = Array.isArray(json) ? json : (json.items || []);
  CATALOG = arr.map(normalizeItem);
  CATALOG_SOURCE = found.rel;
  console.log(`[catalog] loaded ${CATALOG.length} items from ${found.rel}`);
}
loadCatalog();

// --- search helpers (strict by default) ---
const SYNONYMS = {
  shampoo: ["shampoo", "cleanser", "clarifying"],
  serum: ["serum", "treatment", "essence"],
  mask: ["mask", "masque", "treatment"],
  conditioner: ["conditioner"],
  spray: ["spray", "mist"],
  purple: ["purple", "violet", "toning"],
  red: ["red", "copper", "warm"]
};
function expandTokens(q) {
  const base = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const bag = new Set(base);
  for (const t of base) {
    const syns = SYNONYMS[t];
    if (syns) syns.forEach(s => bag.add(s));
  }
  return Array.from(bag);
}
function scoreProduct(p, tokens) {
  const brand = (p.brand || "").toLowerCase();
  const name  = (p.name || "").toLowerCase();
  const cat   = (p.category || "").toLowerCase();
  const desc  = (p.description || "").toLowerCase();
  const keys  = (p.keywords || "").toLowerCase();
  let s = 0;
  for (const t of tokens) {
    if (cat.includes(t))  s += 3;
    if (name.includes(t)) s += 2;
    if (brand.includes(t))s += 1;
    if (desc.includes(t)) s += 0.5;
    if (keys.includes(t)) s += 0.5;
  }
  return s;
}
function paginate(arr, offset = 0, limit = 24) {
  const start = Math.max(0, offset|0);
  const end   = start + Math.max(1, limit|0);
  return arr.slice(start, end);
}

// --- /api/products (strict, deterministic) ---
app.get("/api/products", (req, res) => {
  const q       = (req.query.q || "").trim();
  const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit || "24", 10)));
  const offset  = Math.max(0, parseInt(req.query.offset || "0", 10));
  const strict  = req.query.strict !== "0";       // strict by default
  const fallback= req.query.fallback === "1";     // explicit only

  let items = CATALOG;

  if (q) {
    const tokens = expandTokens(q);
    items = CATALOG
      .map(p => ({ p, s: scoreProduct(p, tokens) }))
      .filter(x => x.s >= 1)
      .sort((a, b) => b.s - a.s)
      .map(x => x.p);
  }

  if (q && items.length === 0 && strict && !fallback) {
    return res.json({
      success: true,
      source: CATALOG_SOURCE,
      total: 0,
      count: 0,
      query: q,
      items: [],
      message: "No matches. Try a synonym (e.g., “clarifying” for shampoo, “treatment” for serum)."
    });
  }

  if ((!q && items.length === 0) || (q && items.length === 0 && fallback)) {
    items = CATALOG.slice(); // stable “featured” when empty or explicit fallback
  }

  const total = items.length;
  const page  = paginate(items, offset, limit);

  res.json({
    success: true,
    source: CATALOG_SOURCE,
    total,
    count: page.length,
    query: q,
    items: page
  });
});

// --- /api/chat (simple, deterministic fallback) ---
app.post("/api/chat", (req, res) => {
  const msg = ((req.body && req.body.message) || "").toLowerCase();

  // tiny intent hints, but products always come from /api/products
  if (/acne|breakout/.test(msg)) {
    return res.json({
      success: true,
      provider: "followup",
      response: "I have a quick question to tailor this for you.",
      followUp: {
        key: "skinType",
        question: "Which best describes your skin? (oily / combination / dry / sensitive)"
      }
    });
  }

  if (/purple.*shampoo|blonde|toning/.test(msg)) {
    return res.json({
      success: true,
      provider: "fallback",
      response: "Try a purple toning shampoo to neutralize brassiness. I’ll show matches below."
    });
  }

  // neutral guidance
  return res.json({
    success: true,
    provider: "fallback",
    response: "Quick guidance:\n• Book: Blowout or Hydration Facial.\n• Retail: color-safe shampoo, bond mask, thermal protectant.\n• Tip: finish with heat guard."
  });
});

// --- /api/bookings/create (stub) ---
app.post("/api/bookings/create", (req, res) => {
  const bookingId = crypto.randomBytes(5).toString("hex");
  res.json({ success: true, bookingId });
});

// --- diagnostics / health ---
app.get("/__whoami", (req, res) => {
  res.json({
    running: "server.js",
    catalogSource: CATALOG_SOURCE,
    catalogCount: CATALOG.length,
    routes: [
      "GET /api/products",
      "POST /api/chat",
      "POST /api/bookings/create",
      "GET /__whoami",
      "GET /healthz",
      "static /public/*"
    ]
  });
});
app.get("/healthz", (req, res) => res.type("text").send("ok"));

// --- root (serve your root index.html if present) ---
app.get("/", (req, res) => {
  // serve /index.html from project root if it exists; otherwise fall back to /public/index.html
  const rootIndex = path.join(__dirname, "index.html");
  if (fileExists(rootIndex)) return res.sendFile(rootIndex);
  return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// --- start ---
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Luminous listening on ${PORT}. catalog=${CATALOG_SOURCE}`);
});
