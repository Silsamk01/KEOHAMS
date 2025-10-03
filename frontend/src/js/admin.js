const API_BASE = 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

async function requireAdminOrRedirect() {
  // if no token, go to sign-in
  if (!getToken()) { window.location.href = '/#signin'; throw new Error('Not signed in'); }
  // verify role via /auth/me
  try {
    const me = await fetchJSON(`${API_BASE}/auth/me`);
    if (!me || me.role !== 'ADMIN') { window.location.href = '/'; throw new Error('Forbidden'); }
  } catch (_) { window.location.href = '/'; throw new Error('Forbidden'); }
}

// Dashboard
async function loadStats() {
  try {
    const s = await fetchJSON(`${API_BASE}/admin/stats`);
    document.getElementById('statUsers').textContent = s.users;
    document.getElementById('statProducts').textContent = s.products;
    document.getElementById('statCategories').textContent = s.categories;
    document.getElementById('statKyc').textContent = s.kyc_pending;
  } catch (e) {
    console.error('stats failed', e);
  }
}

// Users
const usersState = { page: 1, pageSize: 10, q: '' };
async function loadUsers() {
  try {
    const params = new URLSearchParams({ page: String(usersState.page), pageSize: String(usersState.pageSize) });
    if (usersState.q) params.set('q', usersState.q);
    const { data, total } = await fetchJSON(`${API_BASE}/admin/users?${params}`);
    const tbody = document.getElementById('usersTbody');
    tbody.innerHTML = '';
    for (const u of data) {
      const tr = document.createElement('tr');
      tr.innerHTML =`
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>
          <select class="form-select form-select-sm roleSel" data-id="${u.id}">
            <option value="CUSTOMER" ${u.role==='CUSTOMER'?'selected':''}>CUSTOMER</option>
            <option value="ADMIN" ${u.role==='ADMIN'?'selected':''}>ADMIN</option>
          </select>
        </td>
        <td>
          <div class="form-check form-switch">
            <input class="form-check-input verifyChk" type="checkbox" data-id="${u.id}" ${u.email_verified? 'checked':''}>
          </div>
        </td>
        <td><button class="btn btn-sm btn-primary saveUser" data-id="${u.id}">Save</button></td>
      `;
      tbody.appendChild(tr);
    }
    document.getElementById('usersTotal').textContent = `Total: ${total}`;
    wireUserActions();
  } catch (e) {
    console.error('users failed', e);
  }
}

