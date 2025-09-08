/* Luminous Beauty Shop
   - tolerant loader for products.json schemas
   - robust currency helper (formatCents)
   - search/“ask” in one box
   - graceful empty state + error status
*/

(() => {
  // --------- utilities ---------
  function normalizePriceToCents(product) {
    // Accept many shapes: price_cents | priceCents | price (number or "$12.34")
    const rawCents = product.price_cents ?? product.priceCents ?? product.cents;
    if (Number.isFinite(rawCents)) return Math.round(Number(rawCents));

    const raw = product.price ?? product.unit_price ?? product.amount;
    if (raw == null) return 0;

    if (typeof raw === "number" && Number.isFinite(raw)) {
      // assume dollars
      return Math.round(raw * 100);
    }
    // "$12.34", "12.34", "12"
    const m = String(raw).replace(/[^\d.]/g, "");
    const n = Number(m);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  function formatCents(value, currency = "USD", locale = undefined) {
    const n = Number(value);
    if (!isFinite(n)) return (0).toLocaleString(locale, { style: "currency", currency });
    const dollars = Number.isInteger(n) ? n / 100 : n;
    return dollars.toLocaleString(locale, { style: "currency", currency });
  }

  function firstDefined(...vals) {
    for (const v of vals) if (v != null && v !== "") return v;
    return undefined;
  }

  function getImage(product) {
    if (product.image) return product.image;
    if (Array.isArray(product.images) && product.images.length) return product.images[0];
    if (product.photo) return product.photo;
    return null;
  }

  function getName(product) {
    return firstDefined(product.name, product.title, product.product, product.sku, "Untitled");
  }

  function getDescription(product) {
    return firstDefined(product.description, product.shortDescription, product.subtitle, "");
  }

  function getBrand(product) {
    return firstDefined(product.brand, product.vendor, product.maker, "");
  }

  function getTags(product) {
    if (Array.isArray(product.tags)) return product.tags;
    if (typeof product.tags === "string") return product.tags.split(/[,|]/).map(s => s.trim()).filter(Boolean);
    const bucket = [];
    if (product.category) bucket.push(product.category);
    if (product.type) bucket.push(product.type);
    if (getBrand(product)) bucket.push(getBrand(product));
    return bucket;
  }

  // --------- state ---------
  let ALL = [];
  const els = {
    q:    document.getElementById("q"),
    ask:  document.getElementById("askBtn"),
    clr:  document.getElementById("clearBtn"),
    grid: document.getElementById("grid"),
    empty:document.getElementById("empty"),
    status:document.getElementById("status"),
  };

  // --------- data load ---------
  async function loadProducts() {
    setStatus("Loading catalog…");
    try {
      const r = await fetch("/products.json", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();

      const arr = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
      ALL = arr.map((p, i) => ({
        __raw: p,
        id: p.id ?? p.sku ?? p.handle ?? `prod_${i}`,
        name: getName(p),
        description: getDescription(p),
        brand: getBrand(p),
        tags: getTags(p),
        image: getImage(p),
        price_cents: normalizePriceToCents(p),
        url: p.url ?? p.href ?? null,
        rating: p.rating ?? p.stars ?? null
      }));

      renderProducts(ALL);
      setStatus(`${ALL.length} products loaded`);
    } catch (err) {
      console.error("Product load failed:", err);
      setStatus("Error loading products. Please try again.");
      ALL = [];
      renderProducts([]);
    }
  }

  // --------- rendering ---------
  function setStatus(text) {
    if (!els.status) return;
    els.status.textContent = text || "";
  }

  function renderProducts(list) {
    const grid = els.grid;
    const empty = els.empty;
    grid.innerHTML = "";

    if (!list || list.length === 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const frag = document.createDocumentFragment();
    for (const p of list) frag.appendChild(card(p));
    grid.appendChild(frag);
  }

  function card(p) {
    const div = document.createElement("div");
    div.className = "card";
    div.setAttribute("role", "listitem");

    const price = formatCents(p.price_cents || 0);
    const tags = (p.tags || []).slice(0, 3);

    div.innerHTML = `
      <div class="thumb">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />`
                  : `<span aria-hidden="true">🧴</span>`}
      </div>
      <div class="pad">
        <div class="title">${escapeHtml(p.name)}</div>
        <div class="desc">${escapeHtml(p.description || "")}</div>
        <div class="meta">
          <div class="price">${price}</div>
          <div>${p.brand ? `<span class="tag">${escapeHtml(p.brand)}</span>` : ""}</div>
        </div>
        <div style="margin-top:8px">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</div>
        <div style="margin-top:10px;display:flex;gap:8px">
          ${p.url ? `<a class="secondary" style="text-decoration:none;padding:8px 10px;border-radius:8px;border:1px solid #ddd" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">View</a>` : ""}
          <button class="addBtn" data-id="${escapeAttr(p.id)}">Add to cart</button>
        </div>
      </div>
    `;

    // simple add-to-cart demo
    div.querySelector(".addBtn")?.addEventListener("click", () => {
      alert(`Added “${p.name}” to cart (demo)`);
    });

    // image fallback
    const img = div.querySelector("img");
    if (img) img.addEventListener("error", () => { img.remove(); });

    return div;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

  // --------- search / ask ---------
  function filterProducts(query) {
    if (!query) return ALL;

    const q = query.toLowerCase();

    // price filters like "under $25" or "< 25"
    let maxCents = null;
    const priceMatch = q.match(/(?:under|less than|<)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      maxCents = Math.round(parseFloat(priceMatch[1]) * 100);
    }

    const tokens = q
      .replace(/under\s*\$?\s*\d+(?:\.\d+)?/g, " ")
      .replace(/less than\s*\$?\s*\d+(?:\.\d+)?/g, " ")
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);

    return ALL.filter(p => {
      const hay = [
        p.name, p.description, p.brand,
        ...(Array.isArray(p.tags) ? p.tags : [])
      ].join(" ").toLowerCase();

      const textMatch = tokens.every(t => hay.includes(t));
      if (!textMatch) return false;

      if (maxCents != null) {
        return (p.price_cents || 0) <= maxCents;
      }
      return true;
    });
  }

  async function handleAsk() {
    const q = (els.q?.value || "").trim();
    const list = filterProducts(q);
    renderProducts(list);
    setStatus(list.length ? `Showing ${list.length} result(s)` : "No matches for your query");
  }

  function bind() {
    els.ask?.addEventListener("click", handleAsk);
    els.q?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAsk();
    });
    els.clr?.addEventListener("click", () => {
      els.q.value = "";
      renderProducts(ALL);
      setStatus(`${ALL.length} products loaded`);
    });
  }

  // --------- boot ---------
  document.addEventListener("DOMContentLoaded", async () => {
    bind();
    await loadProducts();
  });
})();
