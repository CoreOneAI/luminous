// shop.js (unused in index.html inline version; provided for future externalization)
const API_BASE = ''; // same origin avoids CORS & hostname drift;
function filterCards(q){
  const t=(q||'').trim().toLowerCase();
  document.querySelectorAll('[data-title]').forEach(el=>{
    const hit=el.getAttribute('data-title').toLowerCase().includes(t);
    el.style.display = t? (hit?'':'none'):'';
  });
}
function addToCart(name){ alert(`${name} added to cart`); }
