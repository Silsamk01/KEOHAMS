/**
 * API Utilities - Robust fetch wrappers with proper error handling
 * Prevents "Unexpected end of JSON input" errors
 */

import { API_BASE } from './config.js';

/**
 * Get authentication headers
 */
export function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Safe JSON parse - handles empty responses
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} Parsed JSON or empty object
 */
async function safeJsonParse(response) {
    const text = await response.text();
    
    // Empty response
    if (!text || text.trim() === '') {
        return {};
    }
    
    // Try to parse JSON
    try {
        return JSON.parse(text);
    } catch (error) {
        console.error('[API] Invalid JSON response:', text.substring(0, 100));
        
        // If it looks like HTML (error page), extract useful info
        if (text.trim().startsWith('<')) {
            const titleMatch = text.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'Server Error';
            throw new Error(`Server returned HTML: ${title}`);
        }
        
        // Otherwise, throw with the raw text
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
    }
}

/**
 * Robust fetch wrapper with error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiFetch(url, options = {}) {
    try {
        // Ensure URL is absolute
        const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? url : '/' + url}`;
        
        // Merge headers
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...getAuthHeaders(),
            ...(options.headers || {})
        };
        
        // Make request
        const response = await fetch(fullUrl, {
            ...options,
            headers
        });
        
        // Handle successful responses
        if (response.ok) {
            // For 204 No Content, return empty object
            if (response.status === 204) {
                return {};
            }
            
            return await safeJsonParse(response);
        }
        
        // Handle error responses
        let errorData;
        try {
            errorData = await safeJsonParse(response);
        } catch (parseError) {
            // If we can't parse error response, use status text
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Extract error message
        const errorMessage = errorData.message 
            || errorData.error 
            || errorData.errors 
            || `HTTP ${response.status}: ${response.statusText}`;
        
        throw new Error(errorMessage);
        
    } catch (error) {
        // Network error or other fetch failure
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Please check your internet connection');
        }
        
        // Re-throw the error
        throw error;
    }
}

/**
 * GET request
 * @param {string} url - API endpoint
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiGet(url, options = {}) {
    return apiFetch(url, {
        method: 'GET',
        ...options
    });
}

/**
 * POST request
 * @param {string} url - API endpoint
 * @param {Object} data - Request body
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiPost(url, data = null, options = {}) {
    return apiFetch(url, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
        ...options
    });
}

/**
 * PUT request
 * @param {string} url - API endpoint
 * @param {Object} data - Request body
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiPut(url, data = null, options = {}) {
    return apiFetch(url, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
        ...options
    });
}

/**
 * PATCH request
 * @param {string} url - API endpoint
 * @param {Object} data - Request body
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiPatch(url, data = null, options = {}) {
    return apiFetch(url, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
        ...options
    });
}

/**
 * DELETE request
 * @param {string} url - API endpoint
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiDelete(url, options = {}) {
    return apiFetch(url, {
        method: 'DELETE',
        ...options
    });
}

/**
 * Upload file(s)
 * @param {string} url - API endpoint
 * @param {FormData} formData - Form data with files
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiUpload(url, formData, options = {}) {
    // Don't set Content-Type - browser will set it with boundary for multipart/form-data
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {})
    };
    
    // Remove Content-Type if set
    delete headers['Content-Type'];
    
    return apiFetch(url, {
        method: 'POST',
        body: formData,
        ...options,
        headers
    });
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return !!localStorage.getItem('auth_token');
}

/**
 * Logout user
 */
export function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
}

/**
 * Handle API errors globally
 * @param {Error} error - Error object
 * @param {boolean} showAlert - Show alert to user
 */
export function handleApiError(error, showAlert = true) {
    console.error('[API Error]', error);
    
    // Handle specific error cases
    if (error.message.includes('401') || error.message.includes('Unauthenticated')) {
        console.warn('[API] User not authenticated, redirecting to login...');
        logout();
        return;
    }
    
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
        console.warn('[API] Access forbidden');
        if (showAlert) {
            alert('You do not have permission to perform this action.');
        }
        return;
    }
    
    if (error.message.includes('Network error')) {
        if (showAlert) {
            alert('Network error. Please check your internet connection and try again.');
        }
        return;
    }
    
    // Generic error
    if (showAlert) {
        alert(error.message || 'An error occurred. Please try again.');
    }
}

// Export default object with all functions
export default {
    apiFetch,
    apiGet,
    apiPost,
    apiPut,
    apiPatch,
    apiDelete,
    apiUpload,
    isAuthenticated,
    logout,
    handleApiError,
    getAuthHeaders
};
