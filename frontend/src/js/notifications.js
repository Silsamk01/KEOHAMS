const API_BASE = 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('token'); }
function authHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }
async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

let page = 1; const pageSize = 10; let total = 0; let loaded = 0;

async function load() {
  const { data, total: t } = await fetchJSON(`${API_BASE}/notifications/mine?page=${page}&pageSize=${pageSize}`);
  total = t; loaded += data.length;
  document.getElementById('notifMeta').textContent = `${loaded} of ${total}`;
  const list = document.getElementById('notifList');
  for (const n of data) {
    const item = document.createElement('div');
    item.className = 'p-3 bg-white border rounded-3';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">${escapeHtml(n.title)}</div>
          <div class="text-muted small">${new Date(n.created_at).toLocaleString()}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          ${n.url ? `<a href="${n.url}" class="btn btn-sm btn-primary" target="_blank">Open</a>` : ''}
          <button class="btn btn-sm btn-outline-secondary" data-read data-id="${n.id}">Mark read</button>
        </div>
      </div>
      <div class="mt-2">${escapeHtml(n.body)}</div>
    `;
    list.appendChild(item);
  }
  if (loaded >= total) document.getElementById('loadMore').classList.add('d-none');
  wireRowActions();
}

function wireRowActions(){
  document.querySelectorAll('[data-read]').forEach(btn => {
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-id');
      try { await fetchJSON(`${API_BASE}/notifications/${id}/read`, { method:'POST', body: JSON.stringify({}) }); btn.closest('.p-3')?.classList.add('opacity-75'); }
      catch(e){ alert(e.message || 'Failed'); }
    });
  });
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function renderCartBadge(){
  const el = document.getElementById('navCartCount'); if (!el) return;
  let count = 0; try { const cart = JSON.parse(localStorage.getItem('cart')||'[]'); count = cart.reduce((a,i)=>a+Number(i.qty||1),0); } catch(_){ }
  el.textContent = String(count);
}

(function init(){
  renderCartBadge();
  document.getElementById('loadMore').addEventListener('click', ()=>{ page+=1; load(); });
  document.getElementById('markAll')?.addEventListener('click', async ()=>{
    try { await fetchJSON(`${API_BASE}/notifications/mark-all-read`, { method:'POST', body: JSON.stringify({}) }); alert('All marked as read'); } catch(e){ alert(e.message||'Failed'); }
  });
  load();
})();
