const API_BASE = 'http://localhost:4000/api';
let kycApproved = false;

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
  document.querySelectorAll('#dashNav .nav-link').forEach(a => a.classList.remove('active'));
  document.querySelector(`#dashNav .nav-link[data-target="${id}"]`)?.classList.add('active');
}

function showKycModal() {
  const el = document.getElementById('kycRequiredModal');
  if (!el) return;
  if (window.bootstrap?.Modal) {
    new window.bootstrap.Modal(el).show();
  } else {
    el.classList.add('show');
    el.style.display = 'block';
  }
}

function hideKycModal() {
  const el = document.getElementById('kycRequiredModal');
  if (!el) return;
  if (window.bootstrap?.Modal) {
    const inst = window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el);
    inst.hide();
  } else {
    el.classList.remove('show');
    el.style.display = 'none';
  }
}

function updateNavGating() {
  document.querySelectorAll('#dashNav .nav-link').forEach(a => {
    const target = a.getAttribute('data-target');
    const isGatable = target && target !== '#pane-kyc' && target !== '#pane-overview';
    if (isGatable) {
      if (!kycApproved) {
        a.setAttribute('data-gated', 'true');
        a.classList.add('text-muted');
      } else {
        a.removeAttribute('data-gated');
        a.classList.remove('text-muted');
      }
    }
  });
}

async function loadKycStatus() {
  try {
    const row = await fetchJSON(`${API_BASE}/kyc/me`);
    const banner = document.getElementById('kycBanner');
    const statusEl = document.getElementById('kycStatus');
    if (!row) {
      kycApproved = false;
      banner.style.display = 'block';
      banner.className = 'alert alert-warning';
      banner.textContent = 'Your account is not verified. Please complete KYC to access all features.';
      statusEl.innerHTML = '<div class="alert alert-info">No submission yet. Please submit your documents.</div>';
      updateNavGating();
      return;
    }
    const status = row.status;
    if (status === 'APPROVED') {
      kycApproved = true;
      banner.style.display = 'none';
      statusEl.innerHTML = '<div class="alert alert-success">KYC approved. You have full access.</div>';
      document.getElementById('kycForm')?.classList.add('d-none');
    } else if (status === 'REJECTED') {
      kycApproved = false;
      banner.style.display = 'block';
      banner.className = 'alert alert-danger';
      banner.textContent = 'KYC rejected. Please resubmit your documents.';
      statusEl.innerHTML = `<div class="alert alert-danger">Rejected${row.review_notes?': '+row.review_notes:''}</div>`;
      document.getElementById('kycForm')?.classList.remove('d-none');
    } else {
      kycApproved = false;
      banner.style.display = 'block';
      banner.className = 'alert alert-warning';
      banner.textContent = 'KYC pending review by admin.';
      statusEl.innerHTML = '<div class="alert alert-warning">Pending review.</div>';
      document.getElementById('kycForm')?.classList.add('d-none');
    }
    updateNavGating();
  } catch (e) {
    console.error('kyc status failed', e);
  }
}

async function fetchNotifUnread(){
  try {
    const { count } = await fetchJSON(`${API_BASE}/notifications/unread-count`);
    const el = document.getElementById('dashNotifCount'); if (el) el.textContent = String(count);
  } catch(_){ }
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
    const elName = document.getElementById('dashUserName'); 
    if (elName) elName.textContent = me.name || 'User';
  } catch(_){ }
  try {
    const { count } = await fetchJSON(`${API_BASE}/orders/my/summary`);
    const el = document.getElementById('dashOrders'); 
    if (el) el.textContent = String(count);
  } catch(_){ }
}
// =============================
// KYC Camera Capture (photo/video)
// =============================
function setupKycCamera() {
  const btnPhoto = document.getElementById('btnUseCameraPhoto');
  const btnVideo = document.getElementById('btnUseCameraVideo');
  if (!btnPhoto && !btnVideo) return;

  let photoStream = null;
  let videoStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];

  const photoModalEl = document.getElementById('photoCaptureModal');
  const videoModalEl = document.getElementById('videoCaptureModal');
  const photoVideo = document.getElementById('photoPreview');
  const videoVideo = document.getElementById('videoPreview');

  async function startStream(forVideo=false) {
    const constraints = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: forVideo };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  }

  function stopTracks(stream) {
    try { stream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  }

  // Photo capture
  btnPhoto?.addEventListener('click', async ()=>{
    try {
      photoStream = await startStream(false);
      photoVideo.srcObject = photoStream;
      new bootstrap.Modal(photoModalEl).show();
    } catch (e) {
      alert('Could not access camera. Please allow camera permissions or use file upload.');
    }
  });

  photoModalEl?.addEventListener('hidden.bs.modal', ()=>{ stopTracks(photoStream); photoStream=null; });
  document.getElementById('btnCapturePhoto')?.addEventListener('click', ()=>{
    if (!photoStream) return;
    const trackSettings = photoStream.getVideoTracks()[0]?.getSettings?.() || {};
    const w = trackSettings.width || 1280; const h = trackSettings.height || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(photoVideo, 0, 0, w, h);
    canvas.toBlob((blob)=>{
      if (!blob) return;
      const file = new File([blob], 'portrait.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.getElementById('kycPortrait');
      if (input) input.files = dt.files;
      bootstrap.Modal.getInstance(photoModalEl)?.hide();
    }, 'image/jpeg', 0.92);
  });

  // Video capture
  btnVideo?.addEventListener('click', async ()=>{
    try {
      videoStream = await startStream(true);
      mediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      recordedChunks = [];
      mediaRecorder.ondataavailable = (e)=>{ if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = ()=>{
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const file = new File([blob], 'selfie.webm', { type: 'video/webm' });
        const dt = new DataTransfer(); dt.items.add(file);
        const input = document.getElementById('kycSelfieVideo');
        if (input) input.files = dt.files;
        stopTracks(videoStream); videoStream=null;
        const stopBtn = document.getElementById('btnStopVideo');
        const startBtn = document.getElementById('btnStartVideo');
        startBtn?.classList.remove('d-none');
        stopBtn?.classList.add('d-none');
        bootstrap.Modal.getInstance(videoModalEl)?.hide();
      };
      videoVideo.srcObject = videoStream;
      const startBtn = document.getElementById('btnStartVideo');
      const stopBtn = document.getElementById('btnStopVideo');
      startBtn?.classList.remove('d-none');
      stopBtn?.classList.add('d-none');
      new bootstrap.Modal(videoModalEl).show();
    } catch (e) {
      alert('Could not access camera/microphone. Please allow permissions or use file upload.');
    }
  });

  document.getElementById('btnStartVideo')?.addEventListener('click', ()=>{
    if (!mediaRecorder) return;
    recordedChunks = [];
    mediaRecorder.start();
    document.getElementById('btnStartVideo')?.classList.add('d-none');
    document.getElementById('btnStopVideo')?.classList.remove('d-none');
  });
  document.getElementById('btnStopVideo')?.addEventListener('click', ()=>{
    if (!mediaRecorder) return;
    mediaRecorder.stop();
  });
  videoModalEl?.addEventListener('hidden.bs.modal', ()=>{ try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch(_){ } stopTracks(videoStream); videoStream=null; });
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
      e.preventDefault();
      const target = a.getAttribute('data-target');
      if (a.getAttribute('data-gated') === 'true') {
        showKycModal();
        return;
      }
      if (target) switchPane(target);
    });
  });
  const goto = document.querySelector('[data-goto-kyc]');
  if (goto) goto.addEventListener('click', () => { hideKycModal(); switchPane('#pane-kyc'); });
  document.getElementById('dashSignOut').addEventListener('click', (e)=>{ 
    e.preventDefault(); 
    try { localStorage.removeItem('token'); localStorage.removeItem('cart'); } catch(_) {}
    try { if (history.replaceState) history.replaceState(null, document.title, window.location.pathname + window.location.search); } catch(_){}
    window.location.replace('/');
  });
}

