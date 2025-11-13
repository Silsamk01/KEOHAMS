import { API_BASE } from './config.js';

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
          <div class="d-flex flex-column gap-1">
            <label class="form-check form-switch m-0 small d-flex align-items-center gap-2" title="Email Verified">
              <input class="form-check-input verifyChk" type="checkbox" data-id="${u.id}" ${u.email_verified? 'checked':''}>
              <span>Email</span>
            </label>
            <label class="form-check form-switch m-0 small d-flex align-items-center gap-2" title="Active Status">
              <input class="form-check-input activeChk" type="checkbox" data-id="${u.id}" ${u.is_active? 'checked':''}>
              <span>Active</span>
            </label>
          </div>
        </td>
        <td>
          <div class="d-flex flex-wrap gap-1">
            <button class="btn btn-sm btn-primary saveUser" data-id="${u.id}">Save</button>
            <button class="btn btn-sm btn-outline-danger delUser" data-id="${u.id}" title="Delete User">Delete</button>
          </div>
        </td>
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
      const is_active = (btn.closest('tr').querySelector('.activeChk')).checked;
      try {
        await fetchJSON(`${API_BASE}/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role, email_verified, is_active }) });
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        btn.textContent = 'Saved';
        setTimeout(()=>{ btn.classList.add('btn-primary'); btn.classList.remove('btn-success'); btn.textContent='Save'; }, 1000);
      } catch (e) {
        alert(e.message || 'Save failed');
      }
    });
  });

  document.querySelectorAll('.delUser').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete (soft) user #' + id + '? This will revoke access.')) return;
      try {
        await fetchJSON(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' });
        await loadUsers();
      } catch (e) {
        if (/Cannot delete your own user/i.test(e.message)) {
          alert('You cannot delete your own admin account from here.');
        } else {
          alert(e.message || 'Delete failed');
        }
      }
    });
  });
}





// ===== Verification State Panel =====
async function loadAndWireVerificationPanel(userId){
  if (!userId) return;
  // Load status snapshot
  try {
    const state = await fetchJSON(`${API_BASE}/verification/status`, { method: 'GET' });
    // Note: endpoint returns current user's state; we need admin view of target user.
  } catch(_){ }
  // Admin endpoints for target user
  try {
    const panel = {
      status: document.getElementById('verStateStatus'),
      risk: document.getElementById('verStateRisk'),
      riskLevel: document.getElementById('verStateRiskLevel'),
      lock: document.getElementById('verStateLock'),
      meta: document.getElementById('verStateMeta'),
      eventsBody: document.getElementById('verStateEvents'),
      lockBtn: document.getElementById('verLockBtn'),
      unlockBtn: document.getElementById('verUnlockBtn'),
      adjustBtn: document.getElementById('verAdjustBtn'),
      delta: document.getElementById('verScoreDelta')
    };

    async function refresh(){
      try {
        const s = await fetchJSON(`${API_BASE}/admin/verification/states/${userId}`);
        const st = s?.state || {};
        panel.status.textContent = st.status || '—';
        panel.status.className = `badge ${st.status==='REJECTED'?'text-bg-danger':st.status==='LOCKED'?'text-bg-dark':'text-bg-secondary'}`;
        panel.risk.textContent = typeof st.risk_score === 'number' ? st.risk_score : '—';
        panel.riskLevel.textContent = st.risk_level || '—';
        panel.lock.textContent = st.manual_lock ? 'Locked' : 'Unlocked';
        panel.meta.textContent = `Updated: ${st.updated_at? new Date(st.updated_at).toLocaleString(): '—'}`;

        // Events
        try {
          const ev = await fetchJSON(`${API_BASE}/admin/verification/state-events/${userId}?page=1&pageSize=10`);
          panel.eventsBody.innerHTML = '';
          (ev?.data||[]).forEach(row=>{
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="small">${new Date(row.created_at).toLocaleString()}</td><td class="small">${row.from_status||'—'}</td><td class="small">${row.to_status||'—'}</td>`;
            panel.eventsBody.appendChild(tr);
          });
          if (!panel.eventsBody.children.length) {
            panel.eventsBody.innerHTML = '<tr><td colspan="3" class="small text-muted">No recent events.</td></tr>';
          }
        } catch(_){ panel.eventsBody.innerHTML = '<tr><td colspan="3" class="small text-muted">Failed to load events</td></tr>'; }
      } catch(_){ /* ignore */ }
    }

    panel.lockBtn?.addEventListener('click', async ()=>{
      const reason = prompt('Lock reason (optional):') || '';
      try { await fetchJSON(`${API_BASE}/admin/verification/lock/${userId}`, { method: 'POST', body: JSON.stringify({ reason }) }); await refresh(); } catch(e){ alert(e.message||'Lock failed'); }
    });
    panel.unlockBtn?.addEventListener('click', async ()=>{
      try { await fetchJSON(`${API_BASE}/admin/verification/unlock/${userId}`, { method: 'POST', body: JSON.stringify({}) }); await refresh(); } catch(e){ alert(e.message||'Unlock failed'); }
    });
    panel.adjustBtn?.addEventListener('click', async ()=>{
      const delta = Number(panel.delta?.value || 0);
      if (!delta) { alert('Enter non-zero delta'); return; }
      const reason = prompt('Reason (optional):') || '';
      try { await fetchJSON(`${API_BASE}/admin/verification/score/${userId}/adjust`, { method: 'POST', body: JSON.stringify({ delta, reason }) }); panel.delta.value=''; await refresh(); } catch(e){ alert(e.message||'Adjust failed'); }
    });

    await refresh();
  } catch(_){ }
}

