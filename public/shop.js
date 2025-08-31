// shop.js — live products via same-origin API
const API_BASE = ''; // keep same-origin with server.js

function priceFmt(cents){ return (typeof cents==='number') ? `$${(cents/100).toFixed(0)}` : '$—'; }

async function fetchProducts({search='', category=''} = {}){
  let url = API_BASE + '/api/products';
  const qs = [];
  if (search)   qs.push('search=' + encodeURIComponent(search));
  if (category) qs.push('category=' + encodeURIComponent(category));
  if (qs.length) url += '?' + qs.join('&');
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('products_request_failed');
  const j = await r.json();
  return Array.isArray(j.items) ? j.items : [];
}

function addToCart(item){
  try{
    const cart = JSON.parse(localStorage.getItem('cart')||'[]');
    cart.push({ id:item.id||null, name:item.name, priceCents:item.priceCents||0, ts:Date.now() });
    localStorage.setItem('cart', JSON.stringify(cart));
    alert(`${item.name} added to cart`);
  }catch(e){ alert('Could not add to cart.'); }
}

function renderGrid(el, items){
  if (!items.length){
    el.innerHTML = '<div class="empty">No matching products.</div>';
    return;
  }
  el.innerHTML = items.map(p => {
    const img = p.image || 'https://images.unsplash.com/photo-1556229010-aa3f7ff66b2c?q=80&w=800&auto=format&fit=crop';
    const price = priceFmt(p.priceCents);
    const meta = `${(p.country||'').trim()} • ${p.category||''}`.replace(/^ • /,'');
    const safeName = String(p.name||'').replace(/"/g,'&quot;');
    return `<article class="card" data-title="${safeName}">
      <img class="img" src="${img}" alt="${safeName}">
      <div class="title">${safeName}</div>
      <div class="meta">${meta}</div>
      <div class="price">${price}</div>
      <button class="btn" onclick='addToCart(${JSON.stringify({"id":"__ID__", "name":"__NAME__", "priceCents":"__PRICE__"})}
        .replace("__ID__", String(p.id||""))
        .replace("__NAME__", safeName)
        .replace("__PRICE__", String(p.priceCents||0)))'>Add to Cart</button>
    </article>`;
  }).join('');
}

async function wireSearch({category=''} = {}){
  const input = document.getElementById('q');
  const grid  = document.getElementById('grid');
  async function refresh(){
    const items = await fetchProducts({ search: input.value.trim(), category });
    renderGrid(grid, items);
  }
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); refresh(); } });
  document.getElementById('searchBtn')?.addEventListener('click', refresh);
  await refresh();
}
