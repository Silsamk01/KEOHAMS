import { API_BASE } from './config.js';

async function fetchJSON(url){
  const r = await fetch(url, { headers:{'Accept':'application/json'} });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function getSlugFromPath(){
  const m = location.pathname.match(/\/blog-public\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));
}

function renderContent(md){
  let html = md
    .replace(/```([\s\S]*?)```/g, (m, code)=>`<pre><code>${escapeHtml(code)}</code></pre>`)
    .replace(/^### (.*)$/gm,'<h3>$1</h3>')
    .replace(/^## (.*)$/gm,'<h2>$1</h2>')
    .replace(/^# (.*)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/\n\n+/g,'</p><p>');
  html = '<p>' + html + '</p>';
  return html;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildMeta(post){
  const meta = [];
  if (post.published_at) {
    meta.push(`<span>
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
      ${formatDate(post.published_at)}
    </span>`);
  }
  
  const readingTime = post.reading_minutes || Math.max(1, Math.ceil((post.content||'').split(/\s+/).length / 200));
  meta.push(`<span>
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="8" r="7"/><path d="M8 4v4l3 2"/>
    </svg>
    ${readingTime} min read
  </span>`);
  
  if (post.view_count) {
    meta.push(`<span>
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
      </svg>
      ${post.view_count} views
    </span>`);
  }
  
  return meta.join('');
}

async function load(){
  const slug = getSlugFromPath();
  if (!slug) { 
    document.getElementById('postContent').innerHTML = '<div class="text-center text-danger py-5">Invalid URL.</div>'; 
    return; 
  }
  
  try {
    // Use public API endpoint (no authentication required)
    const post = await fetchJSON(`${API_BASE}/public/blog/slug/${encodeURIComponent(slug)}`);
    
    document.getElementById('postTitle').textContent = post.title;
    document.getElementById('postMeta').innerHTML = buildMeta(post);
    document.getElementById('postContent').innerHTML = renderContent(post.content||'');
    
    if (post.category) {
      document.getElementById('categoryBadge').innerHTML = `<span class="category-badge">${escapeHtml(post.category)}</span>`;
    }
    
    injectSeoMeta(post);
    loadRelated(slug);
    
  } catch(e){
    console.error(e);
    document.getElementById('postContent').innerHTML = `
      <div class="text-center py-5">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
        </svg>
        <h3 class="mt-3 text-danger">Post Not Found</h3>
        <p class="text-muted">The article you're looking for doesn't exist or has been removed.</p>
        <a href="/blog-public" class="btn btn-primary mt-3">Back to Blog</a>
      </div>
    `;
  }
}

async function loadRelated(currentSlug){
  try {
    const resp = await fetchJSON(`${API_BASE}/public/blog?page=1&pageSize=3&meta=1`);
    const related = (resp.data||[]).filter(p => p.slug !== currentSlug).slice(0,3);
    const container = document.getElementById('relatedPosts');
    if (!container || related.length === 0) return;
    
    container.innerHTML = related.map(p => `
      <div class="related-card" onclick="window.location.href='/blog-public/${encodeURIComponent(p.slug)}'">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml((p.excerpt||'').slice(0,100))}...</p>
        <div style="margin-top: 1rem; font-size: 0.875rem; color: #9ca3af;">
          ${p.published_at ? formatDate(p.published_at) : ''}
        </div>
      </div>
    `).join('');
  } catch(e){
    console.warn('Related posts failed', e);
  }
}

// SEO Meta Injection
function ensureTag(selector, createCb){
  let el = document.head.querySelector(selector);
  if (!el) { el = createCb(); document.head.appendChild(el); }
  return el;
}

function plainTextExcerpt(html, max=180){
  const tmp = document.createElement('div'); tmp.innerHTML = html || '';
  const text = (tmp.textContent||'').replace(/\s+/g,' ').trim();
  return text.length>max ? text.slice(0,max-1).trim() + '…' : text;
}

function injectSeoMeta(post){
  if (!post || !post.title) return;
  const canonicalUrl = window.location.origin + '/blog-public/' + encodeURIComponent(post.slug);
  const description = post.excerpt ? post.excerpt : plainTextExcerpt(post.content||'');
  const siteName = 'KEOHAMS';
  const title = `${post.title} · ${siteName}`;
  document.title = title;
  
  ensureTag("link[rel='icon']", ()=>{ const l=document.createElement('link'); l.setAttribute('rel','icon'); l.type='image/jpeg'; l.href='/keohamlogo.jpg'; return l; });
  ensureTag("link[rel='apple-touch-icon']", ()=>{ const l=document.createElement('link'); l.setAttribute('rel','apple-touch-icon'); l.href='/keohamlogo.jpg'; return l; });
  
  const descTag = ensureTag("meta[name='description']", ()=>{ const m=document.createElement('meta'); m.name='description'; return m; });
  descTag.setAttribute('content', description);
  
  ensureTag("link[rel='canonical']", ()=>{ const l=document.createElement('link'); l.rel='canonical'; l.href=canonicalUrl; return l; }).href = canonicalUrl;
  
  const ogPairs = {
    'og:title': title,
    'og:description': description,
    'og:type': 'article',
    'og:url': canonicalUrl,
    'og:site_name': siteName,
  };
  Object.entries(ogPairs).forEach(([p,v])=>{
    const tag = ensureTag(`meta[property='${p}']`, ()=>{ const m=document.createElement('meta'); m.setAttribute('property', p); return m; });
    tag.setAttribute('content', v);
  });
  
  const ogImg = ensureTag("meta[property='og:image']", ()=>{ const m=document.createElement('meta'); m.setAttribute('property','og:image'); return m; });
  ogImg.setAttribute('content', post.cover_image || (window.location.origin + '/keohamlogo.jpg'));
  
  const twPairs = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': post.cover_image || (window.location.origin + '/keohamlogo.jpg')
  };
  Object.entries(twPairs).forEach(([name,val])=>{
    const tag = ensureTag(`meta[name='${name}']`, ()=>{ const m=document.createElement('meta'); m.setAttribute('name', name); return m; });
    tag.setAttribute('content', val);
  });
  
  if (post.published_at) {
    const pub = ensureTag("meta[property='article:published_time']", ()=>{ const m=document.createElement('meta'); m.setAttribute('property','article:published_time'); return m; });
    pub.setAttribute('content', new Date(post.published_at).toISOString());
  }
  if (post.updated_at) {
    const mod = ensureTag("meta[property='article:modified_time']", ()=>{ const m=document.createElement('meta'); m.setAttribute('property','article:modified_time'); return m; });
    mod.setAttribute('content', new Date(post.updated_at).toISOString());
  }
}

load();
document.getElementById('year').textContent = new Date().getFullYear();