function wireUserActions() {
  document.querySelectorAll('.saveUser').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const role = (btn.closest('tr').querySelector('.roleSel')).value;
      const email_verified = (btn.closest('tr').querySelector('.verifyChk')).checked;
      try {
        await fetchJSON(`${API_BASE}/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role, email_verified }) });
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        btn.textContent = 'Saved';
        setTimeout(()=>{ btn.classList.add('btn-primary'); btn.classList.remove('btn-success'); btn.textContent='Save'; }, 1000);
      } catch (e) {
        alert(e.message || 'Save failed');
      }
    });
  });
}

// KYC
const kycState = { page: 1, pageSize: 10, status: '' };
async function loadKyc() {
  try {
    const params = new URLSearchParams({ page: String(kycState.page), pageSize: String(kycState.pageSize) });
    if (kycState.status) params.set('status', kycState.status);
    const { data, total } = await fetchJSON(`${API_BASE}/admin/kyc?${params}`);
    const tbody = document.getElementById('kycTbody');
    tbody.innerHTML = '';
    for (const r of data) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.user_id}</td>
        <td><span class="badge ${badgeClass(r.status)}">${r.status}</span></td>
        <td>${new Date(r.submitted_at || r.created_at).toLocaleString()}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-success" data-act="approve" data-id="${r.id}">Approve</button>
            <button class="btn btn-danger" data-act="reject" data-id="${r.id}">Reject</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
    document.getElementById('kycTotal').textContent = `Total: ${total}`;
    wireKycActions();
  } catch (e) { console.error('kyc failed', e); }
}

function badgeClass(status) {
  switch(status) {
    case 'APPROVED': return 'text-bg-success';
    case 'REJECTED': return 'text-bg-danger';
    default: return 'text-bg-warning';
  }
}

function wireKycActions() {
  document.querySelectorAll('#kycTbody [data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      const endpoint = act === 'approve' ? 'approve' : 'reject';
      try {
        await fetchJSON(`${API_BASE}/admin/kyc/${id}/${endpoint}`, { method: 'POST', body: JSON.stringify({}) });
        await loadKyc();
      } catch (e) { alert(e.message || 'Action failed'); }
    });
  });
}

function wireNav() {
  document.getElementById('refreshUsers').addEventListener('click', ()=>{ usersState.page=1; loadUsers(); });
  document.getElementById('usersPrev').addEventListener('click', ()=>{ usersState.page=Math.max(1, usersState.page-1); loadUsers(); });
  document.getElementById('usersNext').addEventListener('click', ()=>{ usersState.page+=1; loadUsers(); });
  document.getElementById('usersSearch').addEventListener('input', (e)=>{ usersState.q=e.target.value.trim(); usersState.page=1; loadUsers(); });

  document.getElementById('refreshKyc').addEventListener('click', ()=>{ kycState.page=1; loadKyc(); });
  document.getElementById('kycPrev').addEventListener('click', ()=>{ kycState.page=Math.max(1, kycState.page-1); loadKyc(); });
  document.getElementById('kycNext').addEventListener('click', ()=>{ kycState.page+=1; loadKyc(); });
  document.getElementById('kycStatus').addEventListener('change', (e)=>{ kycState.status = e.target.value; kycState.page=1; loadKyc(); });

  document.getElementById('adminSignOut').addEventListener('click', (e)=>{ e.preventDefault(); localStorage.removeItem('token'); window.location.href='/'; });
}

(async function init(){
  try { await requireAdminOrRedirect(); } catch { return; }
  wireNav();
  loadStats();
  loadUsers();
  loadKyc();
  // Catalog initializers
  loadCategoriesUI();
  loadProductsUI();
  wireProfile();
  loadProfile();
  wirePending();
  loadPending();
  initAdminChat();
})();

// Pending registrations
const pendingState = { page: 1, pageSize: 10, q: '' };
async function loadPending() {
  try {
    const params = new URLSearchParams({ page: String(pendingState.page), pageSize: String(pendingState.pageSize) });
    if (pendingState.q) params.set('q', pendingState.q);
    const { data, total } = await fetchJSON(`${API_BASE}/admin/pending-registrations?${params}`);
    const tbody = document.getElementById('pendingTbody');
    tbody.innerHTML = '';
    for (const r of data) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.name}</td>
        <td>${r.email}</td>
        <td>${new Date(r.expires_at).toLocaleString()}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-act="resend" data-id="${r.id}">Resend</button>
            <button class="btn btn-outline-success" data-act="force" data-id="${r.id}">Create User</button>
            <button class="btn btn-outline-danger" data-act="delete" data-id="${r.id}">Delete</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
    document.getElementById('pendingTotal').textContent = `Total: ${total}`;
    wirePendingActions();
  } catch (e) { console.error('pending failed', e); }
}

function wirePending() {
  document.getElementById('refreshPending').addEventListener('click', ()=>{ pendingState.page=1; loadPending(); });
  document.getElementById('pendingPrev').addEventListener('click', ()=>{ pendingState.page=Math.max(1, pendingState.page-1); loadPending(); });
  document.getElementById('pendingNext').addEventListener('click', ()=>{ pendingState.page+=1; loadPending(); });
  document.getElementById('pendingSearch').addEventListener('input', (e)=>{ pendingState.q=e.target.value.trim(); pendingState.page=1; loadPending(); });
}

function wirePendingActions() {
  document.querySelectorAll('#pendingTbody [data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      try {
        if (act === 'resend') await fetchJSON(`${API_BASE}/admin/pending-registrations/${id}/resend`, { method: 'POST', body: JSON.stringify({}) });
        if (act === 'force') await fetchJSON(`${API_BASE}/admin/pending-registrations/${id}/force-create`, { method: 'POST', body: JSON.stringify({}) });
        if (act === 'delete') await fetchJSON(`${API_BASE}/admin/pending-registrations/${id}`, { method: 'DELETE' });
        await loadPending();
      } catch (e) { alert(e.message || 'Action failed'); }
    });
  });
}

async function loadProfile() {
  try {
    const p = await fetchJSON(`${API_BASE}/admin/profile`);
    document.getElementById('pfName').value = p.name || '';
    document.getElementById('pfEmail').value = p.email || '';
    document.getElementById('pfPhone').value = p.phone || '';
    document.getElementById('pfAddress').value = p.address || '';
    renderTwofa(p.twofa_enabled);
  } catch (e) { console.error('profile failed', e); }
}

function wireProfile() {
  document.getElementById('profileForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('pfName').value.trim();
    const phone = document.getElementById('pfPhone').value.trim();
    const address = document.getElementById('pfAddress').value.trim();
    try { await fetchJSON(`${API_BASE}/admin/profile`, { method: 'PATCH', body: JSON.stringify({ name, phone, address }) }); alert('Saved'); }
    catch (e) { alert(e.message || 'Save failed'); }
  });

  document.getElementById('pwdForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const current_password = document.getElementById('pwdCurrent').value;
    const new_password = document.getElementById('pwdNew').value;
    try { await fetchJSON(`${API_BASE}/admin/profile/change-password`, { method: 'POST', body: JSON.stringify({ current_password, new_password }) }); alert('Password updated'); (document.getElementById('pwdForm')).reset(); }
    catch (e) { alert(e.message || 'Update failed'); }
  });

  document.getElementById('twofaBeginSetup').addEventListener('click', async ()=>{
    try {
      const s = await fetchJSON(`${API_BASE}/admin/profile/2fa/setup`, { method: 'POST', body: JSON.stringify({}) });
      document.getElementById('twofaSetup').classList.remove('d-none');
      document.getElementById('twofaQR').src = s.qr;
      document.getElementById('twofaKey').textContent = s.base32;
      document.getElementById('twofaDisableBtn').classList.add('d-none');
    } catch (e) { alert(e.message || '2FA setup failed'); }
  });

  document.getElementById('twofaEnableBtn').addEventListener('click', async ()=>{
    const base32 = document.getElementById('twofaKey').textContent;
    const token = document.getElementById('twofaToken').value.trim();
    try { await fetchJSON(`${API_BASE}/admin/profile/2fa/enable`, { method: 'POST', body: JSON.stringify({ base32, token }) }); renderTwofa(true); alert('2FA enabled'); }
    catch (e) { alert(e.message || 'Invalid code'); }
  });

  document.getElementById('twofaDisableBtn').addEventListener('click', async ()=>{
    try { await fetchJSON(`${API_BASE}/admin/profile/2fa/disable`, { method: 'POST', body: JSON.stringify({}) }); renderTwofa(false); alert('2FA disabled'); }
    catch (e) { alert(e.message || 'Disable failed'); }
  });
}

function renderTwofa(enabled) {
  const status = document.getElementById('twofaStatus');
  const setup = document.getElementById('twofaSetup');
  const disBtn = document.getElementById('twofaDisableBtn');
  if (enabled) {
    status.textContent = '2FA is enabled on your account';
    setup.classList.add('d-none');
    disBtn.classList.remove('d-none');
  } else {
    status.textContent = '2FA is not enabled';
    disBtn.classList.add('d-none');
  }
}

// =========================
// Admin Chats
// =========================
let adminSocket; let currentThreadId = null;
function adminToken(){ return localStorage.getItem('token'); }
function ensureAdminSocket(){
  if (adminSocket && adminSocket.connected) return adminSocket;
  const t = adminToken(); if (!t) return null;
  // Load Socket.IO client if not already
  if (!window.io) {
    const s = document.createElement('script'); s.src = '/socket.io/socket.io.js'; document.head.appendChild(s);
    s.onload = ()=> ensureAdminSocket();
    return null;
  }
  adminSocket = window.io('http://localhost:4000', { auth: { token: t } });
  adminSocket.on('connect_error', (e)=>console.warn('socket admin error', e.message));
  adminSocket.on('message:new', (payload)=>{ if (payload?.thread_id === currentThreadId) appendAdminMessage(payload.message); });
  adminSocket.on('admin:thread:new', ()=> refreshAdminThreads());
  adminSocket.on('admin:message:new', (p)=>{ if (p.thread_id === currentThreadId) {/* already handled via message:new */} else { /* could badge */ } });
  return adminSocket;
}

async function fetchJSONAuthed(url, opts={}){ return fetchJSON(url, opts); }

async function refreshAdminThreads(){
  try {
    const { data } = await fetchJSONAuthed(`${API_BASE}/chats/admin/threads`);
    const list = document.getElementById('adminThreads'); if (!list) return;
    list.innerHTML = '';
    for (const th of data) {
      const a = document.createElement('button');
      a.className = 'list-group-item list-group-item-action text-start';
      a.innerHTML = `<div class="fw-semibold">${escapeHtml(th.user_name || 'User #'+th.user_id)}</div>
                     <div class="small text-muted">${escapeHtml(th.product_title || th.subject || 'General chat')}</div>`;
      a.onclick = ()=> selectAdminThread(th);
      list.appendChild(a);
    }
  } catch (e) { console.error('load threads failed', e); }
}

async function selectAdminThread(thread){
  currentThreadId = thread.id;
  document.getElementById('adminChatHeader').textContent = `${thread.user_name || ('User #'+thread.user_id)} · ${thread.product_title || thread.subject || 'Chat'}`;
  const delBtn = document.getElementById('adminChatDeleteBtn'); 
  if (delBtn) { 
    delBtn.disabled = false; 
    delBtn.onclick = async () => {
      if (!currentThreadId) return; 
      if (!confirm('Permanently delete this thread? This cannot be undone.')) return;
      try { 
        await fetchJSONAuthed(`${API_BASE}/chats/admin/threads/${currentThreadId}`, { method: 'DELETE' }); 
        currentThreadId = null; 
        document.getElementById('adminChatMessages').innerHTML=''; 
        document.getElementById('adminChatHeader').textContent='Select a thread'; 
        delBtn.disabled = true; 
        await refreshAdminThreads(); 
      } catch(e){ 
        alert(e.message || 'Delete failed'); 
      } 
    }; 
  }
  const res = await fetchJSONAuthed(`${API_BASE}/chats/threads/${thread.id}/messages`);
  renderAdminMessages(res.data);
  const s = ensureAdminSocket(); if (s) s.emit('thread:join', { thread_id: thread.id });
}

function renderAdminMessages(list){
  const box = document.getElementById('adminChatMessages'); if (!box) return;
  box.innerHTML = '';
  list.forEach(m=> appendAdminMessage(m));
  box.scrollTop = box.scrollHeight;
}

function appendAdminMessage(m){
  const box = document.getElementById('adminChatMessages'); if (!box) return;
  const mine = isAdminMine(m);
  const wrap = document.createElement('div'); wrap.className = `d-flex ${mine?'justify-content-end':'justify-content-start'}`;
  const bubble = document.createElement('div'); bubble.className = `px-3 py-2 rounded-3 ${mine?'bg-primary text-white':'bg-light'}`; bubble.style.maxWidth='80%';
  bubble.innerHTML = `<div class="small">${escapeHtml(m.body)}</div><div class="small text-muted mt-1">${new Date(m.created_at).toLocaleTimeString()}</div>`;
  wrap.appendChild(bubble); box.appendChild(wrap); box.scrollTop = box.scrollHeight;
}

function isAdminMine(m){
  try { const t = JSON.parse(atob((adminToken()||'').split('.')[1])); return t && t.sub === m.sender_id; } catch(_) { return false; }
}

function initAdminChat(){
  const btn = document.getElementById('adminChatsRefresh'); if (btn) btn.addEventListener('click', refreshAdminThreads);
  ensureAdminSocket();
  refreshAdminThreads();
  const sendBtn = document.getElementById('adminChatSend'); const input = document.getElementById('adminChatInput');
  const send = async ()=>{
    if (!currentThreadId) return; const text = input.value.trim(); if (!text) return; input.value='';
    try { await fetchJSONAuthed(`${API_BASE}/chats/threads/${currentThreadId}/messages`, { method:'POST', body: JSON.stringify({ body: text }), headers: { 'Content-Type':'application/json' } }); }
    catch(e){ console.warn('send failed', e); }
  };
  if (sendBtn) sendBtn.addEventListener('click', send);
  if (input) input.addEventListener('keydown', (e)=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }});
}

// =========================
// Catalog: Categories
// =========================
async function loadCategoriesUI() {
  try {
    await refreshCategories();
    wireCategoryForm();
    document.getElementById('refreshCategories').addEventListener('click', refreshCategories);
  } catch (e) { console.error('categories init failed', e); }
}

async function refreshCategories() {
  const { data } = await fetchJSON(`${API_BASE}/categories`);
  // Populate category table
  const tbody = document.getElementById('catTbody');
  if (tbody) {
    tbody.innerHTML = '';
    for (const c of data) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.id}</td>
        <td><input class="form-control form-control-sm cat-name" data-id="${c.id}" value="${escapeHtml(c.name)}"></td>
        <td>
          <select class="form-select form-select-sm cat-parent" data-id="${c.id}">
            <option value="">None</option>
          </select>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-primary cat-save" data-id="${c.id}">Save</button>
            <button class="btn btn-danger cat-del" data-id="${c.id}">Delete</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  // Build selects for parent and product filters/forms
  const opts = [ '<option value="">None</option>' ];
  for (const c of data) opts.push(`<option value="${c.id}">${escapeHtml(c.name)}</option>`);
  const catParent = document.getElementById('catParent');
  if (catParent) catParent.innerHTML = opts.join('');
  const pCategory = document.getElementById('pCategory');
  if (pCategory) pCategory.innerHTML = [ '<option value="">None</option>', ...opts.slice(1) ].join('');
  const prodFilterCategory = document.getElementById('prodFilterCategory');
  if (prodFilterCategory) prodFilterCategory.innerHTML = ['<option value="">All categories</option>', ...opts.slice(1)].join('');

  // Fill each row's parent select with current categories, selecting current parent
  if (tbody) {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, idx) => {
      const select = row.querySelector('.cat-parent');
      if (select) select.innerHTML = opts.join('');
    });
    // After options set, we need to set selected parent for each category
    data.forEach((c, idx) => {
      const select = tbody.querySelector(`.cat-parent[data-id="${c.id}"]`);
      if (select) select.value = c.parent_id || '';
    });
  }

  wireCategoryRowActions();
}

function wireCategoryForm() {
  const form = document.getElementById('catCreateForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const parent_id = document.getElementById('catParent').value || null;
    if (!name) return alert('Name is required');
    try {
      await fetchJSON(`${API_BASE}/categories`, { method: 'POST', headers: { ...authHeaders() }, body: JSON.stringify({ name, parent_id }) });
      form.reset();
      await refreshCategories();
    } catch (e) { alert(e.message || 'Create failed'); }
  });
}

function wireCategoryRowActions() {
  document.querySelectorAll('.cat-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const row = btn.closest('tr');
      const name = row.querySelector('.cat-name').value.trim();
      const parent_id = row.querySelector('.cat-parent').value || null;
      try {
        await fetchJSON(`${API_BASE}/categories/${id}`, { method: 'PUT', headers: { ...authHeaders() }, body: JSON.stringify({ name, parent_id }) });
        btn.classList.remove('btn-primary'); btn.classList.add('btn-success'); btn.textContent='Saved';
        setTimeout(()=>{ btn.classList.add('btn-primary'); btn.classList.remove('btn-success'); btn.textContent='Save'; }, 1000);
        await refreshCategories();
      } catch (e) { alert(e.message || 'Update failed'); }
    });
  });
  document.querySelectorAll('.cat-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this category?')) return;
      try { await fetchJSON(`${API_BASE}/categories/${id}`, { method: 'DELETE', headers: { ...authHeaders() } }); await refreshCategories(); }
      catch (e) { alert(e.message || 'Delete failed'); }
    });
  });
}

// =========================
// Catalog: Products
// =========================
const prodState = { page: 1, pageSize: 10, q: '', category_id: '', stock_status: '' };
async function loadProductsUI() {
  try {
    wireProductFilters();
    wireProductCreate();
    await refreshProducts();
  } catch (e) { console.error('products init failed', e); }
}

function wireProductFilters() {
  const q = document.getElementById('prodSearch');
  const cat = document.getElementById('prodFilterCategory');
  const status = document.getElementById('prodFilterStatus');
  const prev = document.getElementById('prodPrev');
  const next = document.getElementById('prodNext');
  const refresh = document.getElementById('refreshProducts');
  if (q) q.addEventListener('input', ()=>{ prodState.q = q.value.trim(); prodState.page=1; refreshProducts(); });
  if (cat) cat.addEventListener('change', ()=>{ prodState.category_id = cat.value; prodState.page=1; refreshProducts(); });
  if (status) status.addEventListener('change', ()=>{ prodState.stock_status = status.value; prodState.page=1; refreshProducts(); });
  if (prev) prev.addEventListener('click', ()=>{ prodState.page=Math.max(1, prodState.page-1); refreshProducts(); });
  if (next) next.addEventListener('click', ()=>{ prodState.page+=1; refreshProducts(); });
  if (refresh) refresh.addEventListener('click', ()=> refreshProducts());
}

async function refreshProducts() {
  const params = new URLSearchParams({ page: String(prodState.page), pageSize: String(prodState.pageSize) });
  if (prodState.q) params.set('q', prodState.q);
  if (prodState.category_id) params.set('category_id', prodState.category_id);
  if (prodState.stock_status) params.set('stock_status', prodState.stock_status);
  const { data } = await fetchJSON(`${API_BASE}/products?${params}`);
  const tbody = document.getElementById('prodTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const p of data) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td><input class="form-control form-control-sm p-title" value="${escapeHtml(p.title)}"></td>
      <td><input type="number" step="0.01" min="0" class="form-control form-control-sm p-price" value="${p.price_per_unit}"></td>
      <td>
        <select class="form-select form-select-sm p-status">
          <option value="IN_STOCK" ${p.stock_status==='IN_STOCK'?'selected':''}>IN_STOCK</option>
          <option value="OUT_OF_STOCK" ${p.stock_status==='OUT_OF_STOCK'?'selected':''}>OUT_OF_STOCK</option>
          <option value="PREORDER" ${p.stock_status==='PREORDER'?'selected':''}>PREORDER</option>
        </select>
      </td>
      <td>
        <select class="form-select form-select-sm p-category">
          ${(document.getElementById('prodFilterCategory')?.innerHTML || '').replace('All categories', 'None')}
        </select>
      </td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-primary p-save">Save</button>
          <button class="btn btn-danger p-del">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
    // set selected category
    const sel = tr.querySelector('.p-category');
    if (sel) sel.value = p.category_id || '';
    // attach handlers
    const saveBtn = tr.querySelector('.p-save');
    const delBtn = tr.querySelector('.p-del');
    saveBtn.addEventListener('click', async ()=>{
      const title = tr.querySelector('.p-title').value.trim();
      const price_per_unit = parseFloat(tr.querySelector('.p-price').value);
      const stock_status = tr.querySelector('.p-status').value;
      const category_id = tr.querySelector('.p-category').value || null;
      try {
        await fetchJSON(`${API_BASE}/products/${p.id}`, { method: 'PUT', headers: { ...authHeaders() }, body: JSON.stringify({ title, price_per_unit, stock_status, category_id }) });
        saveBtn.classList.remove('btn-primary'); saveBtn.classList.add('btn-success'); saveBtn.textContent='Saved';
        setTimeout(()=>{ saveBtn.classList.add('btn-primary'); saveBtn.classList.remove('btn-success'); saveBtn.textContent='Save'; }, 1000);
      } catch (e) { alert(e.message || 'Update failed'); }
    });
    delBtn.addEventListener('click', async ()=>{
      if (!confirm('Archive this product?')) return;
      try { await fetchJSON(`${API_BASE}/products/${p.id}`, { method: 'DELETE', headers: { ...authHeaders() } }); await refreshProducts(); }
      catch (e) { alert(e.message || 'Delete failed'); }
    });
  }
}

function wireProductCreate() {
  const form = document.getElementById('prodCreateForm');
  if (!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = document.getElementById('pTitle').value.trim();
    const description = document.getElementById('pDescription').value.trim();
    const moq = parseInt(document.getElementById('pMoq').value || '1', 10);
    const price_per_unit = parseFloat(document.getElementById('pPrice').value);
    const stock_status = document.getElementById('pStatus').value;
    const category_id = document.getElementById('pCategory').value || '';
    if (!title || isNaN(price_per_unit)) return alert('Title and price are required');
    const fd = new FormData();
    fd.set('title', title);
    fd.set('description', description);
    fd.set('moq', String(moq));
    fd.set('price_per_unit', String(price_per_unit));
    fd.set('stock_status', stock_status);
    if (category_id) fd.set('category_id', category_id);
    const imgInput = document.getElementById('pImages');
    const vidInput = document.getElementById('pVideos');
    for (const f of (imgInput?.files || [])) fd.append('images', f);
    for (const f of (vidInput?.files || [])) fd.append('videos', f);
    try {
      const res = await fetch(`${API_BASE}/products`, { method:'POST', headers: { ...authHeaders() }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      form.reset();
      await refreshProducts();
      alert('Product created');
    } catch (e) { alert(e.message || 'Create failed'); }
  });
}

function escapeHtml(s='') {
  return s.replace(/[&<>"]+/g, (c)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

// =========================
// Blog Management (Admin)
// =========================
const BLOG_API = 'http://localhost:4000/api/blog/admin';

async function blogFetch(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || 'Request failed');
  try { return await res.json(); } catch { return {}; }
}

async function loadAdminBlog(){
  try{
    const items = await blogFetch(BLOG_API);
    const list = document.getElementById('adminBlogList');
    if (!list) return;
    list.innerHTML = (items||[]).map(p => `
      <div class="border rounded p-2 d-flex justify-content-between align-items-center">
        <div>
          <div class="fw-semibold">${escapeHtml(p.title)} ${p.require_login?' <span class=\"badge bg-secondary\">Login</span>':''}</div>
          <div class="small text-muted">/${escapeHtml(p.slug)} · ${p.status}${p.published_at? ' · '+new Date(p.published_at).toLocaleString():''}</div>
        </div>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-danger" data-del-id="${p.id}">Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-del-id]').forEach(btn=>{
      btn.addEventListener('click', async()=>{
        if(!confirm('Delete this post?')) return;
        await blogFetch(`${BLOG_API}/${btn.getAttribute('data-del-id')}`, { method:'DELETE' });
        await loadAdminBlog();
      });
    });
  }catch(e){
    console.error(e);
    const list = document.getElementById('adminBlogList');
    if (list) list.innerHTML = '<div class="text-danger">Failed to load posts.</div>';
  }
}

