// server.js  —  Node >=18, package.json has "type":"module"
import express from "express";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import url from "url";

const app = express();
app.use(express.json());

// ----- Paths / ENV -----
const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = process.env.PORT || 3000;
const CATALOG_ENV = process.env.CATALOG_PATH || ""; // e.g. "products.json" or "data/products.json"

// Try these in order if CATALOG_PATH not set
const FALLBACK_CATALOGS = [
  "data/products.json",
  "public/data/products.json",
  "products.json",
  "salon_inventory.json",
  "public/salon_inventory.json",
];

let CATALOG_PATH_IN_USE = null;

// ----- Utilities -----
async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function toCents(val) {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val >= 1000 ? Math.round(val) : Math.round(val * 100);
  }
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[$,]/g, ""));
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return NaN;
}

function normalizeProduct(p) {
  // Shallow copy + trims
  const clean = { ...p };
  ["name", "brand", "category", "description"].forEach(k => {
    if (typeof clean[k] === "string") clean[k] = clean[k].trim();
  });

  // Price normalization -> priceCents
  let cents = Number.isFinite(clean.priceCents) ? clean.priceCents : NaN;
  if (!Number.isFinite(cents) || cents <= 0) {
    for (const key of ["price", "Price", "priceUSD", "msrp", "salePrice"]) {
      if (clean[key] !== undefined && clean[key] !== null) {
        const maybe = toCents(clean[key]);
        if (Number.isFinite(maybe) && maybe > 0) { cents = maybe; break; }
      }
    }
  }
  if (Number.isFinite(cents) && cents > 0) clean.priceCents = cents;
  else delete clean.priceCents;

  // Ensure category/brand defaults for display
  if (!clean.category) clean.category = "—";
  if (!clean.brand) clean.brand = "—";

  // Image fallback
  if (!clean.image) clean.image = "/images/placeholder.jpg";

  return clean;
}

function pickCatalogArray(raw) {
  // Accept either an array or an object with common array keys
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;
  if (raw && Array.isArray(raw.products)) return raw.products;
  return [];
}

// In-memory cache
let catalog = [];
let catalogStamp = 0;

async function resolveCatalogPath() {
  if (CATALOG_ENV) {
    const abs = path.isAbsolute(CATALOG_ENV) ? CATALOG_ENV : path.join(ROOT, CATALOG_ENV);
    if (await fileExists(abs)) return abs;
  }
  for (const rel of FALLBACK_CATALOGS) {
    const abs = path.join(ROOT, rel);
    if (await fileExists(abs)) return abs;
  }
  return null;
}

async function loadCatalog(force = false) {
  const p = await resolveCatalogPath();
  CATALOG_PATH_IN_USE = p;
  if (!p) {
    catalog = [];
    catalogStamp = Date.now();
    console.warn("[catalog] No catalog file found.");
    return;
  }

  // Optionally skip reload if not forced and file unchanged. Simple: reload always (cheap + robust)
  try {
    const buf = await fs.readFile(p, "utf8");
    const json = JSON.parse(buf);
    const arr = pickCatalogArray(json).map(normalizeProduct).filter(Boolean);
    catalog = arr;
    catalogStamp = Date.now();
    console.log(`[catalog] Loaded ${arr.length} items from ${p}`);
  } catch (err) {
    console.error(`[catalog] Failed to read ${p}:`, err.message);
    catalog = [];
    catalogStamp = Date.now();
  }
}

// Simple text search across fields
function productMatches(p, tokens) {
  if (!tokens || tokens.length === 0) return true;
  const hay = [
    p.name, p.brand, p.category, p.description,
    ...(Array.isArray(p.tags) ? p.tags : []),
    ...(Array.isArray(p.benefits) ? p.benefits : []),
    ...(typeof p.ingredients === "string" ? [p.ingredients] : [])
  ].filter(Boolean).join(" ").toLowerCase();

  return tokens.every(t => hay.includes(t));
}

function filterByProfile(p, q) {
  // Optional “profile” filters from query string. Keep gentle guards (no-ops if empty)
  // hairType/skinType/concerns are often stored in tags or suitableFor
  const need = [];
  if (q.hairType) need.push(q.hairType.toLowerCase());
  if (q.skinType) need.push(q.skinType.toLowerCase());
  if (q.concerns) need.push(q.concerns.toLowerCase());

  if (need.length) {
    const bag = [
      p.category, p.description, p.suitableFor,
      ...(Array.isArray(p.tags) ? p.tags.join(" ") : []),
      ...(Array.isArray(p.benefits) ? p.benefits.join(" ") : []),
    ].filter(Boolean).join(" ").toLowerCase();
    if (!need.every(tok => bag.includes(tok))) return false;
  }

  // budget: budget ($10-30), mid ($30-60), luxury ($60+)
  if (q.budget && p.priceCents) {
    const dollars = p.priceCents / 100;
    if (q.budget === "budget" && !(dollars >= 10 && dollars <= 30)) return false;
    if (q.budget === "mid"    && !(dollars > 30 && dollars <= 60)) return false;
    if (q.budget === "luxury" && !(dollars > 60)) return false;
  }

  return true;
}

// ----- API: Products -----
app.get("/api/products", async (req, res) => {
  await loadCatalog(); // cheap reload each request so updates show without redeploy

  const { q = "", limit = "12", offset = "0" } = req.query;

  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
  const off = Math.max(0, parseInt(offset, 10) || 0);

  const tokens = String(q).toLowerCase().split(/\s+/).filter(Boolean);

  let results = catalog.filter(p => productMatches(p, tokens))
                       .filter(p => filterByProfile(p, req.query));

  // Stable order: by name, then id (prevents the “same 4” perception)
  results = results.sort((a, b) => (a.name || "").localeCompare(b.name || "") || (a.id || "").localeCompare(b.id || ""));

  const total = results.length;
  const items = results.slice(off, off + lim);

  res.json({
    success: true,
    source: CATALOG_PATH_IN_USE || "memory",
    count: items.length,
    total,
    query: q,
    items
  });
});

// ----- API: Chat (minimal echo; keeps your frontend happy) -----
app.post("/api/chat", async (req, res) => {
  const msg = (req.body?.message || "").trim();
  // Keep it short and neutral; your UI provides the rest
  const reply = msg
    ? `Got it — I’ll tailor picks for “${msg}”.`
    : "Tell me your goal (e.g., 'purple shampoo', 'anti-aging serum').";
  res.json({ success: true, response: reply });
});

// ----- Debug helpers -----
app.get("/__whoami", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    env: process.env.NODE_ENV || "development",
    port: PORT,
    catalogPath: CATALOG_PATH_IN_USE
  });
});

app.get("/healthz", (req, res) => res.type("text/plain").send("ok"));

// ----- Static files -----
app.use(express.static(PUBLIC_DIR, { index: "index.html", extensions: ["html"] }));

// Do NOT add a wildcard SPA catch-all that steals /api or /data routes.
// Keep root route explicit for index if needed:
app.get("/", (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  createReadStream(indexPath).pipe(res);
});

// ----- Start -----
await loadCatalog(true);
app.listen(PORT, () => {
  const src = CATALOG_PATH_IN_USE || "none";
  console.log(`Luminous listening on ${PORT}. catalog=${src}`);
});
