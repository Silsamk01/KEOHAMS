import { API_BASE } from './config.js';

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

// Get current user from token
function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  
  try {
    // Decode JWT token to get user info
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

// Check if user is authenticated
function isAuthenticated() {
  return !!getToken();
}

// Logout function
function logout() {
  // Clear all authentication data
  clearToken();
  localStorage.clear();
  sessionStorage.clear();
  
  // Clear any cached data
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  // Force page reload with no-cache to prevent browser from showing cached authenticated pages
  window.location.replace('/');
  // Prevent back button from accessing cached pages
  window.location.href = '/';
}

// Require authentication - redirect if not logged in
function requireAuth(redirectTo = '/') {
  if (!isAuthenticated()) {
    // Store the current page to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// Check if user is admin
async function isAdmin() {
  try {
    const user = await me();
    return user && user.role === 'admin';
  } catch {
    return false;
  }
}

// Require admin role
async function requireAdmin(redirectTo = '/') {
  if (!await isAdmin()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

export { 
  saveToken, 
  getToken, 
  clearToken, 
  me, 
  login, 
  verifySecondFactor, 
  register,
  getCurrentUser,
  isAuthenticated,
  logout,
  requireAuth,
  isAdmin,
  requireAdmin
};
