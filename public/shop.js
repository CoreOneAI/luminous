/* Luminous Beauty front-end logic
   - Mobile card UI intact (uses styles.css)
   - Ask AI independent of products (calls /ask)
   - Product grid reads /products.json (or /api/products if present)
*/

(() => {
  const $ = sel => document.querySelector(sel);

  const askInput = $('#askInput');
  const askBtn   = $('#askBtn');
  const chatlog  = $('#chatlog');

  const q     = $('#q');
  const cat   = $('#cat');
  const grid  = $('#grid');
  const empty = $('#empty');

  // Cache
  let PRODUCTS = [];
  let FILTERED = [];

  // --- Utilities -------------------------------------------------------------

  function formatCents(value) {
    // Accept integer cents OR dollar floats
    if (value == null || isNaN(value)) return '$—';
    let cents;
    if (Number.isInteger(value)) {
      if (value < 100 && value >= 0) cents = Math.round(value * 100);
      else cents = value;
    } else {
      cents = Math.round(Number(value) * 100);
    }
    return `$${(cents / 100).toFixed(2)}`;
  }

  function el(tagName, className, text) {
    const el = document.createElement(tagName);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function bustUrl(url) {
    const s = (url.includes('?') ? '&' : '?') + 'bust=' + Date.now();
    return url + s;
  }

  // --- Rendering -------------------------------------------------------------

  function productCard(p) {
    const card = el('div', 'cardx');
    // Image
    const imgwrap = el('div', 'imgwrap');
    if (p.image) {
      const img = new Image();
      img.alt = p.name || 'Product image';
      img.loading = 'lazy';
      img.src = p.image;
      imgwrap.appendChild(img);
    } else {
      imgwrap.textContent = '🧴';
      imgwrap.setAttribute('aria-label', 'Product');
    }
    card.appendChild(imgwrap);

    // Title & meta
    card.appendChild(el('div', 'title', p.name || 'Untitled'));
    const sub = el('div', 'muted',
      [p.brand, p.shade, p.size].filter(Boolean).join(' • ')
      || (p.brand || p.category || '')
    );
    card.appendChild(sub);

    // Price
    const priceRow = el('div', 'price');
    priceRow.appendChild(el('div', 'now', formatCents(p.price)));
    if (p.was != null) priceRow.appendChild(el('div', 'was', formatCents(p.was)));
    card.appendChild(priceRow);

    // Tags
    const tags = el('div', 'tags');
    ['category','brand','tone','finish']
      .filter(k => p[k])
      .forEach(k => { const t = el('span', 'tag', p[k]); tags.appendChild(t); });
    card.appendChild(tags);

    // Button
    const btn = el('button', 'addbtn', 'Add to bag');
    btn.addEventListener('click', () => {
      btn.textContent = 'Added ✓';
      btn.disabled = true;
      btn.style.opacity = 0.8;
      setTimeout(() => {
        btn.textContent = 'Add to bag';
        btn.disabled = false;
        btn.style.opacity = 1;
      }, 1200);
    });
    card.appendChild(btn);

    return card;
  }

  function renderProducts(list) {
    grid.innerHTML = '';
    if (!list || list.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(productCard(p)));
    grid.appendChild(frag);
  }

  function applyFilters() {
    const qv = (q.value || '').trim().toLowerCase();
    const cv = (cat.value || '').trim().toLowerCase();

    FILTERED = PRODUCTS.filter(p => {
      const hay = [
        p.name, p.brand, p.category, p.finish, p.tone, p.shade, p.description
      ].filter(Boolean).join(' ').toLowerCase();

      const catOk = !cv || (p.category || '').toLowerCase() === cv;
      const qOk   = !qv || hay.includes(qv);
      return catOk && qOk;
    });

    renderProducts(FILTERED);
  }

  // --- Data ------------------------------------------------------------------

  async function loadProducts() {
    try {
      const res = await fetch(bustUrl('/products.json'), { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load products.json');
      const json = await res.json();
      PRODUCTS = Array.isArray(json) ? json : (json.products || []);
      // Populate category filter
      const categories = Array.from(new Set(PRODUCTS.map(p => p.category).filter(Boolean))).sort();
      cat.innerHTML = '<option value="">All categories</option>' +
        categories.map(c => `<option>${c}</option>`).join('');
      applyFilters();
    } catch (err) {
      console.error('Failed to load products:', err);
      PRODUCTS = [];
      applyFilters();
    }
  }

  // --- Ask AI (independent) --------------------------------------------------

  function pushMsg(who, text) {
    const m = el('div', `msg ${who}`);
    m.textContent = text;
    chatlog.appendChild(m);
    chatlog.scrollTop = chatlog.scrollHeight;
  }

  async function handleAsk() {
    const text = (askInput.value || '').trim();
    if (!text) return;
    pushMsg('user', text);
    askInput.value = '';

    try {
      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = (data && data.reply) || 'Sorry — I could not find helpful suggestions.';
      pushMsg('bot', reply);
    } catch (err) {
      console.error('Ask failed:', err);
      pushMsg('bot', 'An error occurred while processing your request. Please try again.');
    }
  }

  // --- Events & Boot ---------------------------------------------------------

  function bind() {
    askBtn.addEventListener('click', handleAsk);
    askInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleAsk(); });
    q.addEventListener('input', applyFilters, { passive: true });
    cat.addEventListener('change', applyFilters, { passive: true });
  }

  function boot() {
    bind();
    loadProducts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
