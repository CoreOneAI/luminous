// server.js — Luminous demo backend (Ask-AI, moodboard, palette, stylist brief, PDF)
import fs from 'fs';
import path from 'path';
import url from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import ColorThief from 'colorthief';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------- security + static ----------
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // keep simple for demo; tighten later
}));
app.use(cors({ origin: '*', methods: 'GET,POST,OPTIONS' }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// serve static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ensure upload dir
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// ---------- file upload ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// ---------- memory store (demo only) ----------
/**
 * briefs[id] = {
 *   id, createdAt, user, inputs, ai, images[], palette[], stylistNotes
 * }
 */
const briefs = new Map();

// ---------- OpenAI client ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ---------- helpers ----------
const pick = (obj, keys) => keys.reduce((a, k) => (obj[k] !== undefined ? (a[k]=obj[k], a) : a), {});
const hex = (rgb) => {
  if (!Array.isArray(rgb) || rgb.length < 3) return '#999999';
  return '#' + rgb.slice(0,3).map(v => v.toString(16).padStart(2,'0')).join('');
};

async function extractPalette(filePath, count = 6) {
  try {
    const palette = await ColorThief.getPalette(filePath, count);
    return palette.map(hex);
  } catch (e) {
    console.error('Palette error:', e.message);
    return ['#c0c0c0','#a0a0a0','#808080','#606060','#404040','#202020'];
  }
}

async function aiSuggestBrief({ prompt, preferences = {}, palette = [], images = [] }) {
  const sys = `You are a friendly, precise beauty stylist assistant.
Return JSON only with keys:
{ "mood":"", "summary":"", "hair":[], "makeup":[], "nails":[], "outfit":[], "talking_points":[], "care_tips":[], "style_tags":[] }.
Keep each array with 3-6 concise bullet items. Use approachable tone.`;

  const user = [
    `Client prompt: ${prompt || 'N/A'}`,
    `Preferences: ${JSON.stringify(preferences)}`,
    palette?.length ? `Palette (hex): ${palette.join(', ')}` : '',
    images?.length ? `Images: ${images.length} uploaded refs` : ''
  ].filter(Boolean).join('\n');

  if (!openai) {
    // Fallback for demo if no key present
    return {
      mood: "Soft glam with natural undertones",
      summary: "Clean base, soft blush, warm-neutral eye, satin lip; beachy waves optional.",
      hair: ["Loose waves", "Face-framing layers", "Light hold texturizing spray"],
      makeup: ["Dewy base", "Soft peach blush", "Taupe/bronze lid", "Brown mascara", "Satin nude lip"],
      nails: ["Sheer pink", "Milky nude", "Short almond shape"],
      outfit: ["Neutral palette", "Gold accents", "Soft textures (silk/knit)"],
      talking_points: ["Undertone match", "Blush placement", "Lash curl + brown mascara look"],
      care_tips: ["SPF daily", "Gentle cleanse", "Hydrating primer before makeup"],
      style_tags: ["soft-glam","everyday-elevated","neutral-undertone"]
    };
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    temperature: 0.5
  });

  const txt = completion.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(txt);
  } catch {
    return {
      mood: "Modern natural",
      summary: txt.slice(0, 400),
      hair: [], makeup: [], nails: [], outfit: [], talking_points: [], care_tips: [], style_tags: []
    };
  }
}

// ---------- routes ----------

// health
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAI: !!OPENAI_API_KEY
  });
});

