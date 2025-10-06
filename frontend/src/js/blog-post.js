const API_BASE = 'http://localhost:4000/api';
function getToken(){ return localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return t?{ Authorization:`Bearer ${t}` }:{}; }

function getSlugFromPath(){
  const m = location.pathname.match(/\/blog\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function readingTime(text){
  const words = (text||'').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function formatDateTime(dt){
  if(!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'}) + ' · ' + d.toLocaleTimeString(undefined,{hour:'2-digit', minute:'2-digit'});
}

function buildMeta(post){
  const meta = [];
  if (post.published_at) meta.push(formatDateTime(post.published_at));
  meta.push(readingTime(post.content||''));
  if (post.require_login) meta.push('LOGIN REQUIRED');
  return meta.map(m=>`<span>${m}</span>`).join('');
}

async function load(){
  const slug = getSlugFromPath();
  if (!slug) { document.body.innerHTML = '<div class="container py-4">Invalid URL.</div>'; return; }
  try {
    const post = await fetchJSON(`${API_BASE}/blog/slug/${encodeURIComponent(slug)}`);
    const gated = post.require_login && !getToken();
    if (gated) {
      document.getElementById('loginRequired').classList.remove('d-none');
    }
    document.getElementById('postTitle').textContent = post.title;
    document.getElementById('postMeta').innerHTML = buildMeta(post);
    if (!gated) {
      document.getElementById('postContent').innerHTML = renderContent(post.content||'');
    }
    injectSeoMeta(post);
    setupShare(post);
    loadRelated(slug);
  } catch(e){
    console.error(e);
    document.body.innerHTML = '<div class="container py-4 text-danger">Post not found or access denied.</div>';
  }
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

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','<':'&lt;'}[c]||c));
}

function setupShare(post){
  const container = document.getElementById('shareButtons');
  const url = location.href;
  container?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-share]');
    if (!btn) return;
    const mode = btn.getAttribute('data-share');
    if (mode === 'copy') {
      navigator.clipboard?.writeText(url).then(()=>{ btn.textContent='✔ Copied'; setTimeout(()=>btn.textContent='🔗 Copy', 1800); });
    } else if (mode === 'tw') {
      const text = encodeURIComponent(post.title + ' ' + url);
      window.open(`https://twitter.com/intent/tweet?text=${text}`,'_blank','noopener');
    } else if (mode === 'ln') {
      const shareUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
      window.open(shareUrl,'_blank','noopener');
    }
  });
}

async function loadRelated(currentSlug){
  try {
    const resp = await fetchJSON(`${API_BASE}/blog?page=1&pageSize=3&meta=1`);
    const related = (resp.data||[]).filter(p => p.slug !== currentSlug).slice(0,3);
    const container = document.getElementById('relatedPosts');
    container.innerHTML = related.map(p => `<div class="blog-card" onclick="location.href='/blog/${encodeURIComponent(p.slug)}'">
      <div class="meta">${p.published_at ? new Date(p.published_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : ''}</div>
      <h2>${escapeHtml(p.title)}</h2>
      <p>${escapeHtml((p.excerpt||'').slice(0,100))}</p>
    </div>`).join('');
  } catch(e){
    console.warn('Related posts failed', e);
  }
}

load();

// ============= SEO META INJECTION =============
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
  const canonicalUrl = window.location.origin + '/blog/' + encodeURIComponent(post.slug);
  const description = post.excerpt ? post.excerpt : plainTextExcerpt(post.content||'');
  const siteName = 'KEOHAMS';
  const title = `${post.title} · ${siteName}`;
  document.title = title;
  // Favicon / icon (using provided JPG)
  ensureTag("link[rel='icon']", ()=>{ const l=document.createElement('link'); l.setAttribute('rel','icon'); l.type='image/jpeg'; l.href='/keohamlogo.jpg'; return l; });
  ensureTag("link[rel='apple-touch-icon']", ()=>{ const l=document.createElement('link'); l.setAttribute('rel','apple-touch-icon'); l.href='/keohamlogo.jpg'; return l; });
  // Standard description
  const descTag = ensureTag("meta[name='description']", ()=>{ const m=document.createElement('meta'); m.name='description'; return m; });
  descTag.setAttribute('content', description);
  // Canonical
  ensureTag("link[rel='canonical']", ()=>{ const l=document.createElement('link'); l.rel='canonical'; l.href=canonicalUrl; return l; }).href = canonicalUrl;
  // Open Graph
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
  // Provide image (logo as default). Could be extended to per-post hero later.
  const ogImg = ensureTag("meta[property='og:image']", ()=>{ const m=document.createElement('meta'); m.setAttribute('property','og:image'); return m; });
  ogImg.setAttribute('content', window.location.origin + '/keohamlogo.jpg');
  // Twitter
  const twPairs = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': window.location.origin + '/keohamlogo.jpg'
  };
  Object.entries(twPairs).forEach(([name,val])=>{
    const tag = ensureTag(`meta[name='${name}']`, ()=>{ const m=document.createElement('meta'); m.setAttribute('name', name); return m; });
    tag.setAttribute('content', val);
  });
  // Article specific meta (publish & modify times) if available
  if (post.published_at) {
    const pub = ensureTag("meta[property='article:published_time']", ()=>{ const m=document.createElement('meta'); m.setAttribute('property','article:published_time'); return m; });
    pub.setAttribute('content', new Date(post.published_at).toISOString());
  }
  if (post.updated_at) {
    const mod = ensureTag("meta[property='article:modified_time']", ()=>{ const m=document.createElement('meta'); m.setAttribute('property','article:modified_time'); return m; });
    mod.setAttribute('content', new Date(post.updated_at).toISOString());
  }
}