function wireBlog(){
  const form = document.getElementById('blogCreateForm');
  if(!form) return;
  form.addEventListener('submit', async(e)=>{
    e.preventDefault();
    try{
      const body = {
        title: document.getElementById('blogTitle').value.trim(),
        slug: document.getElementById('blogSlug').value.trim(),
        excerpt: document.getElementById('blogExcerpt').value,
        content: document.getElementById('blogContent').value,
        require_login: document.getElementById('blogRequireLogin').checked,
        status: document.getElementById('blogStatus').value
      };
      await blogFetch(BLOG_API, { method:'POST', body: JSON.stringify(body) });
      form.reset();
      await loadAdminBlog();
      alert('Post created');
    }catch(e){ alert(e.message || 'Create failed'); }
  });
  document.getElementById('refreshBlog')?.addEventListener('click', loadAdminBlog);
}

// =========================
// Notifications (Admin)
// =========================
async function loadAdminNotifs(){
  try {
    const { data } = await fetchJSON(`${API_BASE}/notifications/admin?page=1&pageSize=50`);
    const tbody = document.getElementById('notifsTbody'); if (!tbody) return;
    tbody.innerHTML = '';
    for (const n of data) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${n.id}</td>
        <td>${escapeHtml(n.title)}</td>
        <td><span class="badge ${n.audience==='ALL'?'text-bg-success':'text-bg-primary'}">${n.audience}</span></td>
        <td>${n.user_id||''}</td>
        <td>${new Date(n.created_at).toLocaleString()}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-del-notif data-id="${n.id}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    }
    document.querySelectorAll('[data-del-notif]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-id');
        if (!confirm('Delete this notification?')) return;
        try { await fetchJSON(`${API_BASE}/notifications/admin/${id}`, { method:'DELETE' }); loadAdminNotifs(); }
        catch(e){ alert(e.message||'Delete failed'); }
      });
    });
  } catch(e){ console.error('notifs failed', e); }
}

