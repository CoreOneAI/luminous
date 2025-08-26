// shop.js — same-origin API & live grid rendering
const API_BASE = ''; // same host (works locally + Render)

function $(sel, el=document){ return el.querySelector(sel); }

function priceFmt(cents){ return `$${Math.round((cents||0)/100)}`; }

async function fetchProducts({search='', category=''} = {}){
  let url = '/api/products';
  const params = [];
  if (search) params.push('search='+encodeURIComponent(search));
  if (category) params.push('category='+encodeURIComponent(category));
  if (params.length) url += '?' + params.join('&');
  const r = await fetch(url);
  const j = await r.json();
  return j.items || [];
}

function renderGrid(el, items){
  el.innerHTML = items.map(p => `
    <article class="card" data-title="${p.name}">
      <img class="img" src="${p.image||''}" alt="${p.name}">
      <div class="title">${p.name}</div>
      <div class="meta">${(p.country||'').trim()} • ${p.category||''}</div>
      <div class="price">${p.priceCents!=null?priceFmt(p.priceCents):'$25'}</div>
      <button class="btn" onclick="addToCart('${(p.name||'').replace(/'/g, "\\'")}')">Add to Cart</button>
    </article>
  `).join('');
}

function filterCards(q){
  const t=(q||'').trim().toLowerCase();
  document.querySelectorAll('[data-title]').forEach(el=>{
    const hit=el.getAttribute('data-title').toLowerCase().includes(t);
    el.style.display = t? (hit?'':'none'):'';
  });
}

function addToCart(name){
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  cart.push({name, ts: Date.now()});
  localStorage.setItem('cart', JSON.stringify(cart));
  alert(`${name} added to cart`);
}