function openImageModal(src, title) {
  // Create a simple image modal for full-size viewing
  const existingModal = document.getElementById('imageModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modalHtml = `
    <div class="modal fade" id="imageModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <img src="${src}" class="img-fluid" alt="${title}">
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
  imageModal.show();
  
  // Clean up when closed
  document.getElementById('imageModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('imageModal').remove();
  });
}

function wireNav() {
  document.getElementById('refreshUsers').addEventListener('click', ()=>{ usersState.page=1; loadUsers(); });
  document.getElementById('usersPrev').addEventListener('click', ()=>{ usersState.page=Math.max(1, usersState.page-1); loadUsers(); });
  document.getElementById('usersNext').addEventListener('click', ()=>{ usersState.page+=1; loadUsers(); });
  document.getElementById('usersSearch').addEventListener('input', (e)=>{ usersState.q=e.target.value.trim(); usersState.page=1; loadUsers(); });

  document.getElementById('adminSignOut').addEventListener('click', (e)=>{ e.preventDefault(); localStorage.removeItem('token'); window.location.href='/'; });
}

(async function init(){
  try { await requireAdminOrRedirect(); } catch { return; }
  wireNav();
  initSidebarToggle();
  loadStats();
  // Poll stats every 60 seconds
  setInterval(loadStats, 60000);
  loadUsers();
  // Catalog initializers
  loadCategoriesUI();
  loadProductsUI();
  wireProfile();
  loadProfile();
  wirePending();
  loadPending();
  initAdminChat();
  initContactMessages();
  // Lazy-load quotations admin module
  try { const { initAdminQuotations } = await import('./adminQuotations.js'); initAdminQuotations(); } catch(e){ console.warn('Admin quotations init failed', e); }
})();

// =========================
// Sidebar Toggle (responsive)
// =========================
function initSidebarToggle(){
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('adminSidebar');
  if (!toggleBtn || !sidebar) return;
  const close = ()=>{ sidebar.classList.remove('open'); document.body.classList.remove('sidebar-open'); };
  const open = ()=>{ sidebar.classList.add('open'); document.body.classList.add('sidebar-open'); };
  toggleBtn.addEventListener('click', ()=>{ sidebar.classList.contains('open') ? close() : open(); });
  // Close when selecting a tab (on small screens)
  sidebar.querySelectorAll('[data-bs-toggle="pill"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ if (window.innerWidth < 992) close(); });
  });
  // Close on ESC
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') close(); });
  // Click outside to close (overlay effect via box-shadow) – detect if click not inside sidebar
  document.addEventListener('click', (e)=>{
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || e.target === toggleBtn) return;
    close();
  });
}

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
  // When any thread meta updates (e.g., last message body/time) refresh list incrementally
  adminSocket.on('thread:update', (p)=>{
    if (!p || !p.thread_id) return;
    // Lightweight in-place update: if current thread list rendered, update that item's preview text
    try {
      const list = document.getElementById('adminThreads');
      if (list) {
        const items = Array.from(list.children);
        for (const it of items) {
          // We embedded subject/product title inside; can't easily map thread id without storing dataset.
          // Improvement: store thread id as dataset for each node.
        }
      }
    } catch(_){ }
    // Simpler approach: refresh entire thread list (fast for small counts)
    refreshAdminThreads();
  });
  // User received a new message (user:message:new is emitted only to users; but admin gets admin:message:new for user messages). Here we could refresh as well.
  adminSocket.on('user:message:new', ()=> refreshAdminThreads());
  // Notification read events from users
  adminSocket.on('notif:read', (p)=>{
    try { console.log('User read notification', p); } catch(_){ }
    pushNotifReadEvent({ type:'single', user_id: p?.user_id, ids: p?.notification_id?[p.notification_id]:[] });
  });
  adminSocket.on('notif:read:bulk', (p)=>{
    try { console.log('User bulk read notifications', p); } catch(_){ }
    pushNotifReadEvent({ type:'bulk', user_id: p?.user_id, ids: p?.notification_ids||[] });
  });
  return adminSocket;
}

