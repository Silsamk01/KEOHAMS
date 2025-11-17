import { API_BASE } from './config.js';

function token(){ return localStorage.getItem('token'); }

let socket;
let joinedThreadId = null;
let unreadPollTimer = null;
let isChatOpen = false;
let typingTimeout = null;
let lastEmittedTyping = 0;

function connectSocket() {
  if (socket && socket.connected) return socket;
  const t = token();
  if (!t) return null;
  // global io from script
  socket = window.io(window.location.origin, { auth: { token: t } });
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
    // Broadcast globally for other pages (e.g. full chat page) regardless of active modal
    try { window.dispatchEvent(new CustomEvent('chat:message', { detail: payload })); } catch(_){ }
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
    try { window.dispatchEvent(new CustomEvent('chat:user:message', { detail: payload })); } catch(_){ }
  });
  // Typing indicators from others
  socket.on('typing:start', ({ thread_id, user_id }) => {
    if (thread_id !== joinedThreadId) return;
    const el = document.getElementById('chatTyping');
    if (el) el.style.display = 'block';
    try { window.dispatchEvent(new CustomEvent('chat:typing:start', { detail: { thread_id, user_id } })); } catch(_){ }
  });
  socket.on('typing:stop', ({ thread_id, user_id }) => {
    if (thread_id !== joinedThreadId) return;
    const el = document.getElementById('chatTyping');
    if (el) el.style.display = 'none';
    try { window.dispatchEvent(new CustomEvent('chat:typing:stop', { detail: { thread_id, user_id } })); } catch(_){ }
  });
  // Unread count push
  socket.on('unread:update', ({ count }) => {
    setFabCount(count || 0);
    if ((count||0) > 0) setFabVisible(true);
    try { window.dispatchEvent(new CustomEvent('chat:unread', { detail: { count } })); } catch(_){ }
  });
  socket.on('thread:update', (payload)=>{
    try { if (window.__chatThreadUpdate) window.__chatThreadUpdate(payload); } catch(_){}
    try { window.dispatchEvent(new CustomEvent('chat:thread:update', { detail: payload })); } catch(_){ }
  });
  return socket;
}

// Utility to ensure a connected socket and expose it to other modules
export function ensureSocket(){
  return connectSocket();
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]+/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[ch])); }

function renderMessages(list){
  const box = document.getElementById('chatMessages');
  if (!box) return;
  box.innerHTML = '';
  box.dataset.redirectNoticeShown = 'false'; // Reset redirect notice flag
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
  
  // Apply opacity and border to hidden messages
  if (m.is_hidden) {
    bubble.style.opacity = '0.5';
    bubble.style.border = '1px dashed #999';
  }
  
  const time = new Date(m.created_at).toLocaleTimeString();
  const hiddenLabel = m.is_hidden ? '<span class="badge bg-secondary" style="font-size:0.7em">Hidden</span> ' : '';
  bubble.innerHTML = `
    <div class="d-flex align-items-start gap-2">
      <div class="flex-grow-1">
        <div class="small">${hiddenLabel}${escapeHtml(m.body)}</div>
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
  
  // Auto-redirect to full chat page if conversation gets too long (in shop/embedded chat modals)
  checkChatHeightAndRedirect(box);
}

// Check if chat box height exceeds threshold and redirect to full chat page
function checkChatHeightAndRedirect(box){
  if (!box) return;
  const MAX_CHAT_HEIGHT = 400; // pixels - threshold for auto-redirect
  const MESSAGE_COUNT_THRESHOLD = 8; // or based on message count
  
  // Only apply to modal chat (not the full chat page)
  const isInModal = box.closest('.modal');
  if (!isInModal) return;
  
  // Check if we've already shown the redirect notice
  if (box.dataset.redirectNoticeShown === 'true') return;
  
  const messageCount = box.children.length;
  const boxHeight = box.scrollHeight;
  
  // If chat exceeds threshold, show redirect notice
  if (boxHeight > MAX_CHAT_HEIGHT || messageCount >= MESSAGE_COUNT_THRESHOLD) {
    box.dataset.redirectNoticeShown = 'true';
    
    // Create redirect notice
    const notice = document.createElement('div');
    notice.className = 'alert alert-info d-flex align-items-center justify-content-between mt-2 mb-0';
    notice.style.position = 'sticky';
    notice.style.bottom = '0';
    notice.style.zIndex = '10';
    notice.innerHTML = `
      <div class="flex-grow-1">
        <strong>💬 Conversation is getting long!</strong><br>
        <small>Continue in the full chat page for a better experience.</small>
      </div>
      <button class="btn btn-sm btn-primary ms-2" data-redirect-chat>Go to Chat Page</button>
    `;
    
    // Insert notice at the end of the modal body
    const modalBody = box.closest('.modal-body');
    if (modalBody) {
      modalBody.appendChild(notice);
      
      // Wire redirect button
      notice.querySelector('[data-redirect-chat]').addEventListener('click', ()=>{
        // Close the modal
        const modal = box.closest('.modal');
        if (modal) {
          const bsModal = bootstrap.Modal.getInstance(modal);
          if (bsModal) bsModal.hide();
        }
        // Redirect to full chat page
        window.location.href = '/chat';
      });
    }
  }
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
  const typingEl = document.getElementById('chatTyping'); if (typingEl) typingEl.style.display='none';
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    // Only send; rely on socket 'message:new' to render to avoid duplicate
    try { await sendMessage(thread_id, text); } catch (e) { console.warn(e); }
    // Stop typing indicator after send
    emitTypingStop(thread_id);
  };
  btn.onclick = send;
  input.onkeydown = (e)=>{ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  input.addEventListener('input', () => {
    scheduleTypingEmit(thread_id);
  });
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

function emitTypingStart(thread_id){
  const s = connectSocket(); if (!s) return;
  const now = Date.now();
  if (now - lastEmittedTyping > 1000) { // throttle
    s.emit('typing:start', { thread_id });
    lastEmittedTyping = now;
  }
}
function emitTypingStop(thread_id){
  const s = connectSocket(); if (!s) return;
  s.emit('typing:stop', { thread_id });
}
function scheduleTypingEmit(thread_id){
  emitTypingStart(thread_id);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(()=> emitTypingStop(thread_id), 2500);
}

export function initChatWidget(){
  const fab = document.getElementById('chatFab'); if (!fab) return;
  fab.addEventListener('click', openDefaultChat);

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

// Public helper to open (or create) the user's default/general chat thread.
export async function openDefaultChat(){
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
  } catch(e){ console.warn('Failed to open default chat', e); }
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
