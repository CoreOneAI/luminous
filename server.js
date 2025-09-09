import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 10000;

// --- security & infra ---
app.use(helmet({
  contentSecurityPolicy: false // keep simple for now; we can harden later
}));
app.use(cors({ origin: true, credentials: false }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// --- static files ---
app.use(express.static(path.join(__dirname, 'public'), {
  index: 'index.html',
  maxAge: '1h',
  immutable: false
}));

// --- products feed ---
app.get('/products.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.json'));
});

// --- health ---
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  });
});

// --- chat /ask ---
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.post('/ask', async (req, res) => {
  try {
    if (!openai) {
      res.set('X-Provider', 'baseline');
      res.set('X-Model', 'none');
      return res.status(200).json({
        provider: 'baseline',
        model: 'none',
        reply: 'Hi! Add a valid OPENAI_API_KEY to enable AI answers.'
      });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const sys = `You are a friendly beauty assistant helping salon clients prep for visits.
Be concise, warm, and specific. When asked for product ideas, suggest categories & shade families first,
then 2–4 example product types. Avoid medical claims.`;

    const r = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: message }
      ],
      temperature: 0.6,
      max_tokens: 400
    });

    const reply = r.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a reply.';
    res.set('X-Provider', 'openai');
    res.set('X-Model', OPENAI_MODEL);
    return res.status(200).json({ provider: 'openai', model: OPENAI_MODEL, reply });
  } catch (err) {
    console.error('ASK_ERROR', err);
    return res.status(500).json({ error: 'AI error' });
  }
});

// --- image upload placeholder (future moodboard) ---
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });
  // later: extract palette
  return res.json({ ok: true, bytes: req.file.size, type: req.file.mimetype });
});

// --- start ---
app.listen(PORT, () => {
  console.log(`Luminous listening on ${PORT}`, { hasOpenAI: !!process.env.OPENAI_API_KEY });
});
