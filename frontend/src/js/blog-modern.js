const API_BASE = 'http://localhost:4000/api';
function getToken(){ return localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return t?{ Authorization:`Bearer ${t}` }:{}; }

async function fetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { 'Accept':'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
}

function postCardHTML(p){
  const dateStr = p.published_at ? new Date(p.published_at).toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'}) : '';
  const excerpt = (p.excerpt || (p.content||'').replace(/\n+/g,' ').slice(0,160) || '').trim();
  return `<article class="blog-card fade-in" role="article" tabindex="0" aria-label="${escapeHtml(p.title)}" onclick="location.href='/blog/${encodeURIComponent(p.slug)}'" onkeypress="if(event.key==='Enter'){location.href='/blog/${encodeURIComponent(p.slug)}'}">
    <div class="meta"><span>${dateStr||''}</span>${p.require_login?'<span class="lock" title="Login required">🔒</span>':''}</div>
    <h2>${escapeHtml(p.title)}</h2>
    <p>${escapeHtml(excerpt)}</p>
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
    hasMore = data.hasMore;
    posts = posts.concat(data.data);
    page += 1;
  } catch(e){ console.error('Failed to load page', e); }
  finally {
    skeletonWrapper.remove();
    render();
    loading = false;
  }
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
}

init();

export {}; // ensures module context
import { initChatWidget } from './chat.js';
try { initChatWidget(); } catch(_){}
