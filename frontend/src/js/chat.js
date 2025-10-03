const API_BASE = 'http://localhost:4000/api';

function token(){ return localStorage.getItem('token'); }

let socket;
let joinedThreadId = null;
let unreadPollTimer = null;
let isChatOpen = false;

function connectSocket() {
  if (socket && socket.connected) return socket;
  const t = token();
  if (!t) return null;
  // global io from script
  socket = window.io('http://localhost:4000', { auth: { token: t } });
  socket.on('connect_error', (err)=> console.warn('socket connect error', err.message));
  socket.on('message:new', async (payload)=>{
    // If message belongs to the joined thread, append
    if (payload?.thread_id === joinedThreadId) {
      appendMessage(payload.message);
      // If the chat modal is open on this thread, mark messages seen and sync badge
      if (isChatOpen) {
        try { await markSeen(joinedThreadId); } catch(_){ }
        try { const c = await fetchUnread(); setFabCount(c); if (c>0) setFabVisible(true); } catch(_){ }
      }
    }
  });
  // When admin sends a new message to the user (for any thread), bump unread badge if it's not the active thread
  socket.on('user:message:new', async (payload)=>{
    if (!payload) return;
    const isActive = payload.thread_id === joinedThreadId;
    if (!isActive) {
      // Increase badge immediately; also schedule a sync via API
      const badge = document.getElementById('chatFabBadge');
      if (badge) {
        const n = parseInt(badge.textContent || '0', 10) || 0; badge.textContent = String(n + 1);
        const fab = document.getElementById('chatFab'); if (fab) fab.style.display = 'inline-flex';
      }
      // soft sync after short delay to reflect accurate backend count
      setTimeout(async ()=>{ const c = await fetchUnread(); setFabCount(c); if (c>0) setFabVisible(true); }, 500);
    }
  });
  return socket;
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]+/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[ch])); }

function renderMessages(list){
  const box = document.getElementById('chatMessages');
  if (!box) return;
  box.innerHTML = '';
  list.forEach(m => appendMessage(m));
  box.scrollTop = box.scrollHeight;
}

async function hideMessageApi(message_id){
  const res = await fetch(`${API_BASE}/chats/messages/${message_id}/hide`, { method:'POST', headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Hide failed');
}

async function hideThreadApi(thread_id){
  const res = await fetch(`${API_BASE}/chats/threads/${thread_id}/hide`, { method:'POST', headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Hide failed');
}

function appendMessage(m){
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const mine = isMine(m);
  const wrap = document.createElement('div');
  wrap.className = `d-flex ${mine ? 'justify-content-end' : 'justify-content-start'}`;
  const bubble = document.createElement('div');
  bubble.className = `px-3 py-2 rounded-3 ${mine ? 'bg-primary text-white' : 'bg-light'}`;
  bubble.style.maxWidth = '80%';
  const time = new Date(m.created_at).toLocaleTimeString();
  bubble.innerHTML = `
    <div class="d-flex align-items-start gap-2">
      <div class="flex-grow-1">
        <div class="small">${escapeHtml(m.body)}</div>
        <div class="small text-muted mt-1">${time}</div>
      </div>
      <button class="btn btn-sm btn-link text-muted p-0" title="Delete for me" aria-label="Delete message" data-act="hide-msg" data-id="${m.id}">✕</button>
    </div>`;
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  // wire hide per message
  bubble.querySelector('[data-act="hide-msg"]').addEventListener('click', async (e)=>{
    e.stopPropagation();
    try { await hideMessageApi(m.id); wrap.remove(); } catch(_){ alert('Failed to delete message'); }
  });
  box.scrollTop = box.scrollHeight;
}

function isMine(m){ try { const t = JSON.parse(atob(token().split('.')[1])); return t && t.sub === m.sender_id; } catch(_) { return false; } }

async function startThreadForProduct(product_id, message){
  const res = await fetch(`${API_BASE}/chats/threads`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ product_id, message }) });
  if (!res.ok) throw new Error('Failed to start chat');
  const json = await res.json();
  return json.data;
}

async function startGeneralThread(subject='Chat with support', message){
  const payload = { subject }; if (message) payload.message = message;
  const res = await fetch(`${API_BASE}/chats/threads`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to start chat');
  const json = await res.json();
  return json.data;
}

async function loadMessages(thread_id){
  const res = await fetch(`${API_BASE}/chats/threads/${thread_id}/messages`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Failed to load messages');
  const json = await res.json();
  return json.data;
}

async function sendMessage(thread_id, body){
  const res = await fetch(`${API_BASE}/chats/threads/${thread_id}/messages`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ body }) });
  if (!res.ok) throw new Error('Failed to send');
  const json = await res.json();
  return json.data;
}

