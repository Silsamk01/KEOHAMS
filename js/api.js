/**
 * KEOHAMS API Configuration
 * Central configuration for all Laravel API endpoints
 */

// API Base URL
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api'
    : 'https://keohams.com/api';

// API Configuration
const API_CONFIG = {
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
};

// Authentication helpers
const getAuthToken = () => localStorage.getItem('auth_token');
const setAuthToken = (token) => localStorage.setItem('auth_token', token);
const removeAuthToken = () => localStorage.removeItem('auth_token');

const getAuthHeaders = () => ({
    ...API_CONFIG.headers,
    'Authorization': `Bearer ${getAuthToken()}`
});

// Generic API request handler
async function apiRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const config = {
        ...options,
        headers: {
            ...API_CONFIG.headers,
            ...(options.headers || {}),
            ...(options.auth !== false ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
        }
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            // Handle 401 Unauthorized
            if (response.status === 401) {
                removeAuthToken();
                window.location.href = '/pages/register.html';
                throw new Error('Session expired. Please login again.');
            }
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// API Endpoints
const API = {
    // Authentication
    auth: {
        register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data), auth: false }),
        login: (data) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data), auth: false }),
        logout: () => apiRequest('/auth/logout', { method: 'POST' }),
        verifyEmail: (token) => apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }), auth: false }),
        verify2FA: (userId, code) => apiRequest('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ user_id: userId, code }), auth: false }),
        resendVerification: () => apiRequest('/auth/resend-verification', { method: 'POST' }),
        forgotPassword: (email) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }), auth: false }),
        resetPassword: (data) => apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(data), auth: false }),
        getProfile: () => apiRequest('/auth/profile'),
        updateProfile: (data) => apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
        enable2FA: () => apiRequest('/auth/2fa/enable', { method: 'POST' }),
        disable2FA: (code) => apiRequest('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
    },

    // Products
    products: {
        getAll: (params = {}) => apiRequest(`/products?${new URLSearchParams(params)}`),
        getById: (id) => apiRequest(`/products/${id}`),
        search: (query) => apiRequest(`/products/search?query=${encodeURIComponent(query)}`),
        getByCategory: (categoryId) => apiRequest(`/products/category/${categoryId}`),
        getFeatured: () => apiRequest('/products/featured'),
    },

    // Categories
    categories: {
        getAll: () => apiRequest('/categories'),
        getById: (id) => apiRequest(`/categories/${id}`),
        getTree: () => apiRequest('/categories/tree'),
    },

    // Cart
    cart: {
        get: () => apiRequest('/cart'),
        add: (productId, quantity) => apiRequest('/cart/add', { 
            method: 'POST', 
            body: JSON.stringify({ product_id: productId, quantity }) 
        }),
        update: (itemId, quantity) => apiRequest(`/cart/items/${itemId}`, { 
            method: 'PUT', 
            body: JSON.stringify({ quantity }) 
        }),
        remove: (itemId) => apiRequest(`/cart/items/${itemId}`, { method: 'DELETE' }),
        clear: () => apiRequest('/cart/clear', { method: 'POST' }),
    },

    // Orders
    orders: {
        getAll: (params = {}) => apiRequest(`/orders?${new URLSearchParams(params)}`),
        getById: (id) => apiRequest(`/orders/${id}`),
        create: (data) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(data) }),
        cancel: (id) => apiRequest(`/orders/${id}/cancel`, { method: 'POST' }),
        track: (id) => apiRequest(`/orders/${id}/track`),
    },

    // KYC
    kyc: {
        submit: (formData) => apiRequest('/kyc/submit', { 
            method: 'POST', 
            body: formData,
            headers: {} // Let browser set Content-Type for FormData
        }),
        getStatus: () => apiRequest('/kyc/status'),
        getSubmission: (id) => apiRequest(`/kyc/submissions/${id}`),
    },

    // Quotations
    quotations: {
        getAll: (params = {}) => apiRequest(`/quotations?${new URLSearchParams(params)}`),
        getById: (id) => apiRequest(`/quotations/${id}`),
        create: (data) => apiRequest('/quotations', { method: 'POST', body: JSON.stringify(data) }),
        cancel: (id) => apiRequest(`/quotations/${id}/cancel`, { method: 'POST' }),
    },

    // Chat
    chat: {
        getThreads: (params = {}) => apiRequest(`/chat/threads?${new URLSearchParams(params)}`),
        getOrCreateThread: (participantId) => apiRequest('/chat/threads/get-or-create', { 
            method: 'POST', 
            body: JSON.stringify({ participant_id: participantId }) 
        }),
        getMessages: (threadId, page = 1) => apiRequest(`/chat/threads/${threadId}/messages?page=${page}`),
        sendMessage: (threadId, message, attachments = null) => apiRequest(`/chat/threads/${threadId}/messages`, { 
            method: 'POST', 
            body: JSON.stringify({ message, attachments }) 
        }),
        deleteMessage: (messageId) => apiRequest(`/chat/messages/${messageId}`, { method: 'DELETE' }),
        closeThread: (threadId) => apiRequest(`/chat/threads/${threadId}/close`, { method: 'POST' }),
    },

    // Notifications
    notifications: {
        getAll: (params = {}) => apiRequest(`/notifications?${new URLSearchParams(params)}`),
        getUnreadCount: () => apiRequest('/notifications/unread-count'),
        markAsRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'POST' }),
        markAllAsRead: () => apiRequest('/notifications/mark-all-read', { method: 'POST' }),
        delete: (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' }),
    },

    // Support
    support: {
        getTickets: (params = {}) => apiRequest(`/support/tickets?${new URLSearchParams(params)}`),
        getTicket: (id) => apiRequest(`/support/tickets/${id}`),
        createTicket: (data) => apiRequest('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
        replyTicket: (id, message, attachments = null) => apiRequest(`/support/tickets/${id}/reply`, { 
            method: 'POST', 
            body: JSON.stringify({ message, attachments }) 
        }),
        closeTicket: (id) => apiRequest(`/support/tickets/${id}/close`, { method: 'POST' }),
    },

    // Blog
    blog: {
        getPosts: (params = {}) => apiRequest(`/blog/posts?${new URLSearchParams(params)}`),
        getPost: (slug) => apiRequest(`/blog/posts/${slug}`),
        getPublicPosts: (params = {}) => apiRequest(`/blog/public/posts?${new URLSearchParams(params)}`, { auth: false }),
        getPublicPost: (slug) => apiRequest(`/blog/public/posts/${slug}`, { auth: false }),
    },

    // Affiliate
    affiliate: {
        register: (data) => apiRequest('/affiliate/register', { method: 'POST', body: JSON.stringify(data), auth: false }),
        login: (data) => apiRequest('/affiliate/login', { method: 'POST', body: JSON.stringify(data), auth: false }),
        getDashboard: () => apiRequest('/affiliate/dashboard'),
        getSales: (params = {}) => apiRequest(`/affiliate/sales?${new URLSearchParams(params)}`),
        getDownlines: () => apiRequest('/affiliate/downlines'),
        getCommissions: (params = {}) => apiRequest(`/affiliate/commissions?${new URLSearchParams(params)}`),
        requestWithdrawal: (amount) => apiRequest('/affiliate/withdrawals/request', { 
            method: 'POST', 
            body: JSON.stringify({ amount }) 
        }),
        getWithdrawals: (params = {}) => apiRequest(`/affiliate/withdrawals?${new URLSearchParams(params)}`),
    },

    // Settings
    settings: {
        getPublic: () => apiRequest('/settings/public', { auth: false }),
    },

    // Admin APIs (restricted)
    admin: {
        dashboard: {
            getStats: () => apiRequest('/admin/dashboard/stats'),
            getCharts: (period) => apiRequest(`/admin/dashboard/charts?period=${period}`),
        },
        users: {
            getAll: (params = {}) => apiRequest(`/admin/users?${new URLSearchParams(params)}`),
            getById: (id) => apiRequest(`/admin/users/${id}`),
            update: (id, data) => apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
            delete: (id) => apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
        },
        products: {
            create: (data) => apiRequest('/admin/products', { method: 'POST', body: JSON.stringify(data) }),
            update: (id, data) => apiRequest(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
            delete: (id) => apiRequest(`/admin/products/${id}`, { method: 'DELETE' }),
        },
        orders: {
            updateStatus: (id, status) => apiRequest(`/admin/orders/${id}/status`, { 
                method: 'POST', 
                body: JSON.stringify({ status }) 
            }),
            updateTracking: (id, trackingNumber) => apiRequest(`/admin/orders/${id}/tracking`, { 
                method: 'POST', 
                body: JSON.stringify({ tracking_number: trackingNumber }) 
            }),
        },
        kyc: {
            getAll: (params = {}) => apiRequest(`/admin/kyc?${new URLSearchParams(params)}`),
            getById: (id) => apiRequest(`/admin/kyc/${id}`),
            updateStatus: (id, status, remarks = null) => apiRequest(`/admin/kyc/${id}/status`, { 
                method: 'POST', 
                body: JSON.stringify({ status, remarks, rejection_reason: remarks }) 
            }),
        },
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API, API_CONFIG, getAuthToken, setAuthToken, removeAuthToken, getAuthHeaders, apiRequest };
}

// Make available globally
window.API = API;
window.API_CONFIG = API_CONFIG;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.removeAuthToken = removeAuthToken;
window.getAuthHeaders = getAuthHeaders;
window.apiRequest = apiRequest;
