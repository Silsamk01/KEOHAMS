// Unified sidebar injection for user-facing pages
// Usage: include <div id="appSidebar" data-sidebar></div> then load this script (module) after body starts.
// It will inject the HTML and highlight the active link based on location.pathname.

const SIDEBAR_HTML = `
  <a class="navbar-brand fw-bold d-block mb-3 d-flex align-items-center gap-2" href="/">
    <img src="/keohamlogo.jpg" alt="KEOHAMS" class="brand-logo" />
    <span class="d-none d-sm-inline">KEOHAMS</span>
  </a>
  <nav class="nav nav-pills flex-column gap-1" id="dashNav">
    <a class="nav-link" data-path="/dashboard" data-pane="overview" href="/dashboard?pane=overview">Overview</a>
    <a class="nav-link" data-path="/dashboard" data-pane="shop" data-requires-kyc="true" href="/dashboard?pane=shop">
      Shop <span class="badge bg-warning text-dark ms-1 d-none" data-kyc-lock>🔒</span>
    </a>
    <a class="nav-link" data-path="/dashboard" data-pane="blog" data-requires-kyc="true" href="/dashboard?pane=blog">
      Blog <span class="badge bg-warning text-dark ms-1 d-none" data-kyc-lock>🔒</span>
    </a>
    <a class="nav-link" data-path="/chat" href="/chat">Chat</a>
    <a class="nav-link" data-path="/dashboard" data-pane="orders" data-requires-kyc="true" href="/dashboard?pane=orders">
      Orders <span class="badge bg-warning text-dark ms-1 d-none" data-kyc-lock>🔒</span>
    </a>
    <a class="nav-link d-flex align-items-center justify-content-between" data-path="/dashboard" data-pane="quotations" data-requires-kyc="true" href="/dashboard?pane=quotations">
      <span>Quotations <span class="badge bg-warning text-dark ms-1 d-none" data-kyc-lock>🔒</span></span>
      <span class="badge rounded-pill bg-warning text-dark ms-2 d-none" id="sbQuoPending">0</span>
    </a>
    <a class="nav-link" data-path="/dashboard" data-pane="notifications" href="/dashboard?pane=notifications">Notifications</a>
    <a class="nav-link" data-path="/dashboard" data-pane="settings" href="/dashboard?pane=settings">Settings</a>
    <button class="nav-link text-start" type="button" data-theme-toggle style="background:none; border:none;">Dark Mode</button>
    <a class="nav-link text-danger" id="globalSignOut" href="#">Sign out</a>
  </nav>`;

