/**
 * Authentication Guard
 * Include this script on any page that requires authentication
 * It will redirect unauthenticated users to the appropriate login page
 */

(function() {
    'use strict';
    
    // Get token from localStorage
    function getToken() {
        try {
            return localStorage.getItem('token');
        } catch (error) {
            return null;
        }
    }
    
    // Decode JWT token to get user info
    function decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            return JSON.parse(atob(payload));
        } catch (error) {
            return null;
        }
    }
    
    // Check if token is expired
    function isTokenExpired(token) {
        const decoded = decodeToken(token);
        if (!decoded || !decoded.exp) return true;
        
        const now = Math.floor(Date.now() / 1000);
        return decoded.exp < now;
    }
    
    // Main authentication check
    function checkAuth() {
        const token = getToken();
        
        // No token found - redirect to login
        if (!token) {
            redirectToLogin();
            return false;
        }
        
        // Token expired - clear and redirect
        if (isTokenExpired(token)) {
            try {
                localStorage.removeItem('token');
            } catch (error) {
                // Silent fail
            }
            redirectToLogin();
            return false;
        }
        
        // Token exists and is valid
        return true;
    }
    
    // Redirect to appropriate login page
    function redirectToLogin() {
        const currentPath = window.location.pathname;
        
        // Store current URL for redirect after login
        try {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
        } catch (error) {
            // Silent fail
        }
        
        // Determine which login page to use
        if (currentPath.includes('/affiliate')) {
            window.location.replace('/affiliate-login');
        } else if (currentPath.includes('/admin')) {
            window.location.replace('/?signin=1');
        } else {
            window.location.replace('/?signin=1');
        }
    }
    
    // Verify token with server (async)
    async function verifyTokenWithServer() {
        const token = getToken();
        if (!token) return false;
        
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Token invalid on server - clear and redirect
                localStorage.removeItem('token');
                redirectToLogin();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }
    
    // Initial check - runs immediately
    if (!checkAuth()) {
        // Hide page content to prevent flash
        document.body.style.display = 'none';
        return;
    }
    
    // Server verification - runs after page load
    document.addEventListener('DOMContentLoaded', async () => {
        const isValid = await verifyTokenWithServer();
        if (!isValid) {
            document.body.style.display = 'none';
        }
    });
    
    // Check auth on page show (handles back button navigation)
    window.addEventListener('pageshow', (event) => {
        if (!checkAuth()) {
            document.body.style.display = 'none';
        }
    });
    
    // Check auth on visibility change (handles tab switching)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (!checkAuth()) {
                document.body.style.display = 'none';
            }
        }
    });
    
    // Export for use in modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            checkAuth,
            verifyTokenWithServer,
            getToken,
            decodeToken,
            isTokenExpired
        };
    }
})();