function wireAdminNotifs(){
  const form = document.getElementById('notifCreateForm'); if (!form) return;
  const audienceSel = document.getElementById('nAudience');
  const userWrap = document.getElementById('nUserWrap');
  const userSearch = document.getElementById('nUserSearch');
  const userSelect = document.getElementById('nUserSelect');

  audienceSel.addEventListener('change', ()=>{ userWrap.classList.toggle('d-none', audienceSel.value!=='USER'); });

  async function searchUsers(q){
    const params = new URLSearchParams({ page: '1', pageSize: '10' });
    if (q) params.set('q', q);
    try {
      const { data } = await fetchJSON(`${API_BASE}/admin/users?${params}`);
      userSelect.innerHTML = data.map(u=>`<option value="${u.id}">${escapeHtml(u.name||'Unnamed')} · ${escapeHtml(u.email||'')}</option>`).join('');
    } catch(e){ userSelect.innerHTML=''; }
  }

  userSearch?.addEventListener('input', debounce(()=>{ searchUsers(userSearch.value.trim()); }, 400));

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = document.getElementById('nTitle').value.trim();
    const body = document.getElementById('nBody').value.trim();
    const audience = document.getElementById('nAudience').value;
    const url = document.getElementById('nUrl').value.trim() || null;
    const user_id = audience==='USER' ? Number(userSelect.value) : null;
    if (!title || !body) return alert('Title and body are required');
    if (audience==='USER' && !user_id) return alert('Please select a user');
    try {
      await fetchJSON(`${API_BASE}/notifications/admin`, { method:'POST', body: JSON.stringify({ title, body, audience, user_id, url }) });
      alert('Notification sent');
      form.reset(); audienceSel.value='ALL'; userWrap.classList.add('d-none'); userSelect.innerHTML='';
      loadAdminNotifs();
    } catch(e){ alert(e.message||'Create failed'); }
  });
  document.getElementById('refreshNotifs')?.addEventListener('click', loadAdminNotifs);
}

// Hook into init
(function(){
  // after existing init content runs, ensure notifications are wired when tab is present
  document.addEventListener('DOMContentLoaded', ()=>{
    if (document.getElementById('pane-notifs')) {
      wireAdminNotifs();
      loadAdminNotifs();
    }
  });
})();

function debounce(fn, delay=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }
