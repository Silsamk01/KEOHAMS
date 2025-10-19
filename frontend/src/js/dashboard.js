import { initChatWidget } from './chat.js';
import { fetchMyThreads, openExistingThread } from './chat.js';
import { initQuotationsUI } from './quotations.js';

const API_BASE = 'http://localhost:4000/api';

// Ensure unread notification refresh when marking notifications read
async function fetchNotifUnread(){
  try {
    const { count } = await fetchJSON(`${API_BASE}/notifications/unread-count`);
    document.querySelectorAll('[data-unread-badge]').forEach(b=>{
      if(count>0){ b.textContent = count; b.classList.remove('d-none'); }
      else { b.classList.add('d-none'); }
    });
  } catch(_) { /* silent */ }
}

// ===== Profile (Embedded Settings) =====
function computeAge(dob){
  if(!dob) return null; const parts = dob.split('-'); if(parts.length!==3) return null; const [y,m,d]=parts.map(Number); const birth=new Date(Date.UTC(y,(m||1)-1,d||1)); if(isNaN(birth)) return null; const now=new Date(); let age= now.getUTCFullYear()-birth.getUTCFullYear(); const md= now.getUTCMonth()-birth.getUTCMonth(); if(md<0 || (md===0 && now.getUTCDate()<birth.getUTCDate())) age--; return age<0?null:age; }
let settingsLoaded = false;
async function loadEmbeddedProfile(){
  try {
    const p = await fetchJSON(`${API_BASE}/user/profile`);
    const nameEl = document.getElementById('dPfNameText'); if(nameEl) nameEl.textContent = p.name || '—';
    const phoneInput = document.getElementById('dPfPhoneInput'); if(phoneInput) phoneInput.value = p.phone || '';
    const ageEl = document.getElementById('dPfAgeText'); if(ageEl){ const age = computeAge(p.dob); ageEl.textContent = age!=null? String(age):'—'; }
    // avatar on settings pane
    if (p.avatar_url) { const av = document.getElementById('dPfAvatar'); if(av) av.src = p.avatar_url; const headerAv = document.getElementById('dashAvatar'); if(headerAv) headerAv.src = p.avatar_url; }
  } catch(e){ console.warn('Embedded profile load failed', e); }
}

function wireEmbeddedAvatar(){
  const input = document.getElementById('dPfAvatarInput'); if(!input) return;
  const status = document.getElementById('dPfAvatarStatus');
  input.addEventListener('change', async ()=>{
    if(!input.files||!input.files[0]) return; const file = input.files[0];
    if(file.size > 3*1024*1024){ if(status) status.textContent='File too large (max 3MB)'; return; }
    if(status) status.textContent='Uploading...';
    try {
      const fd = new FormData(); fd.append('avatar', file);
      const res = await fetch(`${API_BASE}/user/profile/avatar`, { method:'POST', headers:{ ...authHeaders() }, body: fd });
      if(!res.ok) throw new Error(await res.text());
      const j = await res.json();
      const av = document.getElementById('dPfAvatar'); if(av && j.avatar_url) av.src = j.avatar_url + '?v=' + Date.now();
      const headerAv = document.getElementById('dashAvatar'); if(headerAv && j.avatar_url) headerAv.src = j.avatar_url + '?v=' + Date.now();
      if(status) status.textContent='Updated'; setTimeout(()=>{ if(status) status.textContent=''; },2000);
    } catch(err){ if(status) status.textContent = err.message || 'Upload failed'; }
  });
}

function wireEmbeddedPhoneSave(){
  const btn = document.getElementById('dPfSaveBtn'); if(!btn) return; const input = document.getElementById('dPfPhoneInput'); const status = document.getElementById('dPfSaveStatus');
  btn.addEventListener('click', async ()=>{
    if(!input) return; const phone = input.value.trim(); if(status) status.textContent='Saving...';
    try { await fetch(`${API_BASE}/user/profile`, { method:'PATCH', headers:{ 'Content-Type':'application/json', ...authHeaders() }, body: JSON.stringify({ phone }) }); if(status) status.textContent='Saved'; setTimeout(()=>{ if(status) status.textContent=''; },1500); }
    catch(e){ if(status) status.textContent = e.message || 'Failed'; }
  });
}

function ensureSettingsInitialized(){
  if (settingsLoaded) return; settingsLoaded = true;
  loadEmbeddedProfile();
  wireEmbeddedAvatar();
  wireEmbeddedPhoneSave();
}

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

