const API_BASE = 'http://localhost:4000/api';
function getToken(){ return localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return t?{ Authorization:`Bearer ${t}` }:{}; }

function getParam(name){ return new URLSearchParams(location.search).get(name); }

async function fetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load(){
  const slug = getParam('slug');
  if (!slug) { document.body.innerHTML = '<div class="container py-4">Invalid URL.</div>'; return; }
  try {
    const post = await fetchJSON(`${API_BASE}/blog/slug/${encodeURIComponent(slug)}`);
    if (post.require_login && !getToken()) {
      document.getElementById('loginRequired').classList.remove('d-none');
      document.getElementById('postContent').innerHTML = '';
    }
    document.getElementById('postTitle').textContent = post.title;
    document.getElementById('postMeta').textContent = post.published_at ? new Date(post.published_at).toLocaleString() : '';
    document.getElementById('postContent').innerHTML = (post.content||'').replace(/\n/g,'<br/>');
  } catch(e){
    console.error(e);
    document.body.innerHTML = '<div class="container py-4 text-danger">Post not found or access denied.</div>';
  }
}

load();
