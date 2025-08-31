#!/usr/bin/env node
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import Ajv from 'ajv';

const args = Object.fromEntries(process.argv.slice(2).map((s,i,arr)=>s.startsWith('--')?[s.slice(2),arr[i+1]]:[]).filter(Boolean));
const IN  = args.in  || 'products.csv';
const OUT = args.out || 'salon_inventory.json';
const SCHEMA_PATH = args.schema || 'products.schema.json';

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH,'utf8'));
const ajv = new Ajv({ allErrors:true, strict:false });
const validate = ajv.compile(schema);

const splitList = (v) => (v||'').toString().split(/[|,]/).map(s=>s.trim()).filter(Boolean);
const asBool = (v) => /^(1|true|yes|y)$/i.test((v||'').toString().trim());

function parseCents(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return Number.isInteger(v) && v>=100 ? v : Math.round(v*100);
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return parseInt(s,10);
  const dollars = parseFloat(s.replace(/[^0-9.,-]/g,'').replace(/,/g,''));
  return isNaN(dollars) ? 0 : Math.round(dollars*100);
}

function normalizeCategory(raw) {
  const r = (raw||'').toLowerCase();
  const hair = r.includes('hair'), nail = r.includes('nail'), skin = r.includes('skin')||r.includes('face');
  const pick = (top, sub) => `${top} / ${sub}`;
  if (r.includes('shampoo'))     return pick('Hair','Shampoo');
  if (r.includes('conditioner')) return pick('Hair','Conditioner');
  if (r.includes('mask'))        return pick(hair?'Hair':(skin?'Skin':'Hair'),'Mask');
  if (r.includes('serum'))       return pick(skin?'Skin':(hair?'Hair':'Skin'),'Serum');
  if (r.includes('spray'))       return pick('Hair','Spray');
  if (r.includes('oil'))         return pick(hair?'Hair':'Skin','Oil');
  if (r.includes('treatment'))   return pick(nail?'Nail':(hair?'Hair':'Skin'),'Treatment');
  if (r.includes('tool') || r.includes('accessor')) return pick('Tools','Accessory');
  if (hair) return pick('Hair','Care');
  if (skin) return pick('Skin','Care');
  if (nail) return pick('Nail','Care');
  return 'Hair / Care';
}

function slug(s){return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,40)}
function makeId(row, seen) {
  const base = row.id?.trim() || `${slug(row.brand)}-${slug(row.name)}` || `prod-${Math.random().toString(36).slice(2,8)}`;
  let id = base || `prod-${Date.now()}`;
  let i=1; while (seen.has(id)) { id = `${base}-${i++}`; }
  seen.add(id); return id;
}

const csv = fs.readFileSync(IN,'utf8');
const rows = parse(csv, { columns:true, bom:true, skip_empty_lines:true });

const seen = new Set();
const products = rows.map(r => {
  const price_cents = r.price_cents ? parseCents(r.price_cents) : parseCents(r.price);
  const inStock = r.inStock !== undefined ? asBool(r.inStock) : true;
  const category = normalizeCategory(r.category || `${r.brand} ${r.name}`);
  const image = (r.image||'').trim() || '/images/placeholder.svg';

  const prod = {
    id: makeId(r, seen),
    name: (r.name||'').trim(),
    brand: (r.brand||'').trim() || '—',
    category,
    price_cents,
    inStock,
    image,
    description: (r.description||'').trim() || undefined,
    benefits: splitList(r.benefits),
    usage: (r.usage||'').trim() || undefined,
    traits: {
      hairType: splitList(r.hairType),
      concerns: splitList(r.concerns),
      ingredients: splitList(r.ingredients)
    },
    tags: splitList(r.tags),
    crossSell: splitList(r.crossSell)
  };

  // Clean empties
  if (!prod.description) delete prod.description;
  if (!prod.usage) delete prod.usage;
  return prod;
});

const errors = [];
products.forEach((p, idx) => {
  const ok = validate(p);
  if (!ok) errors.push({ idx, id: p.id, errors: validate.errors });
});
if (errors.length) {
  console.error(`\n❌ Validation failed for ${errors.length} product(s):`);
  for (const e of errors.slice(0, 10)) {
    console.error(`- Row#${e.idx+2} id=${e.id}: ${ajv.errorsText(e.errors, { separator: ' | ' })}`);
  }
  if (errors.length > 10) console.error(`  ...and ${errors.length-10} more.`);
  process.exit(1);
}

fs.writeFileSync(OUT, JSON.stringify(products, null, 2));
const priced = products.filter(p => p.price_cents && p.price_cents >= 100).length;
console.log(`\n✅ Wrote ${products.length} products to ${OUT} (priced: ${priced}).`);
