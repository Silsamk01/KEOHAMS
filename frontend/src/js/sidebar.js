// Unified sidebar injection for user-facing pages
// Usage: include <div id="appSidebar" data-sidebar></div> then load this script (module) after body starts.
// It will inject the HTML and highlight the active link based on location.pathname.

const SIDEBAR_HTML = `
  <a class="navbar-brand fw-bold d-block mb-3 d-flex align-items-center gap-2" href="/">
    <img src="/keohamlogo.jpg" alt="KEOHAMS" class="brand-logo" />
    <span class="d-none d-sm-inline">KEOHAMS</span>
  </a>
  <nav class="nav nav-pills flex-column gap-1" id="dashNav">
    <a class="nav-link" data-path="/dashboard" data-pane="overview" href="/dashboard">Overview</a>
    <a class="nav-link" data-path="/shop" href="/shop">Shop</a>
    <a class="nav-link" data-path="/blog" href="/blog">Blog</a>
    <a class="nav-link" data-path="/chat" href="/chat">Chat</a>
    <a class="nav-link" data-path="/dashboard" data-pane="kyc" href="/dashboard?pane=kyc">KYC</a>
    <a class="nav-link" data-path="/dashboard" data-pane="orders" href="/dashboard?pane=orders">Orders</a>
    <a class="nav-link" data-path="/dashboard" data-pane="notifications" href="/dashboard?pane=notifications">Notifications</a>
    <a class="nav-link" data-path="/dashboard" data-pane="settings" href="/dashboard?pane=settings">Settings</a>
    <button class="nav-link text-start" type="button" data-theme-toggle style="background:none; border:none;">Dark Mode</button>
    <a class="nav-link text-danger" id="globalSignOut" href="#">Sign out</a>
  </nav>`;

function setActive(){
  const path = location.pathname.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(location.search);
  const pane = params.get('pane') || 'overview';
  document.querySelectorAll('#dashNav .nav-link[data-path]').forEach(a=>{
    const target = a.getAttribute('data-path');
    const apane = a.getAttribute('data-pane');
    const isDash = target === '/dashboard';
    if (!isDash) {
      if (target === path) a.classList.add('active'); else a.classList.remove('active');
    } else {
      if (path === '/dashboard' && (apane||'overview') === pane) a.classList.add('active'); else a.classList.remove('active');
    }
  });
}

function wireSignOut(){
  const btn = document.getElementById('globalSignOut');
  if(!btn) return;
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('cart');
      // Replace current history entry with a public page so back won't re-open protected content
      if (history.replaceState) {
        history.replaceState(null, document.title, '/');
      }
    } catch(_){ }
    // Small timeout allows BFCache pageshow guard to attach before navigation completes
    setTimeout(()=>{ location.href = '/'; }, 10);
  });
}

function ensureSidebar(){
  const host = document.querySelector('[data-sidebar]');
  if(!host) return;
  if(!host.dataset.injected){
    host.innerHTML = SIDEBAR_HTML;
    host.dataset.injected = '1';
    setActive();
    wireSignOut();
  }
}

function setupBurger(){
  const burger = document.getElementById('dashBurger');
  const sidebar = document.getElementById('dashSidebar');
  const overlay = document.getElementById('dashOverlay');
  if(!burger || !sidebar || !overlay) return;
  const isMobile = ()=> window.matchMedia('(max-width: 767.98px)').matches;
  const openM = ()=>{ document.body.classList.add('sidebar-open'); overlay.classList.remove('d-none'); };
  const closeM = ()=>{ document.body.classList.remove('sidebar-open'); overlay.classList.add('d-none'); };
  burger.addEventListener('click', ()=>{
    if (isMobile()) {
      document.body.classList.contains('sidebar-open') ? closeM() : openM();
    } else {
      sidebar.classList.toggle('d-none');
    }
  });
  overlay.addEventListener('click', closeM);
  window.addEventListener('resize', ()=>{ if(!isMobile()) closeM(); });
}

window.addEventListener('DOMContentLoaded', ()=>{
  ensureSidebar();
  setupBurger();
});
