const API_BASE = 'http://localhost:4000/api';
import { initChatWidget } from './chat.js';

const els = {
  categories: document.getElementById('shopCategories'),
  grid: document.getElementById('shopGrid'),
  search: document.getElementById('shopSearch'),
  searchBtn: document.getElementById('shopSearchBtn'),
};

let state = { q: '', category_id: '', sort: '', page: 1, pageSize: 20 };

function cart_get() {
  try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch(_) { return []; }
}
function cart_set(items) {
  localStorage.setItem('cart', JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart:changed', { detail: { items } }));
}
function cart_add(product, qty=1) {
  const items = cart_get();
  const idx = items.findIndex(i => i.id === product.id);
  if (idx >= 0) items[idx].qty += qty; else items.push({ id: product.id, title: product.title, price: Number(product.price_per_unit), qty });
  cart_set(items);
}

function categoryItem(c) {
  const a = document.createElement('a');
  a.href = '#'; a.className = 'list-group-item list-group-item-action'; a.textContent = c.name;
  a.onclick = (e) => { e.preventDefault(); state.category_id = c.id; state.page = 1; loadProducts(true); };
  return a;
}

function productCard(p) {
  const col = document.createElement('div');
  col.className = 'col-6 col-md-4 col-lg-3';
  const img = (Array.isArray(p.images) ? p.images[0] : undefined) || '/placeholder.png';
  col.innerHTML = `
    <div class="card h-100">
      <img src="${img}" class="card-img-top" alt="${p.title}" onerror="this.src='https://via.placeholder.com/400x300?text=Product'">
      <div class="card-body d-flex flex-column">
        <h5 class="card-title">${p.title}</h5>
        <p class="small text-muted mb-2">$${Number(p.price_per_unit).toFixed(2)}</p>
        <div class="mt-auto d-grid gap-2">
          <button class="btn btn-outline-primary btn-sm" data-inquire>Inquiry</button>
          <button class="btn btn-primary btn-sm" data-add>Add to Cart</button>
        </div>
      </div>
    </div>`;
  const addBtn = col.querySelector('[data-add]');
  addBtn.addEventListener('click', () => cart_add(p, 1));
  const inquireBtn = col.querySelector('[data-inquire]');
  inquireBtn.addEventListener('click', async () => {
    try {
      // Use relative path to ensure dynamic import resolves like static import
      const mod = await import('./chat.js');
      await mod.openProductChat(p.id, 'Hello, I have a question about this product.');
    } catch (e) {
      // Fallback to simple inquiry modal if chat module fails to load
      openInquiry(p);
    }
  });
  return col;
}

async function fetchJSON(url) { const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }

async function loadCategories() {
  const { data } = await fetchJSON(`${API_BASE}/categories`);
  els.categories.innerHTML = '';
  data.forEach(c => els.categories.appendChild(categoryItem(c)));
}

function normalizeImages(p) { try { if (typeof p.images === 'string') p.images = JSON.parse(p.images); } catch(_) { p.images = []; } return p; }

async function loadProducts(reset=false) {
  if (reset) els.grid.innerHTML = '';
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category_id) params.set('category_id', state.category_id);
  params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  if (state.sort) params.set('sort', state.sort);
  const { data } = await fetchJSON(`${API_BASE}/products?${params.toString()}`);
  data.map(normalizeImages).forEach(p => els.grid.appendChild(productCard(p)));
}

function token(){ return localStorage.getItem('token'); }
function authHeaders(){ const t = token(); return t ? { 'Authorization': 'Bearer '+t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; }

function wire() {
  els.searchBtn.addEventListener('click', () => { state.q = els.search.value.trim(); state.page = 1; loadProducts(true); });
  const sortSel = document.getElementById('shopSort');
  sortSel?.addEventListener('change', ()=>{ state.sort = sortSel.value; state.page = 1; loadProducts(true); });
}

// Inquiry modal (frontend only; backend endpoint optional next)
let currentProduct = null;
function openInquiry(p) {
  currentProduct = p;
  document.getElementById('inqTitle').textContent = p.title;
  const modal = new bootstrap.Modal(document.getElementById('inquiryModal'));
  modal.show();
  document.getElementById('sendInquiryBtn').onclick = async () => {
    try {
      // If not signed in, inform the user immediately
      if (!token()) { alert('Please sign in to send an inquiry.'); return; }
      const res = await fetch(`${API_BASE}/products/${currentProduct.id}/inquiry`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: document.getElementById('inqMessage').value })
      });
      if (!res.ok) {
        const text = await res.text().catch(()=> '');
        if (res.status === 401 || res.status === 403) {
          alert('Please sign in to send an inquiry.');
        } else {
          alert(text || 'Failed to send inquiry. Please try again.');
        }
        return;
      }
      alert('Your inquiry has been sent.');
      modal.hide();
    } catch(e) {
      alert('Failed to send inquiry. Please check your connection and try again.');
    }
  };
}

function renderCartBadge(){
  const el = document.getElementById('shopCartCount'); if (!el) return;
  let count = 0; try { const cart = cart_get(); count = cart.reduce((a,i)=>a+Number(i.qty||1),0); } catch(_){ }
  el.textContent = String(count);
}

(async function init(){
  (async ()=>{
    await loadCategories();
    await loadProducts(true);
    wire();
    renderCartBadge();
    window.addEventListener('cart:changed', ()=>renderCartBadge());
    try { initChatWidget(); } catch(_){}
  })();
})();
