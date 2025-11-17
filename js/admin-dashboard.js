// Admin Dashboard Module for KEOHAMS
// Handles admin analytics, charts, statistics, and user management

import { api } from './api.js';
import { showNotification, showLoading, hideLoading, formatCurrency, formatNumber } from './utils.js';

export const AdminDashboard = {
    charts: {},
    refreshInterval: null,

    /**
     * Initialize admin dashboard
     */
    async initialize() {
        await this.loadDashboardStats();
        this.setupRefreshInterval();
        this.setupEventListeners();
    },

    /**
     * Load comprehensive dashboard statistics
     */
    async loadDashboardStats() {
        try {
            const response = await api.get('/admin/dashboard/stats');

            if (response.success) {
                this.renderOverviewStats(response.data.overview);
                this.renderRevenueStats(response.data.revenue);
                this.renderOrderStats(response.data.orders);
                this.renderUserStats(response.data.users);
                this.renderProductStats(response.data.products);
                this.renderRecentActivities(response.data.recent_activities);
            }
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
            showNotification('Failed to load dashboard statistics', 'error');
        }
    },

    /**
     * Render overview statistics
     */
    renderOverviewStats(stats) {
        const container = document.getElementById('overviewStats');
        if (!container) return;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card revenue-card">
                    <div class="stat-icon">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatCurrency(stats.total_revenue)}</h3>
                        <p>Total Revenue</p>
                        <span class="stat-change">
                            ${formatCurrency(stats.today_revenue)} today
                        </span>
                    </div>
                </div>

                <div class="stat-card orders-card">
                    <div class="stat-icon">
                        <i class="fas fa-shopping-cart"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatNumber(stats.total_orders)}</h3>
                        <p>Total Orders</p>
                        <span class="stat-change">
                            ${stats.pending_orders} pending
                        </span>
                    </div>
                </div>

                <div class="stat-card users-card">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatNumber(stats.total_users)}</h3>
                        <p>Total Users</p>
                        <span class="stat-change">
                            ${stats.new_users_today} new today
                        </span>
                    </div>
                </div>

                <div class="stat-card products-card">
                    <div class="stat-icon">
                        <i class="fas fa-box"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatNumber(stats.total_products)}</h3>
                        <p>Total Products</p>
                        <span class="stat-change ${stats.out_of_stock > 0 ? 'warning' : ''}">
                            ${stats.out_of_stock} out of stock
                        </span>
                    </div>
                </div>

                <div class="stat-card kyc-card">
                    <div class="stat-icon">
                        <i class="fas fa-id-card"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatNumber(stats.pending_kyc)}</h3>
                        <p>Pending KYC</p>
                        <span class="stat-change">
                            ${stats.approved_kyc} approved
                        </span>
                    </div>
                </div>

                <div class="stat-card tickets-card">
                    <div class="stat-icon">
                        <i class="fas fa-ticket-alt"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatNumber(stats.open_tickets)}</h3>
                        <p>Open Tickets</p>
                        <span class="stat-change">
                            ${stats.pending_tickets} pending
                        </span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render revenue statistics
     */
    renderRevenueStats(stats) {
        const container = document.getElementById('revenueDetails');
        if (!container) return;

        container.innerHTML = `
            <div class="revenue-details">
                <div class="revenue-item">
                    <span class="label">Today:</span>
                    <span class="value">${formatCurrency(stats.today)}</span>
                </div>
                <div class="revenue-item">
                    <span class="label">Yesterday:</span>
                    <span class="value">${formatCurrency(stats.yesterday)}</span>
                </div>
                <div class="revenue-item">
                    <span class="label">This Week:</span>
                    <span class="value">${formatCurrency(stats.this_week)}</span>
                </div>
                <div class="revenue-item">
                    <span class="label">This Month:</span>
                    <span class="value">${formatCurrency(stats.this_month)}</span>
                </div>
                <div class="revenue-item">
                    <span class="label">Last 30 Days:</span>
                    <span class="value">${formatCurrency(stats.last_30_days)}</span>
                </div>
                <div class="revenue-item highlight">
                    <span class="label">Avg Order Value:</span>
                    <span class="value">${formatCurrency(stats.average_order_value)}</span>
                </div>
            </div>
        `;
    },

    /**
     * Render order statistics
     */
    renderOrderStats(stats) {
        const container = document.getElementById('orderStats');
        if (!container) return;

        const total = stats.total || 1;
        
        container.innerHTML = `
            <div class="order-stats">
                <div class="stat-row">
                    <span>Pending:</span>
                    <span>${stats.pending} (${((stats.pending / total) * 100).toFixed(1)}%)</span>
                </div>
                <div class="stat-row">
                    <span>Processing:</span>
                    <span>${stats.processing} (${((stats.processing / total) * 100).toFixed(1)}%)</span>
                </div>
                <div class="stat-row">
                    <span>Shipped:</span>
                    <span>${stats.shipped} (${((stats.shipped / total) * 100).toFixed(1)}%)</span>
                </div>
                <div class="stat-row">
                    <span>Delivered:</span>
                    <span>${stats.delivered} (${((stats.delivered / total) * 100).toFixed(1)}%)</span>
                </div>
                <div class="stat-row">
                    <span>Cancelled:</span>
                    <span>${stats.cancelled} (${((stats.cancelled / total) * 100).toFixed(1)}%)</span>
                </div>
            </div>
        `;
    },

    /**
     * Render user statistics
     */
    renderUserStats(stats) {
        const container = document.getElementById('userStats');
        if (!container) return;

        container.innerHTML = `
            <div class="user-stats">
                <div class="stat-row">
                    <span>Total Users:</span>
                    <span>${formatNumber(stats.total)}</span>
                </div>
                <div class="stat-row">
                    <span>Verified:</span>
                    <span>${formatNumber(stats.verified)} (${((stats.verified / stats.total) * 100).toFixed(1)}%)</span>
                </div>
                <div class="stat-row">
                    <span>Active (30d):</span>
                    <span>${formatNumber(stats.active)}</span>
                </div>
                <div class="stat-row">
                    <span>With 2FA:</span>
                    <span>${formatNumber(stats.with_2fa)}</span>
                </div>
                <div class="stat-row">
                    <span>New This Month:</span>
                    <span>${formatNumber(stats.this_month)}</span>
                </div>
            </div>
        `;
    },

    /**
     * Render product statistics
     */
    renderProductStats(stats) {
        const container = document.getElementById('productStats');
        if (!container) return;

        container.innerHTML = `
            <div class="product-stats">
                <div class="stat-row">
                    <span>Active Products:</span>
                    <span>${formatNumber(stats.active)}</span>
                </div>
                <div class="stat-row">
                    <span>Inactive:</span>
                    <span>${formatNumber(stats.inactive)}</span>
                </div>
                <div class="stat-row ${stats.out_of_stock > 0 ? 'warning' : ''}">
                    <span>Out of Stock:</span>
                    <span>${formatNumber(stats.out_of_stock)}</span>
                </div>
                <div class="stat-row ${stats.low_stock > 0 ? 'warning' : ''}">
                    <span>Low Stock:</span>
                    <span>${formatNumber(stats.low_stock)}</span>
                </div>
                <div class="stat-row">
                    <span>Featured:</span>
                    <span>${formatNumber(stats.featured)}</span>
                </div>
            </div>
        `;
    },

    /**
     * Render recent activities
     */
    renderRecentActivities(activities) {
        const container = document.getElementById('recentActivities');
        if (!container) return;

        if (!activities || activities.length === 0) {
            container.innerHTML = '<p class="no-activities">No recent activities</p>';
            return;
        }

        container.innerHTML = `
            <div class="activities-list">
                ${activities.map(activity => `
                    <div class="activity-item activity-${activity.type}">
                        <div class="activity-icon">
                            <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
                        </div>
                        <div class="activity-content">
                            <p>${activity.message}</p>
                            <span class="activity-time">${this.formatTimeAgo(activity.timestamp)}</span>
                        </div>
                        ${activity.link ? `
                            <a href="${activity.link}" class="activity-link">
                                <i class="fas fa-arrow-right"></i>
                            </a>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Get activity icon based on type
     */
    getActivityIcon(type) {
        const icons = {
            'order': 'shopping-cart',
            'user': 'user-plus',
            'ticket': 'ticket-alt',
            'payment': 'credit-card',
            'product': 'box',
            'kyc': 'id-card',
        };
        return icons[type] || 'bell';
    },

    /**
     * Load and render revenue chart
     */
    async loadRevenueChart(days = 30) {
        try {
            const response = await api.get(`/admin/analytics/revenue-chart?days=${days}`);

            if (response.success) {
                this.renderRevenueChart(response.data);
            }
        } catch (error) {
            console.error('Failed to load revenue chart:', error);
        }
    },

    /**
     * Render revenue chart using Chart.js
     */
    renderRevenueChart(data) {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Revenue',
                    data: data.values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: `Revenue - Last ${data.labels.length} Days`
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value, false)
                        }
                    }
                }
            }
        });

        // Update summary
        const summaryContainer = document.getElementById('revenueChartSummary');
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div class="chart-summary">
                    <div class="summary-item">
                        <span>Total:</span>
                        <strong>${formatCurrency(data.total)}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Average:</span>
                        <strong>${formatCurrency(data.average)}</strong>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Load and render orders chart
     */
    async loadOrdersChart(days = 30) {
        try {
            const response = await api.get(`/admin/analytics/orders-chart?days=${days}`);

            if (response.success) {
                this.renderOrdersChart(response.data);
            }
        } catch (error) {
            console.error('Failed to load orders chart:', error);
        }
    },

    /**
     * Render orders chart
     */
    renderOrdersChart(data) {
        const canvas = document.getElementById('ordersChart');
        if (!canvas) return;

        if (this.charts.orders) {
            this.charts.orders.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.orders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Orders',
                    data: data.values,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: `Orders - Last ${data.labels.length} Days`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    },

    /**
     * Load and render top products
     */
    async loadTopProducts(limit = 10) {
        try {
            const response = await api.get(`/admin/analytics/top-products-enhanced?limit=${limit}`);

            if (response.success) {
                this.renderTopProducts(response.data);
            }
        } catch (error) {
            console.error('Failed to load top products:', error);
        }
    },

    /**
     * Render top products table
     */
    renderTopProducts(products) {
        const container = document.getElementById('topProductsTable');
        if (!container) return;

        if (!products || products.length === 0) {
            container.innerHTML = '<p class="no-data">No product data available</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Product</th>
                        <th>Units Sold</th>
                        <th>Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map((product, index) => `
                        <tr>
                            <td><span class="rank">${index + 1}</span></td>
                            <td>
                                <div class="product-cell">
                                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
                                    <span>${product.name}</span>
                                </div>
                            </td>
                            <td>${formatNumber(product.total_sold)}</td>
                            <td><strong>${formatCurrency(product.total_revenue)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * Load and render top customers
     */
    async loadTopCustomers(limit = 10) {
        try {
            const response = await api.get(`/admin/analytics/top-customers-enhanced?limit=${limit}`);

            if (response.success) {
                this.renderTopCustomers(response.data);
            }
        } catch (error) {
            console.error('Failed to load top customers:', error);
        }
    },

    /**
     * Render top customers table
     */
    renderTopCustomers(customers) {
        const container = document.getElementById('topCustomersTable');
        if (!container) return;

        if (!customers || customers.length === 0) {
            container.innerHTML = '<p class="no-data">No customer data available</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Customer</th>
                        <th>Orders</th>
                        <th>Total Spent</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map((customer, index) => `
                        <tr>
                            <td><span class="rank">${index + 1}</span></td>
                            <td>
                                <div class="customer-cell">
                                    <strong>${customer.first_name} ${customer.last_name}</strong>
                                    <span class="email">${customer.email}</span>
                                </div>
                            </td>
                            <td>${formatNumber(customer.total_orders)}</td>
                            <td><strong>${formatCurrency(customer.total_spent)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * Load system health
     */
    async loadSystemHealth() {
        try {
            const response = await api.get('/admin/system/health');

            if (response.success) {
                this.renderSystemHealth(response.data);
            }
        } catch (error) {
            console.error('Failed to load system health:', error);
        }
    },

    /**
     * Render system health
     */
    renderSystemHealth(health) {
        const container = document.getElementById('systemHealth');
        if (!container) return;

        container.innerHTML = `
            <div class="health-grid">
                <div class="health-item health-${health.database.status}">
                    <i class="fas fa-database"></i>
                    <h4>Database</h4>
                    <span class="status">${health.database.status}</span>
                    <p>${health.database.message || ''}</p>
                </div>
                <div class="health-item health-${health.redis.status}">
                    <i class="fas fa-memory"></i>
                    <h4>Redis</h4>
                    <span class="status">${health.redis.status}</span>
                    <p>${health.redis.message || ''}</p>
                </div>
                <div class="health-item health-${health.storage.status}">
                    <i class="fas fa-hdd"></i>
                    <h4>Storage</h4>
                    <span class="status">${health.storage.status}</span>
                    <p>${health.storage.message || ''}</p>
                    ${health.storage.used_percent ? `
                        <div class="storage-bar">
                            <div class="storage-fill" style="width: ${health.storage.used_percent}%"></div>
                        </div>
                        <small>${health.storage.free_space} free of ${health.storage.total_space}</small>
                    ` : ''}
                </div>
                <div class="health-item health-${health.queue.status}">
                    <i class="fas fa-tasks"></i>
                    <h4>Queue</h4>
                    <span class="status">${health.queue.status}</span>
                    <p>${health.queue.message || ''}</p>
                </div>
            </div>
        `;
    },

    /**
     * Clear analytics cache
     */
    async clearCache() {
        try {
            showLoading('Clearing cache...');
            const response = await api.post('/admin/analytics/clear-cache');
            hideLoading();

            if (response.success) {
                showNotification('Cache cleared successfully', 'success');
                await this.loadDashboardStats();
            }
        } catch (error) {
            hideLoading();
            console.error('Failed to clear cache:', error);
            showNotification('Failed to clear cache', 'error');
        }
    },

    /**
     * Format time ago
     */
    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return time.toLocaleDateString();
    },

    /**
     * Setup auto-refresh interval
     */
    setupRefreshInterval(minutes = 5) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            this.loadDashboardStats();
        }, minutes * 60 * 1000);
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Clear cache button
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => this.clearCache());
        }

        // Chart period selectors
        document.querySelectorAll('[data-chart-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.chartPeriod);
                const chartType = e.target.dataset.chartType;
                
                if (chartType === 'revenue') {
                    this.loadRevenueChart(days);
                } else if (chartType === 'orders') {
                    this.loadOrdersChart(days);
                }
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDashboardStats());
        }
    },

    /**
     * Cleanup
     */
    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
};

// Auto-initialize on admin pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('adminDashboard')) {
            AdminDashboard.initialize();
        }
    });
} else {
    if (document.getElementById('adminDashboard')) {
        AdminDashboard.initialize();
    }
}

export default AdminDashboard;