function switchPane(id) {
  document.querySelectorAll('.pane').forEach(p => p.classList.add('d-none'));
  document.querySelector(id)?.classList.remove('d-none');
  // Sync active state on both legacy (data-target) and unified sidebar (data-path + data-pane)
  document.querySelectorAll('#dashNav .nav-link').forEach(a => a.classList.remove('active'));
  document.querySelector(`#dashNav .nav-link[data-target="${id}"]`)?.classList.add('active');
  try {
    const paneName = id.startsWith('#pane-') ? id.slice('#pane-'.length) : id;
    document.querySelector(`#dashNav .nav-link[data-path="/dashboard"][data-pane="${paneName}"]`)?.classList.add('active');
  } catch(_){ }
  if (id === '#pane-settings') ensureSettingsInitialized();
  // Trigger lazy initializations when panes first become visible (best-effort, modules guard their own init)
  try {
    if (id === '#pane-blog') {
      // blog-modern.js auto-inits on presence of elements
    } else if (id === '#pane-shop') {
      // shop.js auto-inits on presence of elements
    }
  } catch(_){ }

  // Normalize URL (?pane=...) without duplicating parameters or using stray semicolons
  try {
    const paneValue = (id.startsWith('#pane-') ? id.replace('#pane-','') : id).toLowerCase();
    const current = new URL(window.location.href);
    // Only update if actually changed to avoid polluting history
    if (current.pathname === '/dashboard') {
      // Clean any legacy duplicates like ';pane=' in search string
      let rawSearch = current.search.replace(/;pane=[^&;]*/gi, '');
      const params = new URLSearchParams(rawSearch);
      if (params.get('pane') !== paneValue) {
        params.set('pane', paneValue);
        const newUrl = `${current.origin}${current.pathname}?${params.toString()}`;
        // Replace state so back button isn't cluttered by every tab click
        window.history.replaceState(null, document.title, newUrl);
      } else if (rawSearch.includes(';pane=')) {
        // Even if same value, still rewrite to remove artifacts
        const newUrl = `${current.origin}${current.pathname}?${params.toString()}`;
        window.history.replaceState(null, document.title, newUrl);
      }
    }
  } catch(_){ /* ignore URL update errors */ }
}





// Expose a couple of functions for the non-module fallback inline script (dashboard.html)
// Only attach if not already present to avoid collisions.
if (typeof window !== 'undefined') {
  if (!window.switchPane) window.switchPane = switchPane;
}

