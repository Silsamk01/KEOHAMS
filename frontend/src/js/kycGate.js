// Frontend KYC gating script
// Purpose: Prevent access to protected pages (shop, blog, chat, notifications, settings) if user KYC not approved.
// Behavior:
// 1. If no token: allow existing auth redirect scripts to handle.
// 2. Fetch /api/kyc/me. Cases:
//    - 404 or no submission: redirect to dashboard with from + reason
//    - status = APPROVED: allow page
//    - status = REJECTED or PENDING: redirect to dashboard KYC pane with status context.
// 3. Adds a small timeout fallback so page doesn't remain blank forever if API slow (shows a basic banner then continues to redirect).

const API_BASE = 'http://localhost:4000/api';
const KYC_CACHE_KEY = 'kycStatusCache';
function readKycCache(){
  try { const raw = sessionStorage.getItem(KYC_CACHE_KEY); if(!raw) return null; const obj = JSON.parse(raw); if(!obj) return null; if(Date.now() - (obj.ts||0) > 60_000) return null; return obj; } catch(_){ return null; }
}
function writeKycCache(status){ try { sessionStorage.setItem(KYC_CACHE_KEY, JSON.stringify({ status, ts: Date.now() })); } catch(_){ }
}
(function(){
  const token = localStorage.getItem('token');
  if (!token) return; // Let existing per-page auth checks handle sign-in redirect

  const gatedPages = ['/shop','/blog','/chat','/notifications','/settings','/orders'];
  const path = window.location.pathname.toLowerCase();
  if (!gatedPages.includes(path)) return; // Not a gated page

  let redirected = false;
  function go(reason, status){
    if (redirected) return; redirected = true;
    const params = new URLSearchParams({ from: path, reason, status: status||'' });
  window.location.href = `/dashboard?pane=kyc&${params.toString()}`;
  }

  // Fast path from cache: if cached APPROVED allow immediately (skip fetch)
  const cached = readKycCache();
  if(cached && cached.status === 'APPROVED') return; // full access
  if(cached && (cached.status === 'PENDING' || cached.status === 'REJECTED' || cached.status === 'NONE')) {
    // Gentle 120ms delay then redirect using cached reason while we still revalidate in background
    setTimeout(()=>{ if(!redirected){
      if(cached.status === 'PENDING') go('pending','PENDING');
      else if(cached.status === 'REJECTED') go('rejected','REJECTED');
      else go('no_submission');
    } },120);
  }

  // Safety: if API does not answer within 6s, redirect (unless already redirected from cache)
  const failTimer = setTimeout(()=>{ go('timeout'); }, 6000);

  fetch(`${API_BASE}/kyc/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async res => {
      clearTimeout(failTimer);
      if (res.status === 401) { return; } // Let normal auth flow handle sign out
      if (res.status === 404) { go('no_submission'); return; }
      if (!res.ok) { go('error_'+res.status); return; }
      return res.json();
    })
    .then(row => {
      if (!row) return; // Handled above or unauthorized
      writeKycCache(row.status || 'UNKNOWN');
      if (row.status === 'APPROVED') { return; }
      if (row.status === 'PENDING') { go('pending','PENDING'); return; }
      if (row.status === 'REJECTED') { go('rejected','REJECTED'); return; }
      // Any other unexpected state -> treat as not allowed
      go('unknown');
    })
    .catch(()=>{ go('network_error'); });
})();