// image upload + palette
app.post('/api/upload', upload.array('images', 6), async (req, res) => {
  try {
    const files = req.files || [];
    const images = files.map(f => `/uploads/${path.basename(f.path)}`);

    let palette = [];
    if (files.length) {
      palette = await extractPalette(files[0].path, 6);
    }

    res.json({ ok: true, images, palette });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// create brief
app.post('/api/brief', async (req, res) => {
  try {
    const id = uuidv4();
    const payload = pick(req.body || {}, ['prompt','preferences','palette','images','user']);
    const ai = await aiSuggestBrief(payload);

    const brief = {
      id,
      createdAt: new Date().toISOString(),
      ...payload,
      ai,
      stylistNotes: ''
    };
    briefs.set(id, brief);

    res.json({ ok: true, id, brief });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// get brief (json)
app.get('/api/brief/:id', (req, res) => {
  const b = briefs.get(req.params.id);
  if (!b) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, brief: b });
});

// stylist notes
app.post('/api/brief/:id/notes', (req, res) => {
  const b = briefs.get(req.params.id);
  if (!b) return res.status(404).json({ ok: false, error: 'Not found' });
  b.stylistNotes = String(req.body?.notes || '');
  briefs.set(b.id, b);
  res.json({ ok: true, brief: b });
});

// stylist read-only page
app.get('/stylist', (req, res) => {
  const id = String(req.query.id || '');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Luminous Stylist Brief</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f7f7f8;color:#111}
  .wrap{max-width:820px;margin:0 auto;padding:20px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{border-radius:999px;padding:6px 10px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px}
  .palette{display:flex;gap:8px}
  .sw{width:28px;height:28px;border-radius:50%;border:1px solid #e5e7eb}
  .images{display:flex;gap:8px;flex-wrap:wrap}
  .thumb{width:120px;height:120px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb}
  textarea{width:100%;min-height:100px;border:1px solid #e5e7eb;border-radius:10px;padding:10px}
  button{background:#111;color:#fff;border:none;border-radius:10px;padding:10px 14px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Stylist Brief</h1>
  <div id="root" class="card">Loading…</div>
  <div class="card">
    <h3>Stylist Notes</h3>
    <textarea id="notes"></textarea>
    <div style="margin-top:10px"><button id="save">Save Notes</button></div>
  </div>
</div>
<script>
  const id = new URL(location.href).searchParams.get('id')||'';
  const root = document.getElementById('root');
  const notesEl = document.getElementById('notes');
  async function load(){
    const r = await fetch('/api/brief/'+id); const j = await r.json();
    if(!j.ok){ root.textContent = 'Not found'; return; }
    const b = j.brief;
    notesEl.value = b.stylistNotes || '';
    root.innerHTML = \`
      <div><strong>ID:</strong> \${b.id}</div>
      <div class="card"><strong>Mood:</strong> \${b.ai.mood||''}<br/><small>\${b.ai.summary||''}</small></div>
      <div class="card">
        <h3>Palette</h3>
        <div class="palette">\${(b.palette||[]).map(c=>\`<div class="sw" title="\${c}" style="background:\${c}"></div>\`).join('')}</div>
      </div>
      <div class="card"><h3>Hair</h3><ul>\${(b.ai.hair||[]).map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>
      <div class="card"><h3>Makeup</h3><ul>\${(b.ai.makeup||[]).map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>
      <div class="card"><h3>Nails</h3><ul>\${(b.ai.nails||[]).map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>
      <div class="card"><h3>Outfit</h3><ul>\${(b.ai.outfit||[]).map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>
      <div class="card"><h3>Talking Points</h3><ul>\${(b.ai.talking_points||[]).map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>
      <div class="card"><h3>Care Tips</h3><ul>\${(b.ai.care_tips||[]).map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>
      <div class="card"><h3>Images</h3><div class="images">\${(b.images||[]).map(src=>\`<img class="thumb" src="\${src}"/>\`).join('')}</div></div>
      <div class="chips">\${(b.ai.style_tags||[]).map(t=>\`<span class="chip">\${t}</span>\`).join('')}</div>
      <div style="margin-top:10px"><a href="/api/brief/\${b.id}.pdf" target="_blank"><button>Download PDF</button></a></div>
    \`;
  }
  load();
  document.getElementById('save').onclick = async ()=>{
    const r = await fetch('/api/brief/'+id+'/notes', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:notesEl.value})});
    if((await r.json()).ok) alert('Saved');
  };
</script>
</body></html>`;
  res.type('html').send(html);
});

// export PDF
app.get('/api/brief/:id.pdf', (req, res) => {
  const b = briefs.get(req.params.id);
  if (!b) return res.status(404).send('Not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="brief-${b.id}.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text('Luminous Beauty – Stylist Brief', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#667').text(`ID: ${b.id}  •  Created: ${b.createdAt}`);
  doc.moveDown();

  doc.fontSize(14).fillColor('#111').text('Mood & Summary');
  doc.fontSize(12).fillColor('#111').text(b.ai.mood || '');
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor('#333').text(b.ai.summary || '', { align: 'left' });
  doc.moveDown();

  const section = (title, arr) => {
    if (!arr?.length) return;
    doc.fontSize(13).fillColor('#111').text(title);
    arr.forEach((x) => doc.fontSize(10).fillColor('#333').text('• ' + x));
    doc.moveDown(0.5);
  };

  section('Hair', b.ai.hair);
  section('Makeup', b.ai.makeup);
  section('Nails', b.ai.nails);
  section('Outfit', b.ai.outfit);
  section('Talking Points', b.ai.talking_points);
  section('Care Tips', b.ai.care_tips);

  if (b.palette?.length) {
    doc.fontSize(13).fillColor('#111').text('Palette');
    const y = doc.y + 6;
    let x = doc.x;
    b.palette.forEach((c) => {
      doc.rect(x, y, 18, 18).fillColor(c).fill();
      doc.rect(x, y, 18, 18).strokeColor('#ccc').stroke();
      x += 24;
    });
    doc.moveDown(2);
  }

  if (b.stylistNotes) {
    doc.fontSize(13).fillColor('#111').text('Stylist Notes');
    doc.fontSize(10).fillColor('#333').text(b.stylistNotes);
  }

  doc.end();
});

// ---------- start ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Luminous listening on', PORT, { hasOpenAI: !!OPENAI_API_KEY });
});