async function loadDashNotifs(){
  try {
    const { data } = await fetchJSON(`${API_BASE}/notifications/mine?page=1&pageSize=5`);
    const list = document.getElementById('dashNotifList'); if (!list) return;
    list.innerHTML = '';
    if (!data.length) { list.innerHTML = '<div class="text-muted">No notifications.</div>'; return; }
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
        <div class="mt-2">${escapeHtml(n.body)}</div>`;
      list.appendChild(item);
    }
    list.querySelectorAll('[data-read]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-id');
        try { await fetchJSON(`${API_BASE}/notifications/${id}/read`, { method:'POST', body: JSON.stringify({}) }); btn.closest('.p-3')?.classList.add('opacity-75'); fetchNotifUnread(); }
        catch(e){ alert(e.message||'Failed'); }
      });
    });
  } catch(_){ }
}

function renderCartBadge(){
  const el = document.getElementById('dashCartCount'); if (!el) return;
  let count = 0; try { const cart = JSON.parse(localStorage.getItem('cart')||'[]'); count = cart.reduce((a,i)=>a+Number(i.qty||1),0); } catch(_){ }
  el.textContent = String(count);
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

async function loadOverview(){
  try {
    const me = await fetchJSON(`${API_BASE}/auth/me`);
  // loadOverview end of try block continues below
    const elName = document.getElementById('dashUserName'); 
    if (elName) elName.textContent = me.name || 'User';
    if (me.avatar_url) {
      const av = document.getElementById('dashAvatar');
      if (av) av.src = me.avatar_url;
      // Also update any global avatar placeholders for consistency
      document.querySelectorAll('[data-global-avatar]').forEach(img=>{
        if (img && img !== av) img.src = me.avatar_url;
      });
    }
  } catch(_){ }
  try {
    const { count } = await fetchJSON(`${API_BASE}/orders/my/summary`);
    const el = document.getElementById('dashOrders'); 
    if (el) el.textContent = String(count);
  } catch(_){ }
}

// =============================
// Currency Converter
// =============================
function setupCurrencyConverter(){
  const form = document.getElementById('currencyForm');
  if (!form) return;
  const selFrom = document.getElementById('ccFrom');
  const selTo = document.getElementById('ccTo');
  const resultEl = document.getElementById('ccResult');
  const amountEl = document.getElementById('ccAmount');
  const metaEl = document.getElementById('ccRateMeta');
  const refreshBtn = document.getElementById('ccRefresh');

  async function populateCurrencies(){
    try {
      const { data } = await fetchJSON(`${API_BASE}/currency/supported`);
      const opts = data.map(c=>`<option value="${c}">${c}</option>`).join('');
      selFrom.innerHTML = opts; selTo.innerHTML = opts;
      // sensible defaults
      selFrom.value = 'USD';
      selTo.value = (data.includes('NGN') ? 'NGN' : data[0]);
    } catch(_){ }
  }

  async function convert(){
    const amt = parseFloat(amountEl.value) || 0;
    const from = selFrom.value;
    const to = selTo.value;
    if (!amt || amt < 0) { resultEl.textContent = 'Enter a valid amount'; return; }
    resultEl.textContent = 'Converting…';
    try {
      const resp = await fetch(`${API_BASE}/currency/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amt)}`, { headers: authHeaders() });
      if (resp.status === 401) {
        resultEl.innerHTML = '<span class="text-danger">Session expired. Please sign in again.</span>';
        setTimeout(()=>{ try { localStorage.removeItem('token'); } catch(_){} window.location.href='/?#signin'; }, 1200);
        return;
      }
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      const j = await resp.json();
      const { result, rate } = j;
      resultEl.innerHTML = `${amt.toLocaleString(undefined,{maximumFractionDigits:4})} ${from} = <strong>${Number(result).toLocaleString(undefined,{maximumFractionDigits:4})} ${to}</strong>`;
      metaEl.style.display = 'block';
      metaEl.textContent = `Rate: 1 ${from} = ${rate.toLocaleString(undefined,{maximumFractionDigits:6})} ${to}`;
    } catch(e){ resultEl.textContent = e.message || 'Conversion failed'; }
  }

  form.addEventListener('submit', (e)=>{ e.preventDefault(); convert(); });
  refreshBtn?.addEventListener('click', (e)=>{ e.preventDefault(); convert(); });
  populateCurrencies().then(()=> convert());
}
function setupSidebarToggle(){
  const burger = document.getElementById('dashBurger');
  const sidebar = document.getElementById('dashSidebar');
  const overlay = document.getElementById('dashOverlay');
  if (!burger || !sidebar || !overlay) return;
  const isMobile = ()=> window.matchMedia('(max-width: 767.98px)').matches;
  const openMobile = ()=>{ document.body.classList.add('sidebar-open'); overlay.classList.remove('d-none'); };
  const closeMobile = ()=>{ document.body.classList.remove('sidebar-open'); overlay.classList.add('d-none'); };
  burger.addEventListener('click', ()=>{
    if (isMobile()) {
      if (document.body.classList.contains('sidebar-open')) closeMobile(); else openMobile();
    } else {
      sidebar.classList.toggle('d-none');
    }
  });
  overlay.addEventListener('click', closeMobile);
  window.addEventListener('resize', ()=>{ if (!isMobile()) closeMobile(); });
}

function wireNav() {
  document.querySelectorAll('#dashNav .nav-link').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = a.getAttribute('data-target');
      // Only intercept internal pane navigation links (those with data-target)
      if (!target) return; // allow normal navigation for /chat, /blog, etc.
      e.preventDefault();
      switchPane(target);
    });
  });
  document.getElementById('dashSignOut').addEventListener('click', (e)=>{ 
    e.preventDefault(); 
    try { localStorage.removeItem('token'); localStorage.removeItem('cart'); } catch(_) {}
    try { if (history.replaceState) history.replaceState(null, document.title, window.location.pathname + window.location.search); } catch(_){}
    window.location.replace('/');
  });
}

// Chat widget init

// ============ Dashboard Chats Pane ============
async function loadDashChatThreads(){
  const list = document.getElementById('dashChatThreads'); if (!list) return;
  list.innerHTML = '';
  const threads = await fetchMyThreads();
  if (!threads.length) { list.innerHTML = '<div class="small text-muted p-3">No chats yet.</div>'; return; }
  threads.forEach(th => {
    const btn = document.createElement('button');
    btn.className = 'list-group-item list-group-item-action text-start';
    btn.dataset.threadId = th.id;
    btn.innerHTML = `<div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <div class="fw-semibold thread-subject">${escapeHtml(th.subject || th.product_title || 'Chat')}</div>
          <div class="small text-muted thread-meta" data-meta>#${th.id}${th.product_title? ' · '+escapeHtml(th.product_title):''}</div>
          <div class="small text-truncate thread-preview" style="max-width:240px"></div>
        </div>
        <span class="badge rounded-pill bg-primary d-none" data-unread>0</span>
      </div>`;
    btn.onclick = ()=> selectDashChatThread(th);
    list.appendChild(btn);
  });
}

function renderDashChatMessages(list){
  const box = document.getElementById('dashChatMessagesPane'); if (!box) return;
  box.innerHTML = '';
  list.forEach(m => {
    const wrap = document.createElement('div');
    const mine = (function _isMine(mm){ try { const t = JSON.parse(atob((localStorage.getItem('token')||'').split('.')[1])); return t && t.sub === mm.sender_id; } catch(_) { return false; } })(m);
    wrap.className = `d-flex ${mine?'justify-content-end':'justify-content-start'} mb-2`;
    const bubble = document.createElement('div');
    bubble.className = `px-3 py-2 rounded-3 ${mine?'bg-primary text-white':'bg-light'}`;
    bubble.style.maxWidth = '80%';
    bubble.innerHTML = `<div class="small">${escapeHtml(m.body)}</div><div class="small text-muted mt-1">${new Date(m.created_at).toLocaleTimeString()}</div>`;
    wrap.appendChild(bubble); box.appendChild(wrap);
  });
  box.scrollTop = box.scrollHeight;
}

async function selectDashChatThread(th){
  try {
    document.getElementById('dashChatHeader').textContent = th.subject || th.product_title || 'Chat';
    const res = await fetch(`${API_BASE}/chats/threads/${th.id}/messages`, { headers: authHeaders() });
    const j = await res.json(); renderDashChatMessages(j.data||[]);
    // Also wire the button to open modal chat on demand
    const btn = document.getElementById('dashChatOpenModal'); if (btn) btn.onclick = ()=> openExistingThread(th.id, { inModal: true });
  } catch(_){ /* ignore */ }
}

// Handle thread:update push events (called from chat.js socket once we expose a hook)
window.__chatThreadUpdate = function updateThreadMeta(payload){
  const list = document.getElementById('dashChatThreads'); if (!list) return;
  const btn = list.querySelector(`button[data-thread-id='${payload.thread_id}']`);
  if (btn) {
    const preview = btn.querySelector('.thread-preview');
    if (preview && payload.last_message_body) preview.textContent = payload.last_message_body.slice(0,80);
    const badge = btn.querySelector('[data-unread]');
    if (badge && typeof payload.unread === 'number') {
      if (payload.unread > 0) { badge.textContent = String(payload.unread); badge.classList.remove('d-none'); }
      else badge.classList.add('d-none');
    }
  }
};

(function init(){
  wireNav();
  // Support deep linking via ?pane=notifications|settings|orders|chats
  const params = new URLSearchParams(location.search);
  const pane = (params.get('pane')||'overview').toLowerCase();
  const paneMap = {
    overview: '#pane-overview',
    notifications: '#pane-notifications',
    settings: '#pane-settings',
    orders: '#pane-orders',
    chats: '#pane-chats'
  };
  const targetPane = paneMap[pane] || '#pane-overview';
  // Initial switch to the target pane
  switchPane(targetPane);
  loadOverview();
  setupCurrencyConverter();
  // Initialize quotations UI (lazy loads data when pane first shown)
  try { initQuotationsUI(); } catch(_){ }
  loadDashNotifs();
  renderCartBadge();
  document.getElementById('dashBellBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); switchPane('#pane-notifications'); loadDashNotifs(); });
  window.addEventListener('storage', (e)=>{ if (e.key==='cart') renderCartBadge(); });
  document.addEventListener('cart:changed', renderCartBadge);
  // Mark all read
  document.getElementById('dashMarkAll')?.addEventListener('click', async ()=>{
  try { await fetchJSON(`${API_BASE}/notifications/mark-all-read`, { method:'POST', body: JSON.stringify({}) }); loadDashNotifs(); }
    catch(e){ alert(e.message||'Failed'); }
  });
  // Socket live updates for notifications
  try {
    if (window.io) {
      const t = getToken();
      if (t) {
        const s = window.io('http://localhost:4000', { auth: { token: t } });
  s.on('notif:new', ()=>{ loadDashNotifs(); });
      }
    }
  } catch(_){ }
  // Poll unread every 30s
  // Guard against back-forward cache showing authed UI after logout
  window.addEventListener('pageshow', function(event){
    const token = getToken();
    if (!token && event.persisted) { window.location.reload(); }
  });
  // Setup sidebar toggle
  setupSidebarToggle();
  // Initialize chat widget once DOM ready
  window.addEventListener('DOMContentLoaded', ()=>{ try { initChatWidget(); } catch(_){} });
  // Chat FAB should open chats pane instead of directly modal
  const fab = document.getElementById('chatFab');
  if (fab) fab.addEventListener('click', (e)=>{ e.preventDefault(); switchPane('#pane-chats'); loadDashChatThreads(); });
})();