// =========================
// Recent Notification Read Activity Panel
// =========================
const notifReadEvents = [];
function loadNotifReadsFromStorage(){
  try {
    const raw = localStorage.getItem('admin_notif_read_events');
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      notifReadEvents.length = 0;
      for (const ev of arr.slice(0,30)) {
        if (ev && ev.user_id && ev.ts) notifReadEvents.push(ev);
      }
    }
  } catch(_){}
}
loadNotifReadsFromStorage();
function persistNotifReads(){
  try { localStorage.setItem('admin_notif_read_events', JSON.stringify(notifReadEvents.slice(0,30))); } catch(_){}
}

function pushNotifReadEvent(ev){
  if (!ev || !ev.user_id) return;
  notifReadEvents.unshift({ ts: Date.now(), ...ev });
  if (notifReadEvents.length > 30) notifReadEvents.length = 30;
  renderNotifReadEvents();
  persistNotifReads();
}

function renderNotifReadEvents(){
  const tbody = document.getElementById('notifReadsTbody');
  const badge = document.getElementById('notifReadsCount');
  if (badge) badge.textContent = `${notifReadEvents.length} event${notifReadEvents.length!==1?'s':''}`;
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const ev of notifReadEvents){
    const tr = document.createElement('tr');
    const time = new Date(ev.ts).toLocaleTimeString();
    const idsText = ev.ids && ev.ids.length ? (ev.ids.length > 5 ? ev.ids.slice(0,5).join(', ')+` +${ev.ids.length-5}`: ev.ids.join(', ')) : '—';
    tr.innerHTML = `<td>${time}</td><td>${ev.user_id}</td><td>${ev.type}</td><td>${idsText}</td>`;
    tbody.appendChild(tr);
  }
}

// Clear button wiring (after DOM ready). We'll attempt immediate binding in case element exists.
(function wireNotifReadsClear(){
  const btn = document.getElementById('notifReadsClear');
  if (!btn) return;
  btn.addEventListener('click', ()=>{ notifReadEvents.length = 0; renderNotifReadEvents(); });
})();
async function hydrateNotifReadEvents(){
  try {
    const res = await fetchJSON(`${API_BASE}/admin/notification-read-events?limit=30`);
    if (res?.data && Array.isArray(res.data)){
      notifReadEvents.length = 0;
      for (const row of res.data){
        notifReadEvents.push({ ts: new Date(row.created_at).getTime(), user_id: row.user_id, type:'single', ids: [row.notification_id] });
      }
      notifReadEvents.sort((a,b)=>b.ts-a.ts);
      renderNotifReadEvents();
      persistNotifReads();
    }
  } catch(e){ /* silent */ }
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
const BLOG_API = `${API_BASE}/blog/admin`;
let blogState = { q:'', category:'', page:1, pageSize:50 };

async function blogFetch(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || 'Request failed');
  try { return await res.json(); } catch { return {}; }
}

