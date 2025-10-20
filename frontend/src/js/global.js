const API_BASE = 'http://localhost:4000/api';
function getToken(){ try { return localStorage.getItem('token'); } catch { return null; } }
function authHeaders(){ const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }
async function fetchJSON(url, opts={}){
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } });
  if (r.status === 401 || r.status === 404) {
    try { localStorage.removeItem('token'); } catch(_){ }
    if (!location.pathname.startsWith('/login') && location.pathname !== '/') {
      setTimeout(()=> { location.replace('/'); }, 50);
    }
  }
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}



async function loadAvatar(){
  const token = getToken(); if(!token) return hideAuthUI();
  try {
    const me = await fetchJSON(`${API_BASE}/auth/me`);
    document.querySelectorAll('[data-global-avatar]').forEach(img=>{ img.src = me.avatar_url || 'https://via.placeholder.com/48x48.png?text=U'; });
  } catch {
    // If 401/404 produced logout above, UI should hide
    hideAuthUI();
  }
}

async function loadUnread(){
  const token = getToken(); if(!token) { hideUnread(); return; }
  try {
    const { count } = await fetchJSON(`${API_BASE}/notifications/unread-count`);
    document.querySelectorAll('[data-unread-badge]').forEach(b=>{
      if(count>0){ b.textContent = count; b.classList.remove('d-none'); } else { b.classList.add('d-none'); }
    });
  } catch { hideUnread(); }
}

function hideAuthUI(){
  document.querySelectorAll('[data-auth-only]').forEach(el=> el.classList.add('d-none'));
}
function hideUnread(){
  document.querySelectorAll('[data-unread-badge]').forEach(b=> b.classList.add('d-none'));
}

function setupSocket(){
  const t = getToken(); if(!t || !window.io) return;
  try {
    const s = window.io('http://localhost:4000', { auth: { token: t } });
    s.on('notif:new', ()=> loadUnread());
  } catch(_){}
}

export async function refreshGlobalUI(){ await Promise.all([loadAvatar(), loadUnread()]); }

window.addEventListener('DOMContentLoaded', ()=>{ refreshGlobalUI(); setupSocket(); setInterval(loadUnread, 60000); });

// Gate links that require auth
document.addEventListener('click', (e)=>{
  const a = e.target.closest('a[data-requires-auth]');
  if(!a) return;
  if(!getToken()){
    e.preventDefault();
    // Redirect to sign-in modal (landing page hash) or root
    window.location.href='/?#signin';
  }
});

// Normalize notification link behavior across pages
document.addEventListener('click', (e)=>{
  const notifLink = e.target.closest('a[href="/notifications"]');
  if(!notifLink) return;
  e.preventDefault();
  // Require auth to view notifications
  if(!getToken()) { window.location.href='/?#signin'; return; }
  // If already on dashboard, switch pane directly when available
  if (window.location.pathname === '/dashboard' && typeof window.switchPane === 'function') {
    window.switchPane('#pane-notifications');
  } else {
    window.location.href = '/dashboard?pane=notifications';
  }
});

// ================= Theme Toggle =================
function applyTheme(theme){
  const root = document.documentElement; // html element
  if(theme === 'dark') { root.setAttribute('data-theme','dark'); }
  else { root.removeAttribute('data-theme'); }
  try { localStorage.setItem('theme', theme); } catch(_){}
  document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
    btn.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  });
}

function initTheme(){
  let stored = null; try { stored = localStorage.getItem('theme'); } catch(_){}
  if(!stored){
    // Prefer user OS scheme if not chosen
    stored = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(stored);
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-theme-toggle]');
    if(!btn) return;
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

initTheme();

// Prevent accessing protected pages via back button after sign-out (including BFCache restores)
window.addEventListener('pageshow', (event)=>{
  const token = getToken();
  const protectedPaths = ['/dashboard','/shop','/blog','/chat','/settings','/notifications','/cart'];
  const path = location.pathname.replace(/\/$/,'');
  if(!token && protectedPaths.includes(path)){
    // If page restored from BFCache or standard back navigation without token, force redirect
    if(event.persisted || document.visibilityState === 'visible'){
      location.replace('/');
    }
  }
});
