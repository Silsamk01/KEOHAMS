/**
 * Global API Error Handler
 * Intercepts all fetch requests and handles common error scenarios
 */

(function() {
    'use strict';
    
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch with error handling
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch.apply(this, args);
            
            // Clone response for potential re-reading
            const clonedResponse = response.clone();
            
            // Check if response is OK
            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const contentType = response.headers.get('content-type');
                    
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await clonedResponse.json();
                        errorMessage = errorData.message || errorData.error || errorMessage;
                    } else {
                        const text = await clonedResponse.text();
                        if (text && !text.startsWith('<')) {
                            errorMessage = text;
                        }
                    }
                } catch (parseError) {
                    // Use default error message
                }
                
                // Handle 401 Unauthorized - redirect to login
                if (response.status === 401) {
                    console.warn('[API] Unauthorized - redirecting to login');
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/?signin=1';
                    throw new Error('Session expired. Please login again.');
                }
                
                // Handle 403 Forbidden
                if (response.status === 403) {
                    console.warn('[API] Forbidden access');
                }
                
                // Handle 404 Not Found
                if (response.status === 404) {
                    console.warn('[API] Resource not found:', args[0]);
                }
                
                // Handle 419 (CSRF Token Mismatch)
                if (response.status === 419) {
                    console.error('[API] CSRF token mismatch - reloading page');
                    window.location.reload();
                    throw new Error('Session expired. Reloading page...');
                }
                
                // Handle 500 Server Error
                if (response.status >= 500) {
                    console.error('[API] Server error:', errorMessage);
                    errorMessage = 'Server error. Please try again later.';
                }
            }
            
            return response;
            
        } catch (error) {
            // Network error or other fetch failure
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.error('[API] Network error:', args[0]);
                throw new Error('Network error. Please check your internet connection.');
            }
            
            throw error;
        }
    };
    
    // Enhance Response.json() to handle empty responses
    const originalJson = Response.prototype.json;
    Response.prototype.json = async function() {
        try {
            const text = await this.clone().text();
            
            // Handle empty response
            if (!text || text.trim() === '') {
                return {};
            }
            
            // Handle HTML response (error pages)
            if (text.trim().startsWith('<')) {
                console.error('[API] Received HTML instead of JSON:', text.substring(0, 200));
                
                // Try to extract error message from HTML
                const titleMatch = text.match(/<title>(.*?)<\/title>/i);
                const title = titleMatch ? titleMatch[1] : 'Server Error';
                
                throw new Error(`Server returned HTML page: ${title}`);
            }
            
            // Normal JSON parsing
            return await originalJson.call(this);
            
        } catch (error) {
            // If JSON parse fails, provide helpful error
            if (error.name === 'SyntaxError') {
                const text = await this.clone().text();
                console.error('[API] Invalid JSON response:', text.substring(0, 200));
                
                // Return empty object instead of throwing for better UX
                return {};
            }
            
            throw error;
        }
    };
    
    console.log('[API Error Handler] Initialized');
    
})();
