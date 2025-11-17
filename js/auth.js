import { API_BASE } from './config.js';

// UPDATED FOR LARAVEL SANCTUM
function saveToken(token) { localStorage.setItem('auth_token', token); }
function getToken() { return localStorage.getItem('auth_token'); }
function clearToken() { 
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_role');
}

async function me() {
  const token = getToken();
  if (!token) return null;
  // UPDATED: Laravel endpoint is /v1/me
  const res = await fetch(`${API_BASE}/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || data; // Handle both formats
}

async function login(email, password, twofa_token, recovery_code) {
  const payload = { email, password };
  if (twofa_token) payload.code = twofa_token; // UPDATED: Laravel uses 'code' parameter
  if (recovery_code) payload.recovery_code = recovery_code;
  const res = await fetch(`${API_BASE}/v1/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const t = await res.json().catch(()=>({}));
    throw new Error(t.message || 'Invalid credentials');
  }
  const data = await res.json();
  // UPDATED: Laravel returns requires_2fa instead of twofa_required
  if (data.requires_2fa || data.twofa_required) {
    return { twofa_required: true, requires_2fa: true, user_id: data.user_id, user_hint: data.user_hint };
  }
  // UPDATED: Save both token and user data
  saveToken(data.token);
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_name', `${data.user.first_name || ''} ${data.user.last_name || ''}`);
    localStorage.setItem('user_role', data.user.role || 'USER');
  }
  return { user: data.user };
}

async function verifySecondFactor(email, password, twofa_token, recovery_code, captchaToken, captchaAnswer) {
  // UPDATED: Laravel expects user_id and code
  const payload = { email, password };
  if (twofa_token) payload.code = twofa_token; // UPDATED: Laravel uses 'code'
  if (recovery_code) payload.recovery_code = recovery_code;
  if (captchaToken) payload.captchaToken = captchaToken;
  if (captchaAnswer) payload.captchaAnswer = captchaAnswer;
  
  const res = await fetch(`${API_BASE}/v1/verify-2fa`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) { const t = await res.json().catch(()=>({})); throw new Error(t.message || '2FA failed'); }
  const data = await res.json();
  // UPDATED: Save both token and user
  saveToken(data.token);
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_name', `${data.user.first_name || ''} ${data.user.last_name || ''}`);
    localStorage.setItem('user_role', data.user.role || 'USER');
  }
  return data.user;
}

async function register(payload) {
  const res = await fetch(`${API_BASE}/v1/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    throw new Error(t.message || 'Registration failed');
  }
  return true;
}

// Get current user from localStorage
// UPDATED: Laravel Sanctum doesn't use JWT, user data is stored separately
function getCurrentUser() {
  const userJson = localStorage.getItem('user');
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error parsing user data:', error);
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
// UPDATED: Check stored user data instead of async API call
function isAdmin() {
  const user = getCurrentUser();
  return user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
}

// Require admin role
function requireAdmin(redirectTo = '/') {
  if (!isAdmin()) {
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
