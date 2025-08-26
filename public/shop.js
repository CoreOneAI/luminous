// public/shop.js
const API_BASE = ''; // same host (works locally + Render)

async function askChat(text){
  const r = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ message: text })
  });
  const j = await r.json();
  if (!j.success) throw new Error('chat failed');
  return j.response;
}

async function loadProducts(q=''){
  const url = q ? `${API_BASE}/api/products?search=${encodeURIComponent(q)}` : `${API_BASE}/api/products`;
  const r = await fetch(url); const j = await r.json();
  return j.items || [];
}

async function findImages(q){
  const r = await fetch(`${API_BASE}/api/images?q=${encodeURIComponent(q)}`);
  return (await r.json()).images || [];
}
