// ---- catalog loader & helpers (ESM-safe) ----
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = process.env.CATALOG_PATH || 'data/products.json';

async function readJSON(p) {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt);
}

async function loadCatalog() {
  const candidates = [
    ENV_PATH,
    path.join(__dirname, 'data/products.json'),
    path.join(__dirname, 'products.json'),
    path.join(__dirname, 'public/data/products.json'),
  ];
  for (const p of candidates) {
    try {
      const data = await readJSON(p);
      if (Array.isArray(data) && data.length) {
        return { items: data, source: p };
      }
    } catch (_) { /* try next */ }
  }
  // Final tiny seed to prevent 0 results (but we try to never use this)
  const seed = [
    { id:'color-safe-shampoo', name:'Color-Safe Shampoo', brand:'Professional', category:'Hair', priceCents:1800, image:'/images/placeholder.jpg' },
    { id:'bond-repair-mask',   name:'Bond Repair Mask',   brand:'Professional', category:'Hair', priceCents:2400, image:'/images/placeholder.jpg' },
    { id:'thermal-protectant', name:'Thermal Protectant', brand:'Professional', category:'Hair', priceCents:2000, image:'/images/placeholder.jpg' },
    { id:'vitamin-c-serum',    name:'Vitamin C Serum',    brand:'Premium',      category:'Skin', priceCents:2900, image:'/images/placeholder.jpg' },
  ];
  return { items: seed, source: 'seed' };
}

function normalizeItem(p) {
  const priceCents =
    Number.isFinite(p.priceCents) ? p.priceCents :
    Number.isFinite(p.price)      ? p.price      : 0;
  return { ...p, priceCents, price: priceCents };
}

function shuffle(arr) {
  // small, stable-ish shuffle so users don’t see the same 4
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildMatcher(q) {
  const ql = q.toLowerCase().trim();
  if (!ql) return () => true;

  const tokens = ql.split(/[\s,]+/).filter(Boolean);
  const synonyms = {
    purple: ['violet', 'toning'],
    red: ['copper', 'warm'],
    sensitive: ['gentle', 'scalp'],
    'anti-aging': ['antiaging', 'retinol', 'vitamin a'],
    accessories: ['brush', 'comb', 'clip', 'tweezer', 'cap', 'bobby', 'razor', 'file'],
    shampoo: ['cleanse', 'wash'],
    conditioner: ['condition', 'hydrating'],
    serum: ['treatment'],
    mask: ['masque'],
    spray: ['mist'],
  };

  const expand = (t) => [t, ...(synonyms[t] || [])];

  return (r) => {
    const hay = `${r.name||''} ${r.brand||''} ${r.category||''} ${r.description||''} ${r.usage||''}`.toLowerCase();
    return tokens.some(t => expand(t).some(s => hay.includes(s)));
  };
}
