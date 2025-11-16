import { API_BASE } from './config.js';

async function fetchJSON(url){
  const r = await fetch(url, { headers:{'Accept':'application/json'} });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

let posts = [];
const grid = document.getElementById('publicBlogGrid');
const emptyEl = document.getElementById('publicBlogEmpty');
const searchInput = document.getElementById('publicBlogSearch');
let loading=false;

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function render(){
  if (posts.length === 0) {
    grid.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }
  
  emptyEl.classList.add('d-none');
  
  grid.innerHTML = posts.map(p => {
    const excerpt = escapeHtml((p.excerpt || (p.content||'').slice(0,150)).trim());
    const category = p.category || 'General';
    const readingTime = p.reading_minutes || Math.max(1, Math.ceil((p.content||'').split(/\s+/).length / 200));
    const views = p.view_count || 0;
    
    return `
      <article class="blog-card-enhanced fade-in" onclick="openPublicPost('${escapeHtml(p.slug)}')">        <div class="blog-card-cover">
          ${p.cover_image ? `<img src="${escapeHtml(p.cover_image)}" alt="${escapeHtml(p.title)}" loading="lazy" />` : ''}
        </div>
        <div class="blog-card-content">
          <span class="blog-card-category">${escapeHtml(category)}</span>
          <h3>${escapeHtml(p.title)}</h3>
          <p class="blog-card-excerpt">${excerpt}</p>
          <div class="blog-card-footer">
            <div class="blog-card-meta">
              <span>
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7"/><path d="M8 4v4l3 2"/></svg>
                ${readingTime} min
              </span>
              <span>
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                ${views}
              </span>
            </div>
            <span class="blog-card-arrow">→</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
  
  // Update stats
  updateStats();
}

function updateStats() {
  const totalPosts = posts.length;
  const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))].length;
  
  const totalPostsEl = document.getElementById('totalPosts');
  const totalViewsEl = document.getElementById('totalViews');
  const totalCategoriesEl = document.getElementById('totalCategories');
  
  if (totalPostsEl) totalPostsEl.textContent = totalPosts;
  if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString();
  if (totalCategoriesEl) totalCategoriesEl.textContent = categories || 1;
}

async function load(){
  if(loading) return; loading=true;
  try {
    const params = new URLSearchParams({ meta:'1', page:'1', pageSize:'40' });
    const term = searchInput?.value.trim(); if (term) params.set('q', term);
    // Use public blog API endpoint (no auth required)
    const data = await fetchJSON(`${API_BASE}/public/blog?${params.toString()}`);
    posts = data.data || [];
    render();
  } catch(e){ 
    console.error(e); 
    grid.innerHTML = '<div class="text-danger text-center py-5">Failed to load articles. Please try again later.</div>'; 
  }
  finally { loading=false; }
}

searchInput?.addEventListener('input', debounce(()=> load(), 300));
load();
document.getElementById('year').textContent = new Date().getFullYear();

function debounce(fn, d=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; }

// Open public post in a new page without authentication
window.openPublicPost = function(slug) {
  // Navigate to public post view page
  window.location.href = `/blog-public/${encodeURIComponent(slug)}`;
}
