/**
 * Frontend Configuration Module
 * Provides environment-aware API base URLs and other config
 */

// Detect environment and construct API base URL
const getApiBase = () => {
  // Check if running in browser
  if (typeof window === 'undefined') {
    return 'http://localhost:4000/api';
  }

  const { protocol, hostname, port } = window.location;

  // Production detection (deployed domain)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Use same origin as frontend (assumes backend on same domain)
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  }

  // Development - check for custom port in localStorage or use default
  const customPort = localStorage.getItem('API_PORT');
  if (customPort) {
    return `${protocol}//${hostname}:${customPort}/api`;
  }

  // Default development
  return 'http://localhost:4000/api';
};

// Export configuration
export const API_BASE = getApiBase();

// WebSocket URL (for Socket.IO)
export const WS_BASE = API_BASE.replace('/api', '');

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