function openChatModal(){
  const el = document.getElementById('chatModal');
  const modal = new bootstrap.Modal(el);
  isChatOpen = true;
  // Reset flag when closed
  el.addEventListener('hidden.bs.modal', ()=>{ isChatOpen = false; }, { once: true });
  modal.show();
}

function wireChatInput(thread_id){
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  if (!input || !btn) return;
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    // Only send; rely on socket 'message:new' to render to avoid duplicate
    try { await sendMessage(thread_id, text); } catch (e) { console.warn(e); }
  };
  btn.onclick = send;
  input.onkeydown = (e)=>{ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
}

export async function openProductChat(product_id, initialMessage){
  const t = token(); if (!t) { window.location.href='/?#signin'; return; }
  const thread = await startThreadForProduct(product_id, initialMessage);
  const s = connectSocket();
  if (s) s.emit('thread:join', { thread_id: thread.id });
  joinedThreadId = thread.id;
  const msgs = await loadMessages(thread.id);
  renderMessages(msgs);
  wireChatInput(thread.id);
  wireChatHeader(thread.id);
  // Mark any existing messages as seen and sync badge right away
  try { await markSeen(thread.id); } catch(_){ }
  try { const c = await fetchUnread(); setFabCount(c); if (c>0) setFabVisible(true); } catch(_){ }
  openChatModal();
}

// ============ Floating widget ============
async function fetchUnread(){
  const t = token(); if (!t) return 0;
  try { const res = await fetch(`${API_BASE}/chats/unread-count`, { headers: { Authorization: `Bearer ${t}` } }); if (!res.ok) return 0; const j = await res.json(); return j.count||0; } catch(_) { return 0; }
}

async function markSeen(thread_id){
  const t = token(); if (!t) return;
  try { await fetch(`${API_BASE}/chats/threads/${thread_id}/mark-seen`, { method:'POST', headers: { Authorization: `Bearer ${t}` } }); } catch(_){ }
}

function setFabVisible(v){ const b = document.getElementById('chatFab'); if (b) b.style.display = v ? 'inline-flex':'none'; }
function setFabCount(n){ const el = document.getElementById('chatFabBadge'); if (el) el.textContent = String(n); }

export function initChatWidget(){
  const fab = document.getElementById('chatFab'); if (!fab) return;
  fab.addEventListener('click', async ()=>{
    // Open last thread if exists, otherwise list mine and open the most recent
    const t = token(); if (!t) { window.location.href='/?#signin'; return; }
    try {
      const res = await fetch(`${API_BASE}/chats/threads/mine`, { headers: { Authorization: `Bearer ${t}` } });
      const j = await res.json();
      let thread = j.data?.[0];
      if (!thread) {
        // create a general thread on first open
        thread = await startGeneralThread();
      }
      const s = connectSocket(); if (s) s.emit('thread:join', { thread_id: thread.id }); joinedThreadId = thread.id;
      const msgs = await loadMessages(thread.id);
      renderMessages(msgs);
      wireChatInput(thread.id);
      wireChatHeader(thread.id);
      await fetch(`${API_BASE}/chats/threads/${thread.id}/mark-seen`, { method:'POST', headers: { Authorization: `Bearer ${t}` } });
      openChatModal();
    } catch(_){}
  });

  // Start polling unread count and show button on first non-zero or if any thread exists
  (async ()=>{
    try {
      const t = token(); if (!t) return;
      // Always show FAB for logged-in users
      setFabVisible(true);
    } catch(_){}

    const tick = async ()=>{ const c = await fetchUnread(); if (c > 0) setFabVisible(true); setFabCount(c); };
    clearInterval(unreadPollTimer); unreadPollTimer = setInterval(tick, 15000);
    tick();
  })();
}

export async function openExistingThread(thread_id, { inModal=true } = {}){
  const t = token(); if (!t) { window.location.href='/?#signin'; return; }
  const s = connectSocket(); if (s) s.emit('thread:join', { thread_id }); joinedThreadId = thread_id;
  const msgs = await loadMessages(thread_id);
  renderMessages(msgs);
  wireChatInput(thread_id);
  wireChatHeader(thread_id);
  await markSeen(thread_id);
  if (inModal) openChatModal();
}

export async function fetchMyThreads(){
  const t = token(); if (!t) return [];
  try { const res = await fetch(`${API_BASE}/chats/threads/mine`, { headers: { Authorization: `Bearer ${t}` } }); const j = await res.json(); return j.data||[]; } catch(_){ return []; }
}

function wireChatHeader(thread_id){
  const btn = document.getElementById('chatHideThreadBtn');
  if (!btn) return;
  btn.onclick = async ()=>{
    if (!confirm('Hide this conversation from your view?')) return;
    try { await hideThreadApi(thread_id); joinedThreadId = null; const el = document.getElementById('chatModal'); const modal = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el); modal.hide(); }
    catch(_){ alert('Failed to hide conversation'); }
  };
}
