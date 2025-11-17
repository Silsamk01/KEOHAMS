import { API_BASE } from './config.js';

async function verify() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const flow = params.get('flow') || 'pending';
  const statusEl = document.getElementById('status');
  if (!token) { statusEl.textContent = 'Missing token'; return; }
  try {
    const res = await fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}&flow=${encodeURIComponent(flow)}`, { cache: 'no-store' });
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      throw new Error(t.message || `Verification failed (${res.status})`);
    }
    const body = await res.json().catch(()=>({}));
    if (body && body.token) {
      localStorage.setItem('token', body.token);
      statusEl.className = 'alert alert-success';
      statusEl.textContent = 'Email verified! Redirecting to your dashboard...';
      setTimeout(() => { window.location.href = '/dashboard'; }, 800);
    } else {
      statusEl.className = 'alert alert-success';
      statusEl.textContent = 'Email verified! You can now sign in.';
      setTimeout(() => { window.location.href = '/#signin'; }, 1200);
    }
  } catch (e) {
    statusEl.className = 'alert alert-danger';
    statusEl.textContent = e.message || 'Verification failed.';
  }
}

window.addEventListener('DOMContentLoaded', verify);
