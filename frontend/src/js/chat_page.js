import { fetchMyThreads, initChatWidget, ensureSocket } from './chat.js';

const API_BASE = 'http://localhost:4000/api';
function token(){ return localStorage.getItem('token'); }

let activeThreadId = null;
let socket = null; // shared socket instance from chat module
let typingTimeout = null;
let lastEmittedTyping = 0;

function qs(id){ return document.getElementById(id); }

function escapeHtml(s){ return String(s||'').replace(/[&<>"']+/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[ch])); }

async function fetchJSON(url, opt){ const r = await fetch(url, opt); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }

async function loadThreads(){
  const list = qs('chatThreads'); if (!list) return;
  list.innerHTML = '<div class="p-2 text-muted small">Loading...</div>';
  const threads = await fetchMyThreads();
  if (!threads.length) { list.innerHTML = '<div class="p-2 small text-muted">No chats yet.</div>'; return; }
  list.innerHTML = '';
  threads.forEach(t => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
    a.textContent = t.subject || ('Product #' + (t.product_id||''));
    a.dataset.threadId = t.id;
    if (t.unread_count) {
      const span = document.createElement('span');
      span.className = 'badge bg-primary rounded-pill';
      span.textContent = t.unread_count;
      a.appendChild(span);
    }
    a.addEventListener('click', ()=> selectThread(t.id));
    if (t.id === activeThreadId) a.classList.add('active');
    list.appendChild(a);
  });
}

async function selectThread(thread_id){
  activeThreadId = thread_id;
  // openExistingThread already renders to modal; we'll adapt by loading messages ourselves for inline view
  const msgs = await loadMessages(thread_id);
  renderMessages(msgs);
  wireComposer();
  qs('chatHeader').textContent = 'Thread #' + thread_id;
  const hideBtn = qs('hideThreadBtn'); hideBtn.classList.remove('d-none'); hideBtn.onclick = () => hideThread(thread_id);
  markSeen(thread_id);
  highlightActive();
}

async function hideThread(thread_id){
  if (!confirm('Hide this conversation?')) return;
  try {
    await fetch(`${API_BASE}/chats/threads/${thread_id}/hide`, { method:'POST', headers: { Authorization: `Bearer ${token()}` } });
    if (activeThreadId === thread_id) {
      activeThreadId = null; qs('chatMessagesPane').innerHTML = ''; qs('chatHeader').textContent = 'Select a thread';
      qs('chatInput').disabled = true; qs('chatSendBtn').disabled = true;
    }
    loadThreads();
  } catch(e){ alert('Failed to hide'); }
}

function highlightActive(){
  const list = qs('chatThreads');
  list?.querySelectorAll('.list-group-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.includes('#'+activeThreadId)) btn.classList.add('active');
  });
}

async function loadMessages(thread_id){
  const res = await fetch(`${API_BASE}/chats/threads/${thread_id}/messages`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Failed to load messages');
  const json = await res.json();
  return json.data;
}

function renderMessages(list){
  const pane = qs('chatMessagesPane'); if(!pane) return;
  pane.innerHTML='';
  list.forEach(m => appendMessage(m));
  pane.scrollTop = pane.scrollHeight;
}

function appendMessage(m){
  const pane = qs('chatMessagesPane'); if(!pane) return;
  const mine = isMine(m);
  const wrap = document.createElement('div');
  wrap.className = 'd-flex ' + (mine ? 'justify-content-end' : 'justify-content-start');
  const bubble = document.createElement('div');
  bubble.className = 'px-3 py-2 rounded-3 ' + (mine ? 'bg-primary text-white' : 'bg-light');
  bubble.style.maxWidth='80%';
  const time = new Date(m.created_at).toLocaleTimeString();
  bubble.innerHTML = `<div class="small">${escapeHtml(m.body)}</div><div class="small text-muted mt-1">${time}</div>`;
  wrap.appendChild(bubble);
  pane.appendChild(wrap);
  pane.scrollTop = pane.scrollHeight;
}

function isMine(m){ try { const t = JSON.parse(atob(token().split('.')[1])); return t && t.sub === m.sender_id; } catch(_) { return false; } }

async function sendMessage(thread_id, body){
  const res = await fetch(`${API_BASE}/chats/threads/${thread_id}/messages`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ body }) });
  if (!res.ok) throw new Error('Failed to send');
  const json = await res.json();
  return json.data;
}

