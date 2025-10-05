const API_BASE = 'http://localhost:4000/api';
function getToken(){ try { return localStorage.getItem('token'); } catch { return null; } }
function authHeaders(){ const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }
async function fetchJSON(url){ const r = await fetch(url, { headers: authHeaders() }); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function loadGlobalAvatar(){
  const token = getToken(); if(!token) return; // only for logged-in users
  try {
    const me = await fetchJSON(`${API_BASE}/auth/me`);
    const url = me.avatar_url || 'https://via.placeholder.com/48x48.png?text=U';
    document.querySelectorAll('[data-global-avatar]').forEach(img=>{ img.src = url; });
  } catch(_){ /* ignore */ }
}
window.addEventListener('DOMContentLoaded', loadGlobalAvatar);
export { loadGlobalAvatar };