async function loadAdminBlog(){
  try {
    const params = new URLSearchParams();
    if (blogState.q) params.set('q', blogState.q);
    if (blogState.category) params.set('category', blogState.category);
    const items = await blogFetch(`${BLOG_API}?${params.toString()}`);
    const list = document.getElementById('adminBlogList');
    if (!list) return;
    if (!Array.isArray(items) || !items.length){
      list.innerHTML = '<div class="text-muted small">No posts yet. Create your first blog post above!</div>';
      return;
    }
    list.innerHTML = items.map(p=>renderAdminBlogRow(p)).join('');
    wireAdminBlogRow(list);
  } catch(e){
    console.error('Blog load error:', e);
    const list = document.getElementById('adminBlogList');
    if (list) list.innerHTML = `<div class="alert alert-danger">Failed to load posts: ${e.message}</div>`;
  }
}

function renderAdminBlogRow(p){
  const publishedInfo = p.status==='PUBLISHED' ? (p.published_at? ' · '+new Date(p.published_at).toLocaleString(): '') : '';
  return `<div class="border rounded p-2 mb-2" data-blog-id="${p.id}">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div class="flex-grow-1">
        <div class="fw-semibold">${escapeHtml(p.title)}${p.require_login?' <span class=\"badge bg-secondary\">Login</span>':''}${p.category? ' <span class=\"badge text-bg-info\">'+escapeHtml(p.category)+'</span>':''}</div>
        <div class="small text-muted">/${escapeHtml(p.slug)} · ${p.status}${publishedInfo}</div>
      </div>
      <div class="btn-group btn-group-sm align-self-start">
        <button class="btn btn-outline-primary" data-edit>Edit</button>
        <button class="btn btn-outline-danger" data-del>Delete</button>
      </div>
    </div>
    <div class="collapse mt-2" data-edit-form>
      <form class="vstack gap-2 blog-edit-form">
        <div class="row g-2">
          <div class="col-md-4"><input class="form-control form-control-sm" name="title" placeholder="Title" value="${escapeHtml(p.title)}"></div>
          <div class="col-md-3"><input class="form-control form-control-sm" name="slug" placeholder="slug" value="${escapeHtml(p.slug)}"></div>
          <div class="col-md-3"><input class="form-control form-control-sm" name="category" placeholder="Category" value="${escapeHtml(p.category||'')}"></div>
          <div class="col-md-2 form-check d-flex align-items-center justify-content-start gap-2">
            <input class="form-check-input" type="checkbox" name="require_login" ${p.require_login?'checked':''} id="blogReq_${p.id}">
            <label for="blogReq_${p.id}" class="small m-0">Login</label>
          </div>
        </div>
        <textarea class="form-control form-control-sm" rows="3" name="excerpt" placeholder="Excerpt">${escapeHtml(p.excerpt||'')}</textarea>
        <textarea class="form-control form-control-sm" rows="6" name="content" placeholder="Content (Markdown / HTML supported)">${escapeHtml(p.content||'')}</textarea>
        <div class="d-flex gap-2">
          <select name="status" class="form-select form-select-sm" style="max-width:160px;">
            <option value="DRAFT" ${p.status==='DRAFT'?'selected':''}>DRAFT</option>
            <option value="PUBLISHED" ${p.status==='PUBLISHED'?'selected':''}>PUBLISHED</option>
          </select>
          <button class="btn btn-sm btn-success" data-save type="submit">Save</button>
          <button class="btn btn-sm btn-outline-secondary" data-cancel type="button">Cancel</button>
        </div>
        <div class="small text-muted" data-status></div>
      </form>
    </div>
  </div>`;
}

function wireAdminBlogRow(container){
  container.querySelectorAll('[data-blog-id]').forEach(box=>{
    const id = box.getAttribute('data-blog-id');
    const editBtn = box.querySelector('[data-edit]');
    const delBtn = box.querySelector('[data-del]');
    const formWrap = box.querySelector('[data-edit-form]');
    const form = box.querySelector('form.blog-edit-form');
    const statusEl = box.querySelector('[data-status]');
    editBtn.addEventListener('click', ()=>{ formWrap.classList.toggle('show'); });
    box.querySelector('[data-cancel]').addEventListener('click', ()=>{ formWrap.classList.remove('show'); });
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('Delete this post?')) return; 
      try { await blogFetch(`${BLOG_API}/${id}`, { method:'DELETE' }); await loadAdminBlog(); } catch(e){ alert(e.message||'Delete failed'); }
    });
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title').toString().trim(),
        slug: fd.get('slug').toString().trim(),
        excerpt: fd.get('excerpt').toString(),
        content: fd.get('content').toString(),
        category: fd.get('category').toString().trim() || null,
        require_login: fd.get('require_login') === 'on',
        status: fd.get('status')
      };
      try {
        await blogFetch(`${BLOG_API}/${id}`, { method:'PATCH', body: JSON.stringify(payload) });
        statusEl.textContent = 'Saved';
        setTimeout(()=>{ statusEl.textContent=''; }, 1200);
        await loadAdminBlog();
      } catch(e){ statusEl.textContent = e.message||'Save failed'; }
    });
  });
}

