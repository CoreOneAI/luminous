(function(){
  const API_BASE = '';
  let catalog = null;
  let cart = JSON.parse(localStorage.getItem('luminous_cart')||'[]');

  const $ = (sel, root=document) => root.querySelector(sel);
  const fmt = c => '$' + (Number(c||0)/100).toFixed(2);
  const imgFor = (p) => p.image || 'https://images.unsplash.com/photo-1556228453-efd1f4a7fae9?auto=format&fit=crop&w=800&q=60';

  function saveCart(){ localStorage.setItem('luminous_cart', JSON.stringify(cart)); updateCartBadge(); }
  function updateCartBadge(){
    const cnt = cart.reduce((n,it)=>n+it.qty,0);
    const el = $('#cartCount');
    if (!el) return;
    if (cnt>0){ el.style.display='inline-flex'; el.textContent = String(cnt); } else { el.style.display='none'; }
  }
  function openDrawer(){ $('#drawer').classList.add('open'); renderCart(); }
  function closeDrawer(){ $('#drawer').classList.remove('open'); }
  function renderCart(){
    const wrap = $('#cartItems'); if (!wrap) return;
    wrap.innerHTML='';
    let total = 0;
    cart.forEach((it)=>{
      total += (it.price||0)*(it.qty||1);
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <img src="${imgFor(it)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #eee"/>
        <div style="flex:1">
          <div class="name">${it.name}</div>
          <div class="qty">Qty: ${it.qty}</div>
        </div>
        <div class="price">${fmt(it.price)}</div>`;
      wrap.appendChild(row);
    });
    const tot = $('#cartTotal'); if (tot) tot.textContent = fmt(total);
  }
  function addToCart(p){
    const ex = cart.find(x => x.id===p.id);
    if (ex) ex.qty += 1; else cart.push({ id:p.id, name:p.name, price:p.price, image:p.image, category:p.category, qty:1 });
    saveCart();
  }
  function renderGrid(container, items){
    const wrap = typeof container==='string' ? $(container) : container;
    if (!wrap) return;
    wrap.innerHTML='';
    if (!items || !items.length){
      const empty = document.createElement('div');
      empty.className='empty';
      empty.textContent = 'No matching products yet — try a different term (e.g., brand, concern, or category).';
      wrap.appendChild(empty);
      return;
    }
    items.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${imgFor(p)}" alt=""/>
        <div class="meta">
          <div class="name">${p.name}</div>
          <div class="brand">${p.brand || p.category || ''}</div>
          <div class="row">
            <div class="price">${fmt(p.price)}</div>
            <button class="btn">Add</button>
          </div>
        </div>`;
      card.querySelector('.btn').addEventListener('click', ()=> addToCart(p));
      wrap.appendChild(card);
    });
  }

  const SYN = {
    antiaging: ['anti aging','anti-aging','antiaging','wrinkle','fine line','retinol','peptide','collagen','firm','lift','vitamin c','brighten','dark spot','hyperpigment','spf','sunscreen','night cream','serum','eye'],
    hydration: ['hydrate','hydration','hyaluronic','ceramide','moistur','barrier','dehydrated','dry skin','cream'],
    colorcare: ['color','highlight','balayage','brassy','tone','gloss','purple shampoo','bond','repair','mask'],
    nails: ['nail','gel','acrylic','cuticle','polish'],
    hair: ['heat protect','frizz','split ends','breakage','dry hair','mask','shampoo','conditioner','oil'],
    kbeauty: ['essence','ampoule','snail','cica','centella','bb cream','k-beauty','kbeauty','korean']
  };
  function anyMatch(text, list){ text = text.toLowerCase(); return list.some(k => text.includes(k)); }

  function filterByMode(items, mode){
    const full = items || [];
    switch(mode){
      case 'catalog': return full;
      case 'antiaging':
        return full.filter(p => anyMatch(((p.name||'') + ' ' + (p.category||'') + ' ' + (p.brand||'')), SYN.antiaging) || /retinol|peptide|collagen|vitamin c|anti[- ]?aging|wrinkle|firm|spf|sunscreen/i.test((p.name||'') + ' ' + (p.category||'')));
      case 'kbeauty':
        return full.filter(p => anyMatch(((p.name||'') + ' ' + (p.category||'') + ' ' + (p.brand||'')), SYN.kbeauty));
      case 'nailcare':
        return full.filter(p => anyMatch(((p.name||'') + ' ' + (p.category||'') + ' ' + (p.brand||'')), SYN.nails));
      case 'accessories':
        return full.filter(p => /(tool|brush|dryer|iron|clip|mirror|kit|accessor|comb|tweezer|roller|gua sha)/i.test((p.name||'') + ' ' + (p.category||'')));
      default: return full;
    }
  }

  async function getCatalog(){
    if (catalog) return catalog;
    try{
      const r = await fetch(`${API_BASE}/api/products`);
      const j = await r.json();
      catalog = j.items || [];
    }catch(e){ catalog = []; }
    return catalog;
  }

  async function initCatalogPage(config){
    updateCartBadge();
    const cartBtn = $('#cartBtn'); if (cartBtn) cartBtn.addEventListener('click', ()=>{
      const d=$('#drawer'); d.classList.contains('open')?closeDrawer():openDrawer();
    });

    const all = await getCatalog();
    const initial = filterByMode(all, (config && config.mode) || 'catalog');
    renderGrid('#grid', initial.slice(0, 20));

    const searchInput = $('#searchInput');
    const searchBtn   = $('#searchBtn');
    if (searchBtn){
      searchBtn.addEventListener('click', ()=>{
        const q = (searchInput && searchInput.value || '').toLowerCase().trim();
        const found = all.filter(p => (p.name||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q));
        renderGrid('#grid', found.slice(0, 40));
      });
    }
    if (searchInput){
      searchInput.addEventListener('keydown', (e)=>{
        if (e.key==='Enter'){ searchBtn && searchBtn.click(); }
      });
    }

    document.querySelectorAll('.pill').forEach(p => p.addEventListener('click', ()=>{
      const cat = (p.dataset.cat || '').toLowerCase();
      const found = all.filter(it => ((it.category||'') + ' ' + (it.name||'') + ' ' + (it.brand||'')).toLowerCase().includes(cat));
      renderGrid('#grid', found.slice(0, 40));
    }));
  }

  window.initCatalogPage = initCatalogPage;
})();