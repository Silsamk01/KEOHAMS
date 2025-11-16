import { API_BASE } from './config.js';
function getToken(){ return localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return t?{ Authorization:`Bearer ${t}` }:{}; }

async function fetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { 'Accept':'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) {
    const errorText = await res.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(errorText);
    }
    
    // Handle KYC-related errors
    if (errorData.requiresKYC) {
      handleKYCError(errorData);
      throw new Error('KYC_REQUIRED');
    }
    
    throw new Error(errorData.message || errorText);
  }
  return res.json();
}

function handleKYCError(errorData) {
  const kycStatus = errorData.kycStatus;
  let message = errorData.message || 'KYC verification required to access blog content.';
  let shouldRedirect = false;
  
  if (kycStatus === 'NOT_SUBMITTED') {
    message = '🔒 KYC Verification Required\n\nYou need to complete KYC verification to access blog content.\n\nClick OK to start the verification process.';
    shouldRedirect = true;
  } else if (kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW') {
    message = '⏳ KYC Pending Review\n\nYour KYC submission is under review by our admin team.\n\nYou will be notified once approved.';
  } else if (kycStatus === 'REJECTED') {
    message = '❌ KYC Rejected\n\nYour KYC submission was rejected.\n\nClick OK to resubmit with correct documents.';
    shouldRedirect = true;
  }
  
  alert(message);
  
  if (shouldRedirect) {
    window.location.href = errorData.redirectTo || '/kyc-enhanced';
  }
}

// State
let page = 1;
const pageSize = 12;
let loading = false;
let hasMore = true;
let posts = [];
let searchTerm = '';
let categoryFilter = '';
let io; // intersection observer

const gridEl = document.getElementById('postGrid');
const authNotice = document.getElementById('authRequiredNotice');
const emptyStateEl = document.getElementById('emptyState');
const sentinelEl = document.getElementById('infiniteSentinel');
const searchInput = document.getElementById('blogSearch');

function createSkeletonCards(count=6){
  return Array.from({length:count}).map(()=>`
    <div class="skeleton-card skeleton-anim">
      <div class="sk-line big w80"></div>
      <div class="sk-line w40"></div>
      <div class="sk-line w90"></div>
      <div class="sk-line w65"></div>
    </div>`).join('');
}

function render(){
  gridEl.innerHTML = posts.map(p => postCardHTML(p)).join('');
  emptyStateEl.classList.toggle('d-none', posts.length !== 0);
  // Update post count badge
  const countEl = document.getElementById('blogPostCount');
  if (countEl) countEl.textContent = posts.length;
}

function postCardHTML(p){
  const dateStr = p.published_at ? new Date(p.published_at).toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'}) : '';
  const excerpt = (p.excerpt || (p.content||'').replace(/\n+/g,' ').slice(0,140) || '').trim();
  const readTime = Math.max(1, Math.ceil((p.content || '').length / 1000));
  const isPrivate = p.require_login;
  
  return `<article class="enhanced-blog-card fade-in" role="article" tabindex="0" aria-label="${escapeHtml(p.title)}" onclick="location.href='/blog/${encodeURIComponent(p.slug)}'" onkeypress="if(event.key==='Enter'){location.href='/blog/${encodeURIComponent(p.slug)}'}">
    <div class="card-header">
      <div class="d-flex justify-content-between align-items-start">
        <div class="meta-info">
          <span class="date">${dateStr||'Draft'}</span>
          <span class="read-time">${readTime} min read</span>
        </div>
        ${isPrivate ? '<span class="privacy-badge"><i class="bi bi-lock-fill"></i> Private</span>' : '<span class="public-badge"><i class="bi bi-globe"></i> Public</span>'}
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(p.title)}</h3>
      <p class="card-excerpt">${escapeHtml(excerpt)}${excerpt.length >= 140 ? '...' : ''}</p>
    </div>
    <div class="card-footer">
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted">Click to read more</small>
        <i class="bi bi-arrow-right"></i>
      </div>
    </div>
  </article>`;
}

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));
}

async function loadNext(){
  if (loading || !hasMore) return;
  loading = true;
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.innerHTML = createSkeletonCards(6);
  skeletonWrapper.dataset.skeleton='1';
  gridEl.appendChild(skeletonWrapper);
  try {
    const params = new URLSearchParams({ page:String(page), pageSize:String(pageSize), meta:'1' });
    if (searchTerm) params.set('q', searchTerm);
    if (categoryFilter) params.set('category', categoryFilter);
    const data = await fetchJSON(`${API_BASE}/blog?${params.toString()}`);
    
    // Handle both direct array and {data, hasMore} response formats
    if (Array.isArray(data)) {
      hasMore = data.length === pageSize;
      posts = posts.concat(data);
    } else {
      hasMore = data.hasMore || false;
      posts = posts.concat(data.data || []);
    }
    page += 1;
  } catch(e){ 
    console.error('Failed to load page', e); 
    hasMore = false;
  }
  finally {
    skeletonWrapper.remove();
    render();
    loading = false;
  }
}

function refreshBlog(){
  posts = [];
  page = 1;
  hasMore = true;
  loadNext();
}

function setupInfiniteScroll(){
  io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        loadNext();
      }
    });
  }, { rootMargin: '200px 0px' });
  io.observe(sentinelEl);
}

function setupSearch(){
  let t; // debounce
  searchInput?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(()=>{
      searchTerm = searchInput.value.trim();
      // reset and reload server-side
      resetAndReload();
    }, 220);
  });
  const catInput = document.getElementById('blogCategoryFilter');
  if (catInput){
    let t2;
    catInput.addEventListener('input', () => {
      clearTimeout(t2);
      t2 = setTimeout(()=>{
        categoryFilter = catInput.value.trim();
        resetAndReload();
      }, 250);
    });
  }
}

function resetAndReload(){
  page = 1; hasMore = true; posts = []; gridEl.innerHTML='';
  loadNext();
}

function ensureAuthenticated(){
  try { const t = localStorage.getItem('token'); if(!t){ return false; } } catch(_) { return false; }
  return true;
}

function init(){
  if(!ensureAuthenticated()){
    if(authNotice){ authNotice.classList.remove('d-none'); }
    // Redirect to public version after short delay
    setTimeout(()=>{ window.location.replace('/blog-public'); }, 1200);
    return;
  }
  loadNext();
  setupInfiniteScroll();
  setupSearch();
  
  // Wire up refresh button
  const refreshBtn = document.getElementById('blogRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spinner-border spinner-border-sm"></i> Refreshing...';
      refreshBtn.disabled = true;
      refreshBlog();
      setTimeout(() => {
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
        refreshBtn.disabled = false;
      }, 1000);
    });
  }
}

init();

export {}; // ensures module context
import { initChatWidget } from './chat.js';
try { initChatWidget(); } catch(_){}
