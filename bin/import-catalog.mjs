// bin/import-catalog.mjs  (ESM)
// Usage: node bin/import-catalog.mjs "<path-to-xlsx-or-csv>" [<output-json>]
// Writes normalized catalog to output (default: ./products.json) AND mirrors to ./public/data/products.json

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcArg = process.argv[2];
const outArg = process.argv[3] || "./products.json";
if (!srcArg) {
  console.error("Usage: node bin/import-catalog.mjs <source.xlsx|.csv> [output.json]");
  process.exit(1);
}

const SRC = path.resolve(process.cwd(), srcArg);
const OUT = path.resolve(process.cwd(), outArg);
const PUB_DIR = path.resolve(process.cwd(), "public", "data");
const PUB_JSON = path.join(PUB_DIR, "products.json");

// Helpers
const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const toCents = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$, ]/g, ""));
  if (!isFinite(n)) return null;
  // If it's > 1000 and looks like cents already, keep; else treat as dollars
  return n >= 1000 && Number.isInteger(n) ? n : Math.round(n * 100);
};

const readSheetToJson = (filePath) => {
  const wb = xlsx.readFile(filePath, { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { defval: "" });
};

const normalizeRow = (row) => {
  // Accept common header variants (case/spacing tolerant)
  const pick = (keys, def = "") => {
    for (const k of keys) {
      if (k in row && row[k] !== undefined && row[k] !== null) return row[k];
    }
    // try case-insensitive
    const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
    for (const k of keys.map((x) => x.toLowerCase())) {
      if (k in lower) return lower[k];
    }
    return def;
  };

  const name = String(pick(["Name", "Product", "Product Name"], "")).trim();
  if (!name) return null;

  const idRaw = pick(["ID", "Sku", "SKU", "Handle", "Slug"], "");
  const id = idRaw ? slug(idRaw) : slug(name);

  const brand = String(pick(["Brand", "Manufacturer"], "—")).trim() || "—";
  const category = String(pick(["Category", "Type"], "—")).trim() || "—";

  const priceCents =
    toCents(pick(["PriceCents", "Price_cents"])) ??
    toCents(pick(["Price", "Cost", "MSRP"], ""));

  const image =
    String(pick(["Image", "ImageURL", "Image URL", "Photo"], "")).trim() ||
    "/images/placeholder.jpg";

  const description = String(pick(["Description", "Desc", "Notes"], "")).trim();
  const usage = String(pick(["Usage", "HowToUse", "How To Use"], "")).trim();

  const tagsRaw = pick(["Tags", "Keywords"], "");
  const tags =
    Array.isArray(tagsRaw)
      ? tagsRaw
      : String(tagsRaw || "")
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean);

  return {
    id,
    name,
    brand,
    category,
    priceCents: priceCents ?? 0,
    image,
    description: description || undefined,
    usage: usage || undefined,
    tags: tags.length ? tags : undefined,
  };
};

const main = async () => {
  try {
    // Ensure output dirs
    await fs.mkdir(path.dirname(OUT), { recursive: true });
    await fs.mkdir(PUB_DIR, { recursive: true });

    // Read + normalize
    const rows = readSheetToJson(SRC);
    const items = rows
      .map(normalizeRow)
      .filter(Boolean);

    if (!items.length) {
      console.error("No valid rows found. Check your column headers (Name, Price/PriceCents, etc.).");
      process.exit(2);
    }

    // Write main output
    await fs.writeFile(OUT, JSON.stringify(items, null, 2));
    // Mirror to public/data/products.json (what your site currently reads)
    await fs.writeFile(PUB_JSON, JSON.stringify(items, null, 2));

    console.log(
      `Imported ${items.length} products.\n` +
      `→ ${OUT}\n` +
      `→ ${PUB_JSON}`
    );
  } catch (err) {
    console.error("Import failed:", err.message);
    process.exit(3);
  }
};

main();
