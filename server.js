// server.js — Luminous Beauty (clean, no colorthief)
// Node >= 18, ESM (package.json has "type": "module")

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---- Env / Config ----
const PORT          = process.env.PORT || 10000;
const ALLOW_ORIGIN  = process.env.ALLOW_ORIGIN || '*'; // set to your site URL to lock down
const OPENAI_KEY    = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ---- App ----
const app = express();
app.use(express.json({ limit: '2mb' }));

// Security headers (relaxed CSP so inline styles/scripts in your current HTML won’t break)
app.use(helmet({
  contentSecurityPolicy: false, // we’ll rely on static bundle safety for now
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: ALLOW_ORIGIN === '*' ? true : ALLOW_ORIGIN,
}));

// Static files
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, {
  etag: true,
  lastModified: true,
  maxAge: '1h'
}));

// ---- Health ----
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAI: Boolean(OPENAI_KEY),
    model: OPENAI_MODEL
  });
});

// ---- Products ----
// Your index.html already fetches /products.json from /public.
// This route guarantees it resolves even if static isn’t mounted.
app.get('/products.json', (req, res) => {
  res.sendFile(path.join(publicDir, 'products.json'));
});

// ---- Ask AI (independent of catalog) ----
app.post('/ask', async (req, res) => {
  try {
    if (!OPENAI_KEY) {
      return res.status(503).json({ ok: false, error: 'OPENAI_API_KEY not set' });
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });
    const system = [
      "You are Luminous, a calm, friendly beauty assistant for salon clients.",
      "Be practical and specific. Offer product-agnostic advice first; if relevant, describe product types (e.g., 'lightweight, oil-free moisturizer').",
      "Avoid medical claims. Keep tone positive and encouraging."
    ].join(' ');

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: message }
      ],
      temperature: 0.7
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not find an answer.';
    res.setHeader('X-Provider', 'openai');
    res.setHeader('X-Model', OPENAI_MODEL);
    return res.json({ provider: 'openai', model: OPENAI_MODEL, reply });
  } catch (err) {
    console.error('ASK error:', err);
    return res.status(500).json({ ok: false, error: 'AI unavailable' });
  }
});

// ---- Root -> index.html ----
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---- 404 fallback (for SPA-like paths) ----
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

// ---- Start ----
app.listen(PORT, () => {
  console.log('Luminous listening on', PORT, { hasOpenAI: Boolean(OPENAI_KEY) });
});
