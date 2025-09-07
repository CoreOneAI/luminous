import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist');
const PRODUCTS_PATH = path.join(__dirname, 'products.json');

app.disable('x-powered-by');
app.use(express.json());

// CORS (open for dev; tighten later if needed)
app.use(cors({ origin: true }));

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// --- PRODUCTS API ---
app.get('/api/products', (req, res) => {
  try {
    const raw = fs.readFileSync(PRODUCTS_PATH, 'utf8');
    let items = [];
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      items = [];
    }

    const { q, store, min, max } = req.query;
    let out = items.slice();

    if (q) {
      const needle = String(q).toLowerCase();
      out = out.filter(p =>
        [p.name, p.description, p.category, p.brand]
          .filter(Boolean)
          .some(s => String(s).toLowerCase().includes(needle))
      );
    }
    if (store) {
      const s = String(store).toLowerCase();
      out = out.filter(p => String(p.store || '').toLowerCase() === s);
    }
    const minN = min !== undefined ? Number(min) : null;
    const maxN = max !== undefined ? Number(max) : null;
    if (minN !== null && !Number.isNaN(minN)) out = out.filter(p => Number(p.price) >= minN);
    if (maxN !== null && !Number.isNaN(maxN)) out = out.filter(p => Number(p.price) <= maxN);

    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, count: out.length, items: out });
  } catch (err) {
    console.error('Failed to read products.json:', err);
    res.status(500).json({ ok: false, error: 'PRODUCTS_READ_ERROR' });
  }
});

// --- Static (built frontend) ---
app.use(express.static(DIST_DIR));

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Build not found. Run `npm run build`.');
  }
});

app.listen(PORT, () => {
  console.log(`Ecommerce app listening on ${PORT}`);
});
