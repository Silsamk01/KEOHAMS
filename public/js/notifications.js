/**
 * Real-time Notifications Handler
 * Handles WebSocket connections and real-time notification updates
 */

class NotificationManager {
    constructor() {
        this.apiUrl = '/api/v1';
        this.token = localStorage.getItem('auth_token');
        this.unreadCount = 0;
        this.notifications = [];
        this.preferences = {};
        this.echo = null;
        
        this.init();
    }

    /**
     * Initialize notification manager
     */
    async init() {
        await this.loadPreferences();
        await this.loadNotifications();
        await this.updateUnreadCount();
        this.setupEcho();
        this.setupEventListeners();
    }

    /**
     * Setup Laravel Echo for real-time notifications
     */
    setupEcho() {
        if (typeof Echo === 'undefined') {
            console.warn('Laravel Echo not loaded. Real-time notifications disabled.');
            return;
        }

        const userId = this.getUserId();
        if (!userId) return;

        try {
            // Listen for new notifications on private user channel
            this.echo = window.Echo.private(`user.${userId}`)
                .listen('.notification.sent', (data) => {
                    this.handleNewNotification(data);
                });

            console.log('Real-time notifications enabled');
        } catch (error) {
            console.error('Failed to setup Echo:', error);
        }
    }

    /**
     * Handle new notification received via WebSocket
     */
    handleNewNotification(notification) {
        // Add to notifications array
        this.notifications.unshift(notification);
        
        // Update unread count
        this.unreadCount++;
        this.updateUnreadBadge();

        // Show browser notification if permitted
        this.showBrowserNotification(notification);

        // Play notification sound
        this.playNotificationSound();

        // Trigger custom event for UI updates
        this.triggerNotificationEvent(notification);

        // Show toast notification
        this.showToast(notification);
    }

    /**
     * Load user notification preferences
     */
    async loadPreferences() {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/preferences`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.preferences = data.preferences || {};
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    }

    /**
     * Update notification preferences
     */
    async updatePreferences(preferences) {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/preferences`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ preferences })
            });

            if (response.ok) {
                this.preferences = preferences;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update preferences:', error);
            return false;
        }
    }

    /**
     * Load notifications from API
     */
    async loadNotifications(unreadOnly = false, limit = 50) {
        try {
            const url = unreadOnly 
                ? `${this.apiUrl}/notifications?unread=true&limit=${limit}`
                : `${this.apiUrl}/notifications?limit=${limit}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.data || [];
                return this.notifications;
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
        return [];
    }

    /**
     * Get unread notification count
     */
    async updateUnreadCount() {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.unreadCount = data.count || 0;
                this.updateUnreadBadge();
                return this.unreadCount;
            }
        } catch (error) {
            console.error('Failed to get unread count:', error);
        }
        return 0;
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Update local notification
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.is_read = true;
                    notification.read_at = new Date().toISOString();
                }
                
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateUnreadBadge();
                return true;
            }
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
        return false;
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/read-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Update all local notifications
                this.notifications.forEach(n => {
                    n.is_read = true;
                    n.read_at = new Date().toISOString();
                });
                
                this.unreadCount = 0;
                this.updateUnreadBadge();
                return true;
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
        return false;
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId) {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Remove from local array
                const index = this.notifications.findIndex(n => n.id === notificationId);
                if (index !== -1) {
                    const notification = this.notifications[index];
                    if (!notification.is_read) {
                        this.unreadCount = Math.max(0, this.unreadCount - 1);
                    }
                    this.notifications.splice(index, 1);
                    this.updateUnreadBadge();
                }
                return true;
            }
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
        return false;
    }

    /**
     * Get notification statistics
     */
    async getStatistics() {
        try {
            const response = await fetch(`${this.apiUrl}/notifications/statistics`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.statistics || {};
            }
        } catch (error) {
            console.error('Failed to get statistics:', error);
        }
        return {};
    }

    /**
     * Update unread badge in UI
     */
    updateUnreadBadge() {
        const badges = document.querySelectorAll('.notification-badge, [data-notification-badge]');
        badges.forEach(badge => {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    /**
     * Show browser notification
     */
    async showBrowserNotification(notification) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/images/logo.png',
                badge: '/images/badge.png',
                tag: `notification-${notification.id}`,
                requireInteraction: false,
                silent: false
            });
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.showBrowserNotification(notification);
            }
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound() {
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(err => {
                // Autoplay might be blocked
                console.log('Notification sound blocked:', err);
            });
        } catch (error) {
            console.error('Failed to play sound:', error);
        }
    }

    /**
     * Show toast notification
     */
    showToast(notification) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.innerHTML = `
            <div class="toast-header">
                <strong>${this.escapeHtml(notification.title)}</strong>
                <button type="button" class="close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="toast-body">
                ${this.escapeHtml(notification.message)}
            </div>
        `;

        // Add to page
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => toast.remove(), 5000);
    }

    /**
     * Trigger custom notification event
     */
    triggerNotificationEvent(notification) {
        const event = new CustomEvent('notification:received', {
            detail: notification
        });
        window.dispatchEvent(event);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Request notification permission on user interaction
        document.addEventListener('click', () => {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }, { once: true });
    }

    /**
     * Get user ID from token
     */
    getUserId() {
        if (!this.token) return null;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.sub || payload.user_id;
        } catch (error) {
            console.error('Failed to parse token:', error);
            return null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.echo) {
            this.echo.leave(`user.${this.getUserId()}`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}

// Initialize on page load
let notificationManager;
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('auth_token')) {
        notificationManager = new NotificationManager();
        window.notificationManager = notificationManager;
    }
});
