// chat.js — conversational advisor with product cards
const API_BASE = ''; // same-origin
const chat = document.getElementById('chat');
const input = document.getElementById('q');
const sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

function addMsg(text, who='bot'){
  const div = document.createElement('div');
  div.className = 'msg ' + (who==='me'?'me':'bot');
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function addCards(products){
  const wrap = document.createElement('div'); wrap.className='cards';
  products.forEach(p=>{
    const card = document.createElement('div'); card.className='pcard';
    card.innerHTML = `
      <img src="${p.imageUrl||''}" alt="${p.name}">
      <div class="t">${p.name}</div>
      <div class="m">${(p.country||'').trim()} • ${p.category||''}</div>
      <div class="p">${p.price||'$25'}</div>
      <button class="btn" onclick="addToCart('${(p.name||'').replace(/'/g, "\\'")}')">Add</button>
    `;
    wrap.appendChild(card);
  });
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}
function addToCart(name){
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  cart.push({name, ts: Date.now()});
  localStorage.setItem('cart', JSON.stringify(cart));
  alert(`${name} added to cart`);
}

async function send(){
  const text = (input.value||'').trim();
  if (!text) return;
  addMsg(text,'me');
  input.value='';
  try{
    const r = await fetch(`${API_BASE}/api/chat`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: text, includeProducts: true, sessionId })
    });
    const j = await r.json();
    if (j.response) addMsg(j.response,'bot');
    if (Array.isArray(j.products) && j.products.length) addCards(j.products.slice(0,6));
  }catch(e){
    addMsg('Connection issue. Try again shortly.','bot');
  }
}

// greet
addMsg('Hi! I can help with acne, color care, frizz, and more. What are you targeting today?');