function setActive(){
  const path = location.pathname.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(location.search);
  let pane = params.get('pane') || 'overview';
  // Map non-dashboard routes to corresponding panes when linking in other pages
  if (path === '/shop') pane = 'shop';
  else if (path === '/blog' || path.startsWith('/blog/')) pane = 'blog';
  else if (path === '/chat') pane = 'chats';
  else if (path === '/notifications') pane = 'notifications';
  document.querySelectorAll('#dashNav .nav-link[data-path]').forEach(a=>{
    const target = a.getAttribute('data-path');
    const apane = a.getAttribute('data-pane');
    const isDash = target === '/dashboard';
    // Only consider dashboard links now; highlight by pane
    if ((apane||'overview') === pane) a.classList.add('active'); else a.classList.remove('active');
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

async function checkKYCAndLockFeatures() {
  try {
    const token = localStorage.getItem("token");
    
    // If no token, user is not logged in - check for features requiring authentication
    if (!token) {
      checkAuthRequiredFeatures();
      return;
    }

    const res = await fetch(`${window.location.origin}/api/user/profile?_=${Date.now()}` , {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });

    if (!res.ok) {
      checkAuthRequiredFeatures();
      return;
    }
    
    const data = await res.json();

  // Profile shape returns kyc at top-level e.g., { ..., kyc: { status: 'APPROVED' } }
  const kycStatus = data?.kyc?.status;
    const isApproved = kycStatus === "APPROVED";

    // Get all links that require KYC
    const protectedLinks = document.querySelectorAll('[data-requires-kyc="true"]');

    protectedLinks.forEach(link => {
      const lockBadge = link.querySelector('[data-kyc-lock]');

      if (!isApproved) {
        // Show lock badge
        if (lockBadge) lockBadge.classList.remove("d-none");

        // Add disabled styling
        link.classList.add("disabled", "text-muted");
        link.style.opacity = "0.6";
        link.style.cursor = "not-allowed";

        // Prevent navigation with highest priority event
        const blockClick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          let message = "🔒 KYC Verification Required";
          let detail = "Please complete KYC verification to access this feature.";

          if (kycStatus === "PENDING") {
            detail = "Your KYC submission is pending admin review. You'll get access once approved.";
          } else if (kycStatus === "REJECTED") {
            detail = "Your KYC was rejected. Please check your dashboard for details and resubmit.";
          } else if (!kycStatus || kycStatus === "NOT_SUBMITTED") {
            detail = "Go to your dashboard and click 'Start KYC Verification' to get started.";
          }

          alert(`${message}\n\n${detail}`);
          return false;
        };

        // Add multiple event listeners to ensure blocking
        link.addEventListener("click", blockClick, { capture: true });
        link.addEventListener("mousedown", blockClick, { capture: true });
      } else {
        // Hide lock badge for approved users
        if (lockBadge) lockBadge.classList.add("d-none");
        link.classList.remove("disabled", "text-muted");
        link.style.opacity = "1";
        link.style.cursor = "pointer";
      }
    });

    // Hard-lock navigation when KYC is rejected or resubmission required
    const requiresImmediateResubmission = kycStatus === 'REJECTED' || kycStatus === 'RESUBMIT_REQUIRED';
    if (requiresImmediateResubmission) {
      // If user is not already on the KYC page, send them there
      const here = location.pathname.replace(/\/$/, '');
      if (here !== '/kyc-enhanced' && here !== '/kyc-enhanced.html') {
        // Use replace to avoid creating back button loops
        location.replace('/kyc-enhanced');
      }

      // Intercept ALL sidebar links to keep user on KYC page until approved
      const allLinks = document.querySelectorAll('#dashNav .nav-link');
      const blockAll = function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        alert('KYC resubmission required. Please submit new documents to continue.');
        location.replace('/kyc-enhanced');
        return false;
      };
      allLinks.forEach(a => {
        // Allow sign out link to work
        if (a.id === 'globalSignOut') return;
        a.addEventListener('click', blockAll, { capture: true });
        a.addEventListener('mousedown', blockAll, { capture: true });
      });
    }
  } catch (err) {
    // Silent fail - KYC check is optional for sidebar rendering
    checkAuthRequiredFeatures();
  }
}

// For non-logged in users, prompt account creation instead of showing KYC requirements
function checkAuthRequiredFeatures() {
  // Get all links that would require authentication (KYC features need login first)
  const protectedLinks = document.querySelectorAll('[data-requires-kyc="true"]');

  protectedLinks.forEach(link => {
    const lockBadge = link.querySelector('[data-kyc-lock]');
    
    // Show lock badge
    if (lockBadge) lockBadge.classList.remove("d-none");

    // Add disabled styling
    link.classList.add("disabled", "text-muted");
    link.style.opacity = "0.6";
    link.style.cursor = "not-allowed";

    // Prevent navigation and prompt to create account
    const blockClick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const message = "🔒 Account Required";
      const detail = "Please create an account or sign in to access this feature.";

      if (confirm(`${message}\n\n${detail}\n\nWould you like to create an account now?`)) {
        window.location.href = '/register';
      }
      return false;
    };

    // Add multiple event listeners to ensure blocking
    link.addEventListener("click", blockClick, { capture: true });
    link.addEventListener("mousedown", blockClick, { capture: true });
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
    checkKYCAndLockFeatures(); // Enforce KYC restrictions on sidebar
    // Intercept clicks for dashboard pane links to keep single-page dashboard
    document.getElementById('dashNav')?.addEventListener('click', (e)=>{
      const link = e.target.closest('a.nav-link');
      if (!link) return;
      const path = link.getAttribute('data-path');
      const pane = link.getAttribute('data-pane');
      if (path === '/dashboard') {
        e.preventDefault();
        try {
          if (window.switchPane && pane) {
            window.switchPane('#pane-' + pane);
          } else {
            // Fallback: navigate with query param
            const url = new URL(location.href);
            url.pathname = '/dashboard';
            url.searchParams.set('pane', pane || 'overview');
            location.href = url.toString();
          }
        } catch(_){ /* fallback silently */ }
      }
    });
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
  // Keep any visible cart badges in sync across pages
  try {
    function cart_get(){ try { return JSON.parse(localStorage.getItem('cart')||'[]'); } catch(_) { return []; } }
    function updateAllCartBadges(){
      const items = cart_get();
      const n = items.reduce((s,i)=> s + Number(i.qty||0), 0);
      // Update any known cart count badges if present
      const ids = ['navCartCount','dashCartCount','shopCartCount','blogCartCount','chatCartCount','postCartCount'];
      ids.forEach(id=>{ const el = document.getElementById(id); if (el) el.textContent = String(n); });
    }
    updateAllCartBadges();
    window.addEventListener('cart:changed', updateAllCartBadges);
    window.addEventListener('storage', (e)=>{ if (e.key === 'cart') updateAllCartBadges(); });
  } catch(_){ }
  // Attempt to load pending quotations count (best-effort). Requires auth token.
  try {
    const t = localStorage.getItem('token');
    if(t){
      fetch(`${window.location.origin}/api/quotations/mine?page=1&pageSize=50`, { headers: { Authorization: 'Bearer '+t } })
        .then(r=> r.ok ? r.json(): Promise.reject())
        .then(j=>{
          const list = j.data||[];
            const pending = list.filter(q=> q.status==='REQUESTED' || q.status==='REPLIED').length;
            if(pending>0){ const badge = document.getElementById('sbQuoPending'); if(badge){ badge.textContent=String(pending); badge.classList.remove('d-none'); } }
        }).catch(()=>{});
    }
  } catch(_){ }
});