function wireComposer(){
  const input = qs('chatInput'); const btn = qs('chatSendBtn');
  input.disabled = false; btn.disabled = false; input.value='';
  const doSend = async ()=>{
    const text = input.value.trim(); if(!text) return;
    input.value='';
    try { await sendMessage(activeThreadId, text); } catch(e){ console.warn(e); }
    emitTypingStop();
  };
  btn.onclick = doSend;
  input.onkeydown = e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); doSend(); } };
  input.addEventListener('input', ()=> scheduleTypingEmit());
}

async function newGeneralThread(){
  const res = await fetch(`${API_BASE}/chats/threads`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ subject:'Chat with support' }) });
  if (!res.ok) { alert('Failed to start chat'); return; }
  const json = await res.json();
  await loadThreads();
  selectThread(json.data.id);
}

async function markSeen(thread_id){
  try { await fetch(`${API_BASE}/chats/threads/${thread_id}/mark-seen`, { method:'POST', headers: { Authorization: `Bearer ${token()}` } }); } catch(_){ }
}

function emitTypingStart(){
  const now = Date.now(); if (now - lastEmittedTyping < 1000) return; lastEmittedTyping = now;
  try { window.__chatSocket?.emit('typing:start', { thread_id: activeThreadId }); } catch(_){ }
}
function emitTypingStop(){ try { window.__chatSocket?.emit('typing:stop', { thread_id: activeThreadId }); } catch(_){ }
}
function scheduleTypingEmit(){ emitTypingStart(); clearTimeout(typingTimeout); typingTimeout = setTimeout(()=>emitTypingStop(), 2500); }

function setupSocket(){
  initChatWidget();
  socket = ensureSocket();
  // Listen for global events dispatched by chat.js
  window.addEventListener('chat:message', (e)=>{
    const payload = e.detail; if (!payload) return;
    if (payload.thread_id === activeThreadId) {
      appendMessage(payload.message);
      markSeen(activeThreadId);
    } else {
      bumpThreadUnread(payload.thread_id);
    }
  });
  window.addEventListener('chat:user:message', (e)=>{ const p = e.detail; if (!p) return; if (p.thread_id !== activeThreadId) bumpThreadUnread(p.thread_id); });
  window.addEventListener('chat:typing:start', (e)=>{ const { thread_id } = e.detail||{}; if (thread_id === activeThreadId) qs('chatTyping').style.display='block'; });
  window.addEventListener('chat:typing:stop', (e)=>{ const { thread_id } = e.detail||{}; if (thread_id === activeThreadId) qs('chatTyping').style.display='none'; });
}

function bumpThreadUnread(thread_id){
  const list = qs('chatThreads'); if(!list) return;
  const btn = list.querySelector(`.list-group-item[data-thread-id="${thread_id}"]`);
  if (btn) {
    let badge = btn.querySelector('.badge');
    if (!badge) { badge = document.createElement('span'); badge.className='badge bg-primary rounded-pill'; badge.textContent='1'; btn.appendChild(badge); }
    else { badge.textContent = String((parseInt(badge.textContent||'0',10)||0)+1); }
  } else {
    // If not present, reload threads soon
    setTimeout(()=>{ loadThreads(); }, 500);
  }
}

function wireLayout(){
  const burger = document.getElementById('dashBurger');
  const sidebar = document.getElementById('dashSidebar');
  const overlay = document.getElementById('dashOverlay');
  if (burger && sidebar && overlay) {
    const isMobile = ()=> window.matchMedia('(max-width: 767.98px)').matches;
    const openM = ()=>{ document.body.classList.add('sidebar-open'); overlay.classList.remove('d-none'); };
    const closeM = ()=>{ document.body.classList.remove('sidebar-open'); overlay.classList.add('d-none'); };
    burger.addEventListener('click', ()=>{ if (isMobile()) { if (document.body.classList.contains('sidebar-open')) closeM(); else openM(); } else { sidebar.classList.toggle('d-none'); } });
    overlay.addEventListener('click', closeM);
    window.addEventListener('resize', ()=>{ if (!isMobile()) closeM(); });
  }
  const signOut = document.getElementById('dashSignOut');
  signOut?.addEventListener('click', e=>{ e.preventDefault(); localStorage.removeItem('token'); localStorage.removeItem('cart'); location.href='/'; });
}

(async function init(){
  wireLayout();
  setupSocket();
  await loadThreads();
  document.getElementById('refreshThreadsBtn').addEventListener('click', loadThreads);
  document.getElementById('newGeneralThreadBtn').addEventListener('click', newGeneralThread);
})();
