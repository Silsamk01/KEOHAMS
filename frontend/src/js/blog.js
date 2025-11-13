import { API_BASE } from './config.js';
function getToken(){ return localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return t?{ Authorization:`Bearer ${t}` }:{}; }

async function fetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

import { initChatWidget } from './chat.js';

async function load(){
  try {
    const posts = await fetchJSON(`${API_BASE}/blog`);
    const list = document.getElementById('postList');
    if (!posts.length) {
      list.innerHTML = '<div class="text-muted">No posts yet.</div>';
      return;
    }
    list.innerHTML = posts.map(p => `
      <div class=\"card post-card p-3\" onclick=\"location.href='/blog/${encodeURIComponent(p.slug)}'\">
        <h2 class="h5 mb-1">${p.title}</h2>
        <div class="small text-muted">${p.published_at ? new Date(p.published_at).toLocaleString() : ''}${p.require_login? ' · 🔒 Login required':''}</div>
        <p class="mb-0 mt-2">${(p.excerpt||'').slice(0,160)}</p>
      </div>
    `).join('');
  } catch(e){
    console.error(e);
    document.getElementById('postList').innerHTML = '<div class="text-danger">Failed to load posts.</div>';
  }
}

load();
try { initChatWidget(); } catch(_){}