function wireKycForm() {
  const form = document.getElementById('kycForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const portrait = document.getElementById('kycPortrait').files[0];
      const selfie = document.getElementById('kycSelfieVideo').files[0];
      const idFront = document.getElementById('kycIdFront').files[0];
      const idBack = document.getElementById('kycIdBack').files[0];
      if (!portrait || !selfie || !idFront) return alert('Portrait, selfie video and ID front are required');
      const fd = new FormData();
      fd.set('portrait', portrait);
      fd.set('selfie_video', selfie);
      fd.set('id_front', idFront);
      if (idBack) fd.set('id_back', idBack);
      const notes = document.getElementById('kycNotes').value.trim();
      if (notes) fd.set('notes', notes);
      const res = await fetch(`${API_BASE}/kyc/submit`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      alert('KYC submitted');
      await loadKycStatus();
    } catch (e) { alert(e.message || 'Submit failed'); }
  });
}

// Chat widget init
import { initChatWidget } from './chat.js';
import { fetchMyThreads, openExistingThread } from './chat.js';
import { } from './chat.js';

// ============ Dashboard Chats Pane ============
async function loadDashChatThreads(){
  const list = document.getElementById('dashChatThreads'); if (!list) return;
  list.innerHTML = '';
  const threads = await fetchMyThreads();
  if (!threads.length) { list.innerHTML = '<div class="small text-muted p-3">No chats yet.</div>'; return; }
  threads.forEach(th => {
    const btn = document.createElement('button');
    btn.className = 'list-group-item list-group-item-action text-start';
    btn.innerHTML = `<div class="fw-semibold">${escapeHtml(th.subject || th.product_title || 'Chat')}</div>
                     <div class="small text-muted">#${th.id}${th.product_title? ' · '+escapeHtml(th.product_title):''}</div>`;
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

(function init(){
  wireNav();
  wireKycForm();
  switchPane('#pane-overview');
  loadKycStatus();
  setupKycCamera();
  loadOverview();
  fetchNotifUnread();
  loadDashNotifs();
  renderCartBadge();
  document.getElementById('dashBellBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); switchPane('#pane-notifications'); loadDashNotifs(); });
  window.addEventListener('storage', (e)=>{ if (e.key==='cart') renderCartBadge(); });
  document.addEventListener('cart:changed', renderCartBadge);
  // Mark all read
  document.getElementById('dashMarkAll')?.addEventListener('click', async ()=>{
    try { await fetchJSON(`${API_BASE}/notifications/mark-all-read`, { method:'POST', body: JSON.stringify({}) }); fetchNotifUnread(); loadDashNotifs(); }
    catch(e){ alert(e.message||'Failed'); }
  });
  // Socket live updates for notifications
  try {
    if (window.io) {
      const t = getToken();
      if (t) {
        const s = window.io('http://localhost:4000', { auth: { token: t } });
        s.on('notif:new', ()=>{ fetchNotifUnread(); loadDashNotifs(); });
      }
    }
  } catch(_){ }
  // Poll unread every 30s
  setInterval(fetchNotifUnread, 30000);
  // Guard against back-forward cache showing authed UI after logout
  window.addEventListener('pageshow', function(event){
    const token = getToken();
    if (!token && event.persisted) { window.location.reload(); }
  });
  // Setup sidebar toggle
  setupSidebarToggle();
  // Initialize chat widget once DOM ready
  window.addEventListener('DOMContentLoaded', ()=>{ try { initChatWidget(); } catch(_){} });
})();
