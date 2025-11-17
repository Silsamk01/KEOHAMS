import { API_BASE } from './config.js';

function getToken() { return localStorage.getItem('token'); }
function clearToken() { localStorage.removeItem('token'); }

// Check if user is authenticated with affiliate token
function isAuthenticated() {
    const token = getToken();
    if (!token) return false;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check if token is affiliate type
        return payload.type === 'affiliate' || payload.role === 'AFFILIATE';
    } catch {
        return false;
    }
}

// Get current affiliate from token
function getCurrentAffiliate() {
    const token = getToken();
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch {
        return null;
    }
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
    window.location.replace('/affiliate-login');
    // Prevent back button from accessing cached pages
    window.location.href = '/affiliate-login';
}

// Require authentication
function requireAuth(redirectTo = '/affiliate-login') {
    if (!isAuthenticated()) {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

export {
    getToken,
    clearToken,
    isAuthenticated,
    getCurrentAffiliate,
    logout,
    requireAuth,
    API_BASE
};