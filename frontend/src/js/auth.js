const API_BASE = 'http://localhost:4000/api';

function saveToken(token) { localStorage.setItem('token', token); }
function getToken() { return localStorage.getItem('token'); }
function clearToken() { localStorage.removeItem('token'); }

async function me() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function login(email, password, twofa_token, recovery_code) {
  const payload = { email, password };
  if (twofa_token) payload.twofa_token = twofa_token;
  if (recovery_code) payload.recovery_code = recovery_code;
  const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const t = await res.json().catch(()=>({}));
    throw new Error(t.message || 'Invalid credentials');
  }
  const data = await res.json();
  if (data.twofa_required) {
    // Client should prompt for 2FA token (or recovery code) then call login again including twofa_token or recovery_code
    return { twofa_required: true, user_hint: data.user_hint };
  }
  saveToken(data.token);
  return { user: data.user };
}

async function verifySecondFactor(email, password, twofa_token, recovery_code) {
  const res = await fetch(`${API_BASE}/auth/verify-2fa`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password, twofa_token, recovery_code }) });
  if (!res.ok) { const t = await res.json().catch(()=>({})); throw new Error(t.message || '2FA failed'); }
  const data = await res.json();
  saveToken(data.token);
  return data.user;
}

async function register(payload) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    throw new Error(t.message || 'Registration failed');
  }
  return true;
}

export { saveToken, getToken, clearToken, me, login, verifySecondFactor, register };
