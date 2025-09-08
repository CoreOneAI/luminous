<!-- Make sure this file is saved as public/shop.js and referenced by your index.html -->
<script>
(() => {
  /* =========================
     Luminous Beauty – Shop UI
     - Loads catalog (/products.json)
     - Client-side search & filters
     - “Ask AI” (POST /ask) – independent of catalog
     - Moodboard palette extraction (client-side Canvas)
     ========================= */

  // ---- DOM hooks (defensive: only bind if present) ----
  const $$ = (sel) => document.querySelector(sel);
  const grid         = $$('#product-grid');         // cards go here
  const searchInput  = $$('#search-input');         // text input
  const askInput     = $$('#ask-input');            // chat input
  const askBtn       = $$('#ask-submit');           // chat send button
  const askOut       = $$('#ask-output');           // chat output container
  const moodUpload   = $$('#mood-upload');          // <input type=file> for moodboard
  const paletteWrap  = $$('#palette');              // palette swatches container
  const statusBar    = $$('#status');               // optional status text

  // ---- State ----
  let CATALOG = [];       // full dataset
  let FILTERED = [];      // current view

  // ---- Utils ----
  function formatCents(value) {
    // Handles dollars or cents, strings or numbers.
    if (value == null || value === '') return '$0.00';
    const n = Number(value);
    if (Number.isNaN(n)) return '$0.00';
    // Assume cents if a large integer, else treat as dollars
    const dollars = (n >= 1000 && Number.isInteger(n)) ? n / 100 : n;
    return `$${dollars.toFixed(2)}`;
  }

  function escapeHTML(s) {
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function setStatus(text) {
    if (!statusBar) return;
    statusBar.textContent = text || '';
  }

  // ---- Catalog loader ----
  async function loadCatalog() {
    try {
      setStatus('Loading products…');
      const bust = Date.now();
      const r = await fetch(`/products.json?bust=${bust}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      CATALOG = await r.json();
      FILTERED = [...CATALOG];
      renderProducts(FILTERED);
      setStatus(`Loaded ${CATALOG.length} products`);
    } catch (err) {
      console.error('Catalog load failed:', err);
      setStatus('Failed to load products');
      if (grid) grid.innerHTML = `
        <div class="empty">
          <div class="empty-title">No products found</div>
          <div class="empty-sub">Try reloading or check /products.json</div>
        </div>`;
    }
  }

  // ---- Product card ----
  function card(p) {
    const img = p.image || p.img || 'images/placeholder.jpg';
    return `
    <article class="card" data-id="${escapeHTML(p.id)}">
      <div class="card-media">
        <img src="${escapeHTML(img)}" alt="${escapeHTML(p.name)}" loading="lazy" />
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHTML(p.name)}</h3>
        <div class="card-meta">
          <span class="brand">${escapeHTML(p.brand || '')}</span>
          ${p.rating ? `<span class="rating">⭐ ${escapeHTML(p.rating)}</span>` : ''}
        </div>
        <div class="price-row">
          <span class="price">${formatCents(p.price)}</span>
          ${p.was ? `<span class="was">${formatCents(p.was)}</span>` : ''}
        </div>
        <p class="desc">${escapeHTML(p.description || '')}</p>
        <div class="card-actions">
          <button class="btn add-to-cart" data-id="${escapeHTML(p.id)}">Add to Bag</button>
          <button class="btn outline view-details" data-id="${escapeHTML(p.id)}">Details</button>
        </div>
      </div>
    </article>`;
  }

  function renderProducts(list) {
    if (!grid) return;
    if (!Array.isArray(list) || list.length === 0) {
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-title">No products found</div>
          <div class="empty-sub">Try a different search or be more specific.</div>
        </div>`;
      return;
    }
    grid.innerHTML = list.map(card).join('');
  }

  // ---- Search / filter ----
  function applySearch(q) {
    const needle = (q || '').trim().toLowerCase();
    if (!needle) {
      FILTERED = [...CATALOG];
    } else {
      FILTERED = CATALOG.filter(p => {
        const hay = [
          p.name, p.brand, p.category, p.description, p.tone, p.undertone, p.type, p.tags?.join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(needle);
      });
    }
    renderProducts(FILTERED);
  }

  // ---- Ask AI (independent of catalog) ----
  async function askAI(message) {
    if (!askOut) return;
    const q = String(message || '').trim();
    if (!q) return;
    // Show user bubble
    appendMsg('user', q);

    try {
      appendMsg('bot', 'Thinking…');
      const r = await fetch('/ask', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ message: q })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      // Replace last "Thinking…" bubble with reply
      replaceLastBot(data.reply || 'I could not find an answer right now.');

      // Optional: naive follow-up – try to surface related products locally
      const hints = extractKeywords(q);
      if (hints.length && CATALOG.length) {
        const recs = CATALOG.filter(p => {
          const hay = [p.name, p.brand, p.category, p.description, p.tags?.join(' ')].filter(Boolean).join(' ').toLowerCase();
          return hints.some(k => hay.includes(k));
        }).slice(0, 6);
        if (recs.length) {
          appendMsg('bot', 'You might also like these (based on your question):');
          appendProductStrip(recs);
        }
      }
    } catch (err) {
      console.error('Ask AI failed:', err);
      replaceLastBot('Sorry—AI is temporarily unavailable. Please try again.');
    }
  }

  function extractKeywords(text) {
    // Tiny keyword pick: skin, tone words, hair style words, etc.
    const base = String(text || '').toLowerCase();
    const vocab = [
      'pale','fair','light','medium','tan','deep','dark',
      'cool','warm','neutral','olive',
      'dry','oily','combination','sensitive',
      'matte','dewy','natural','full coverage',
      'lip','blush','foundation','concealer','bronzer','highlighter','mascara','eyeliner','brow',
      'curly','wavy','straight','pixie','bob','balayage','foil','blonde','brunette','red','black'
    ];
    return vocab.filter(w => base.includes(w));
  }

  // ---- Chat UI helpers ----
  function appendMsg(role, text) {
    if (!askOut) return;
    const bubble = document.createElement('div');
    bubble.className = `msg ${role}`;
    bubble.innerHTML = `<div class="msg-inner">${escapeHTML(text)}</div>`;
    askOut.appendChild(bubble);
    askOut.scrollTop = askOut.scrollHeight;
  }

  function replaceLastBot(text) {
    if (!askOut) return;
    const bots = askOut.querySelectorAll('.msg.bot');
    const last = bots[bots.length - 1];
    if (last) last.querySelector('.msg-inner').textContent = text;
    askOut.scrollTop = askOut.scrollHeight;
  }

  function appendProductStrip(items) {
    const wrap = document.createElement('div');
    wrap.className = 'product-strip';
    wrap.innerHTML = items.map(p => `
      <div class="strip-item">
        <img src="${escapeHTML(p.image || 'images/placeholder.jpg')}" alt="${escapeHTML(p.name)}" loading="lazy"/>
        <div class="si-title">${escapeHTML(p.name)}</div>
        <div class="si-price">${formatCents(p.price)}</div>
      </div>
    `).join('');
    askOut.appendChild(wrap);
    askOut.scrollTop = askOut.scrollHeight;
  }

  // ---- Moodboard: client-side palette extraction ----
  async function extractPaletteFromFile(file, maxColors = 5) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      const w = 200; const h = Math.max(50, Math.round((img.height / img.width) * w) || 200);
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      // coarse quantization
      const bucket = (v) => (v >> 4) << 4; // steps of 16
      const freq = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]; if (a < 200) continue;
        const r = bucket(data[i]), g = bucket(data[i + 1]), b = bucket(data[i + 2]);
        const key = `${r},${g},${b}`;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
      const top = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, maxColors).map(([k]) => {
        const [r,g,b] = k.split(',').map(Number);
        return `rgb(${r}, ${g}, ${b})`;
      });
      return top;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function renderPalette(colors) {
    if (!paletteWrap) return;
    if (!colors || !colors.length) {
      paletteWrap.innerHTML = '';
      return;
    }
    paletteWrap.innerHTML = colors.map(c => `
      <div class="swatch" title="${escapeHTML(c)}" style="background:${c}"></div>
    `).join('');
  }

  // ---- Event bindings ----
  function bind() {
    if (searchInput) {
      searchInput.addEventListener('input', (e) => applySearch(e.target.value), { passive: true });
    }
    if (askBtn && askInput) {
      askBtn.addEventListener('click', () => askAI(askInput.value));
      askInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') askAI(askInput.value);
      });
    }
    if (moodUpload) {
      moodUpload.addEventListener('change', async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setStatus('Analyzing palette…');
        try {
          const colors = await extractPaletteFromFile(f, 5);
          renderPalette(colors);
          setStatus('Palette ready');
        } catch (err) {
          console.error('Palette error:', err);
          setStatus('Could not extract palette');
        }
      });
    }

    // Delegate card buttons
    if (grid) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (btn.classList.contains('add-to-cart')) {
          // Stub: add to cart behavior
          setStatus(`Added to bag: ${id}`);
        } else if (btn.classList.contains('view-details')) {
          const p = CATALOG.find(x => String(x.id) === String(id));
          if (p) showDetails(p);
        }
      });
    }
  }

  function showDetails(p) {
    alert(`${p.name}\n\n${p.description || 'No description.'}\n\nPrice: ${formatCents(p.price)}`);
  }

  // ---- Boot ----
  async function boot() {
    bind();
    await loadCatalog();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
