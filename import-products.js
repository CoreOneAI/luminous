#!/usr/bin/env node
/**
 * Minimal CSV → salon_inventory.json importer (merge/upsert).
 * Usage (examples):
 *   node import-products.js --csv accessories.csv --catalog salon_inventory.json
 *   node import-products.js --csv eyelashes.csv --catalog salon_inventory.json --default-category "Accessories / Eyelashes" --image-default "/images/lash-generic.jpg"
 *
 * Notes:
 *  - Accepts price as "12.99" or "$12.99" or price_cents.
 *  - Merges on id if present; else merges on (name+brand) key.
 *  - keywords: split by ';' or ',' into array.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function arg(flag, def=null){
  const i = process.argv.indexOf(flag);
  return i> -1 && process.argv[i+1] ? process.argv[i+1] : def;
}
const CSV_PATH = arg('--csv');
const CATALOG_PATH = arg('--catalog','salon_inventory.json');
const DEFAULT_CAT = arg('--default-category','Accessories / General');
const DEFAULT_IMG = arg('--image-default','/images/placeholder.jpg');

if (!CSV_PATH) {
  console.error('Missing --csv <file.csv>');
  process.exit(1);
}

function readText(p){ return fs.readFileSync(path.resolve(p), 'utf8'); }
function writeText(p, txt){ fs.writeFileSync(path.resolve(p), txt, 'utf8'); }
function safeJsonParse(txt, def){ try { return JSON.parse(txt); } catch { return def; } }

function csvToRows(text){
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i=0;i<text.length;i++){
    const c = text[i], n = text[i+1];
    if (c === '"' ) {
      if (inQuotes && n === '"'){ cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes){ row.push(cell.trim()); cell=''; }
    else if ((c === '\n' || c === '\r') && !inQuotes){
      if (cell.length || row.length){ row.push(cell.trim()); rows.push(row); row=[]; cell=''; }
      if (c === '\r' && n === '\n') i++;
    } else { cell += c; }
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(x => x.length));
}

function toCents(v){
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 100);
  const s = String(v).trim();
  const num = Number(s.startsWith('$') ? s.slice(1) : s);
  return Number.isFinite(num) ? Math.round(num * 100) : null;
}

function normalizeKeywords(s){
  if (!s) return [];
  return s.split(/[;,]/).map(x=>x.trim()).filter(Boolean);
}

function makeId(name, brand){
  const base = (name||'unknown') + '|' + (brand||'');
  return 'sku-' + require('crypto').createHash('md5').update(base.toLowerCase()).digest('hex').slice(0,8);
}

function headerMap(head){
  const m = {};
  head.forEach((h,i)=> m[h.toLowerCase()] = i);
  return m;
}

function rowVal(row, map, key){
  const i = map[key.toLowerCase()];
  return (i != null) ? row[i] : '';
}

function loadCatalog(p){
  if (!fs.existsSync(p)) return [];
  const data = safeJsonParse(readText(p), []);
  return Array.isArray(data) ? data : [];
}

function upsert(catalog, item){
  const key = (item.id || '').trim();
  let idx = -1;
  if (key) idx = catalog.findIndex(x => (x.id||'') === key);
  if (idx === -1) idx = catalog.findIndex(x =>
    (x.name||'').toLowerCase() === (item.name||'').toLowerCase() &&
    (x.brand||'').toLowerCase() === (item.brand||'').toLowerCase()
  );
  if (idx === -1) { catalog.push(item); return {added:1, updated:0}; }
  const cur = catalog[idx];
  const merged = {...cur, ...Object.fromEntries(Object.entries(item).filter(([_,v]) => v != null && v !== ''))};
  catalog[idx] = merged;
  return {added:0, updated:1};
}

const csvText = readText(CSV_PATH);
const rows = csvToRows(csvText);
if (rows.length < 2) {
  console.error('CSV has no data rows.');
  process.exit(1);
}
const head = rows[0]; const map = headerMap(head);
const body = rows.slice(1);

const catalog = loadCatalog(CATALOG_PATH);
let added = 0, updated = 0;

function inferCategory(raw){
  return raw && raw.length ? raw : DEFAULT_CAT;
}
function inferImage(raw){
  return raw && raw.length ? raw : DEFAULT_IMG;
}

for (const r of body){
  const name  = rowVal(r, map, 'name');
  if (!name) continue;
  const brand = rowVal(r, map, 'brand') || '—';
  const category = inferCategory(rowVal(r, map, 'category'));
  const priceCents = (function(){
    const centsRaw = rowVal(r, map, 'price_cents');
    const pRaw = rowVal(r, map, 'price');
    return (centsRaw && Number.isFinite(Number(centsRaw))) ? Number(centsRaw) : toCents(pRaw);
  })();
  const image = inferImage(rowVal(r, map, 'image'));
  const keywords = normalizeKeywords(rowVal(r, map, 'keywords'));
  const description = rowVal(r, map, 'description') || '';

  let id = rowVal(r, map, 'id');
  if (!id) id = makeId(name, brand);

  const item = {
    id, name, brand, category,
    price: priceCents ?? 0,
    image, keywords, description
  };
  const res = upsert(catalog, item);
  added += res.added; updated += res.updated;
}

writeText(CATALOG_PATH, JSON.stringify(catalog, null, 2));
console.log(JSON.stringify({ ok:true, catalog: CATALOG_PATH, added, updated, total: catalog.length }, null, 2));
