/**
 * Frontend Configuration Module
 * Provides environment-aware API base URLs and other config
 * Laravel Backend Integration
 */

// Detect environment and construct Laravel API base URL
const getApiBase = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering / build tools fall back to relative API path
    return process.env.FRONTEND_API_BASE || '/api';
  }
  const { protocol, hostname, port } = window.location;
  
  // Production environment (cPanel deployment)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Laravel serves from same origin on cPanel
    return `${protocol}//${hostname}/api`;
  }
  
  // Development environment
  // Laravel runs on port 8000 by default (php artisan serve)
  const laravelPort = window.__API_BASE__ || localStorage.getItem('LARAVEL_PORT') || '8000';
  
  // Allow override for different Laravel port
  if (/^\d+$/.test(laravelPort)) {
    return `${protocol}//${hostname}:${laravelPort}/api`;
  }
  
  // Fallback: assume Laravel on default port 8000
  return `${protocol}//${hostname}:8000/api`;
};

// Export configuration
export const API_BASE = getApiBase();

// WebSocket configuration for Laravel Broadcasting
// Development: Laravel WebSockets/Soketi on port 6001
// Production: Pusher or Soketi service
export const WS_BASE = API_BASE.replace('/api', '');
export const WS_PORT = 6001;

// Additional config
export const CONFIG = {
  API_BASE,
  WS_BASE,
  APP_NAME: 'KEOHAMS',
  VERSION: '1.0.0',
  
  // Feature flags
  FEATURES: {
    CHAT_ENABLED: true,
    KYC_ENABLED: true,
    BLOG_ENABLED: true,
    CURRENCY_CONVERTER: true
  },
  
  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100
  },
  
  // File upload limits
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_AVATAR_SIZE: 3 * 1024 * 1024, // 3MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  },
  
  // Cache durations (milliseconds)
  CACHE: {
    CATEGORIES: 5 * 60 * 1000, // 5 minutes
    PRODUCTS: 30 * 1000, // 30 seconds
    PROFILE: 60 * 1000 // 1 minute
  }
};

// Log configuration in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('[Config] API_BASE:', API_BASE);
  console.log('[Config] Environment:', 'development');
}

export default CONFIG;