function wireBlogFilters(){
  const q = document.getElementById('blogAdminSearch');
  const cat = document.getElementById('blogAdminCategory');
  if (q) q.addEventListener('input', debounce(()=>{ blogState.q = q.value.trim(); loadAdminBlog(); }, 350));
  if (cat) cat.addEventListener('change', ()=>{ blogState.category = cat.value.trim(); loadAdminBlog(); });
  const refreshBtn = document.getElementById('refreshBlog');
  if (refreshBtn) refreshBtn.addEventListener('click', ()=> loadAdminBlog());
}

function wireBlog(){
  const form = document.getElementById('blogCreateForm');
  if(form){
    form.addEventListener('submit', async(e)=>{
      e.preventDefault();
      try{
        const body = {
          title: document.getElementById('blogTitle').value.trim(),
          slug: document.getElementById('blogSlug').value.trim(),
          excerpt: document.getElementById('blogExcerpt').value,
          content: document.getElementById('blogContent').value,
          category: document.getElementById('blogCategory')?.value.trim() || null,
          require_login: document.getElementById('blogRequireLogin').checked,
          status: document.getElementById('blogStatus').value
        };
        await blogFetch(BLOG_API, { method:'POST', body: JSON.stringify(body) });
        form.reset();
        await loadAdminBlog();
        alert('Post created');
      }catch(e){ alert(e.message || 'Create failed'); }
    });
  }
  wireBlogFilters();
  loadAdminBlog();
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
    // Initialize blog if blog pane exists
    if (document.getElementById('pane-blog')) {
      wireBlog();
      // Load blog posts immediately if tab is visible
      const blogTab = document.getElementById('tab-blog');
      const blogPane = document.getElementById('pane-blog');
      if (blogTab && blogPane) {
        // Listen for blog tab activation
        blogTab.addEventListener('shown.bs.tab', () => {
          console.log('Blog tab shown, loading posts...');
          loadAdminBlog();
        });
        // Check if blog tab is already active on page load
        if (blogTab.classList.contains('active') || blogPane.classList.contains('active') || blogPane.classList.contains('show')) {
          console.log('Blog tab already active, loading posts...');
          setTimeout(() => loadAdminBlog(), 100);
        }
      }
    }
    // Hydrate persisted notification read activity
    hydrateNotifReadEvents();
  });
})();

function debounce(fn, delay=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }

// =========================
// Contact Messages (Admin)
// =========================
const contactState = { page:1, pageSize:10, filter:'all', loading:false, current:null, cache:new Map() };

async function loadContactMessages(){
  if (contactState.loading) return; contactState.loading=true;
  const params = new URLSearchParams({ page:String(contactState.page), pageSize:String(contactState.pageSize) });
  if (contactState.filter==='unread') params.set('unread','true');
  const metaEl = document.getElementById('contactMeta'); if (metaEl) metaEl.textContent='Loading...';
  try {
    const res = await fetchJSON(`${API_BASE}/admin/contact?${params}`);
    renderContactList(res);
  } catch(e){ console.error('contact load failed', e); renderContactList({ data:[], page:contactState.page, pageSize:contactState.pageSize, total:0 }); }
  finally { contactState.loading=false; }
}

