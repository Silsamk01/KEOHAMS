const API_BASE = 'http://localhost:4000/api';

async function fetchJSON(url){
  const r = await fetch(url, { headers:{'Accept':'application/json'} });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

let posts = [];
const grid = document.getElementById('publicBlogGrid');
const emptyEl = document.getElementById('publicBlogEmpty');
const searchInput = document.getElementById('publicBlogSearch');
const categoryInput = document.getElementById('publicBlogCategory');
let loading=false;

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));
}

function render(){
  grid.innerHTML = posts.map(p => {
    const dateStr = p.published_at ? new Date(p.published_at).toLocaleDateString(undefined,{month:'short', day:'numeric'}) : '';
    return `<article class="blog-card" onclick="location.href='/blog/${encodeURIComponent(p.slug)}'">
      <div class="meta"><span>${dateStr}</span></div>
      <h2>${escapeHtml(p.title)}</h2>
      <p>${escapeHtml((p.excerpt || (p.content||'').slice(0,140)).trim())}</p>
    </article>`;
  }).join('');
  emptyEl.classList.toggle('d-none', posts.length>0);
}

async function load(){
  if(loading) return; loading=true;
  try {
    const params = new URLSearchParams({ meta:'1', page:'1', pageSize:'40' });
    const term = searchInput?.value.trim(); if (term) params.set('q', term);
    const cat = categoryInput?.value.trim(); if (cat) params.set('category', cat);
    const data = await fetchJSON(`${API_BASE}/blog?${params.toString()}`);
    posts = data.data.filter(p => !p.require_login);
    render();
  } catch(e){ console.error(e); grid.innerHTML = '<div class="text-danger">Failed to load.</div>'; }
  finally { loading=false; }
}

searchInput?.addEventListener('input', debounce(()=> load(), 250));
categoryInput?.addEventListener('input', debounce(()=> load(), 300));
load();
document.getElementById('year').textContent = new Date().getFullYear();

function debounce(fn, d=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; }