function renderContactList({ data=[], page, pageSize, total }){
  const tbody = document.getElementById('contactTbody'); if(!tbody) return;
  tbody.innerHTML='';
  data.forEach(row=>{
    contactState.cache.set(row.id, row);
    const tr = document.createElement('tr');
    tr.className = 'contact-row';
    if (!row.is_read) tr.classList.add('table-warning');
    tr.dataset.id = row.id;
    const subj = escapeHtml(truncate(row.subject||'', 60));
    const name = escapeHtml(row.name||'');
    const email = escapeHtml(row.email||'');
    const when = new Date(row.created_at).toLocaleString();
    tr.innerHTML = `<td>${row.id}</td><td>${name}</td><td>${email}</td><td class="${row.is_read?'':'fw-semibold'}">${subj}</td><td><span class="small text-muted">${when}</span></td><td><button class="btn btn-sm btn-outline-primary" data-open>Open</button></td>`;
    tbody.appendChild(tr);
  });
  if (!data.length) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="6" class="text-muted small">No messages</td>`; tbody.appendChild(tr);
  }
  // meta & total
  const start = (page-1)*pageSize + 1; const end = Math.min(page*pageSize, total);
  const metaEl = document.getElementById('contactMeta'); if (metaEl) metaEl.textContent = total? `${start}-${end}` : '0';
  const totalEl = document.getElementById('contactTotal'); if (totalEl) totalEl.textContent = `Total: ${total}`;
  // buttons
  document.getElementById('contactPrev')?.toggleAttribute('disabled', page<=1);
  document.getElementById('contactNext')?.toggleAttribute('disabled', end>=total);
  // row events
  tbody.querySelectorAll('tr.contact-row').forEach(tr=>{
    tr.addEventListener('click', (e)=>{ if (e.target.closest('[data-open]') || e.currentTarget===tr) { openContactDetail(Number(tr.dataset.id)); } });
  });
}

async function openContactDetail(id){
  let row = contactState.cache.get(id);
  const card = document.getElementById('contactDetailCard'); if (!card) return;
  // optimistic show if cached
  if (row){ contactState.current = row; updateContactDetail(row); }
  card.style.display='block';
  // fetch latest details
  try { const { data } = await fetchJSON(`${API_BASE}/admin/contact/${id}`); contactState.cache.set(id, data); contactState.current = data; updateContactDetail(data); highlightContactRow(id); }
  catch(e){ console.error('detail failed', e); }
}

function updateContactDetail(row){
  document.getElementById('contactDetailSubject').textContent = row.subject || '(No subject)';
  const meta = `${row.name||'Anon'} • ${row.email||''} • ${new Date(row.created_at).toLocaleString()}${row.is_read?'':' • Unread'}`;
  document.getElementById('contactDetailMeta').textContent = meta;
  document.getElementById('contactDetailBody').textContent = row.body || '';
  const btn = document.getElementById('contactMarkRead'); if (btn){ btn.disabled = !!row.is_read; }
}

function highlightContactRow(id){
  document.querySelectorAll('#contactTbody tr').forEach(tr=> tr.classList.remove('table-active'));
  const tr = document.querySelector(`#contactTbody tr[data-id="${id}"]`); if (tr) tr.classList.add('table-active');
}

async function markCurrentContactRead(){
  if (!contactState.current || contactState.current.is_read) return;
  const id = contactState.current.id;
  try { const { data } = await fetchJSON(`${API_BASE}/admin/contact/${id}/read`, { method:'POST', body: JSON.stringify({}) }); contactState.cache.set(id, data); contactState.current = data; updateContactDetail(data); // update row
    const tr = document.querySelector(`#contactTbody tr[data-id="${id}"]`); if (tr){ tr.classList.remove('table-warning'); const subjCell = tr.children[3]; subjCell?.classList.remove('fw-semibold'); }
  } catch(e){ alert(e.message||'Mark read failed'); }
}

function hideContactDetail(){ const card = document.getElementById('contactDetailCard'); if (card) card.style.display='none'; contactState.current=null; }

function initContactMessages(){
  if (!document.getElementById('pane-contact')) return;
  document.getElementById('contactFilter')?.addEventListener('change', (e)=>{ contactState.filter = e.target.value; contactState.page=1; loadContactMessages(); });
  document.getElementById('contactRefresh')?.addEventListener('click', ()=> loadContactMessages());
  document.getElementById('contactPrev')?.addEventListener('click', ()=>{ if (contactState.page>1){ contactState.page--; loadContactMessages(); }});
  document.getElementById('contactNext')?.addEventListener('click', ()=>{ contactState.page++; loadContactMessages(); });
  document.getElementById('contactMarkRead')?.addEventListener('click', markCurrentContactRead);
  document.getElementById('contactCloseDetail')?.addEventListener('click', hideContactDetail);
  loadContactMessages();
}

// Extend existing DOMContentLoaded hook for notifications to also init contacts
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{ if (document.getElementById('pane-contact')) initContactMessages(); });
})();

function truncate(str='', max=80){ return str.length>max ? str.slice(0,max-1)+'…' : str; }
