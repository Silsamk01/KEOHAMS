// Affiliate Dashboard Module for KEOHAMS
// Handles affiliate statistics, MLM tree, commissions, and withdrawals

import { api } from './api.js';
import { showNotification, showLoading, hideLoading, formatCurrency, formatNumber, formatDate } from './utils.js';

export const AffiliateDashboard = {
    charts: {},
    refreshInterval: null,

    /**
     * Initialize affiliate dashboard
     */
    async initialize() {
        await this.loadStats();
        await this.loadEarningsChart(30);
        await this.loadRecentCommissions();
        await this.loadRecentWithdrawals();
        this.setupEventListeners();
        this.setupRefreshInterval();
    },

    /**
     * Load affiliate statistics
     */
    async loadStats() {
        try {
            showLoading('Loading statistics...');
            const response = await api.get('/affiliate/stats');
            hideLoading();

            if (response.success) {
                this.renderOverviewStats(response.data.overview);
                this.renderPerformanceStats(response.data.performance);
                this.renderCommissionStats(response.data.commissions);
            }
        } catch (error) {
            hideLoading();
            console.error('Failed to load stats:', error);
            showNotification('Failed to load statistics', 'error');
        }
    },

    /**
     * Render overview statistics
     */
    renderOverviewStats(stats) {
        const container = document.getElementById('affiliateOverview');
        if (!container) return;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card earnings">
                    <div class="stat-icon">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatCurrency(stats.total_earnings)}</h3>
                        <p>Total Earnings</p>
                        <span class="badge">${stats.commission_rate}% Commission Rate</span>
                    </div>
                </div>

                <div class="stat-card balance">
                    <div class="stat-icon">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatCurrency(stats.available_balance)}</h3>
                        <p>Available Balance</p>
                        <span class="badge pending">${formatCurrency(stats.pending_balance)} Pending</span>
                    </div>
                </div>

                <div class="stat-card referrals">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatNumber(stats.total_referrals)}</h3>
                        <p>Total Referrals</p>
                        <span class="badge success">${stats.active_referrals} Active</span>
                    </div>
                </div>

                <div class="stat-card withdrawn">
                    <div class="stat-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${formatCurrency(stats.withdrawn_amount)}</h3>
                        <p>Total Withdrawn</p>
                        <span class="badge">Level ${stats.level}</span>
                    </div>
                </div>
            </div>

            <div class="referral-link-box">
                <h4>Your Referral Link</h4>
                <div class="link-input-group">
                    <input type="text" id="referralLink" value="${window.location.origin}/register?ref=${stats.referral_code}" readonly>
                    <button onclick="AffiliateDashboard.copyReferralLink()" class="btn-copy">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <p class="referral-code">Your Code: <strong>${stats.referral_code}</strong></p>
            </div>
        `;
    },

    /**
     * Copy referral link
     */
    copyReferralLink() {
        const input = document.getElementById('referralLink');
        if (input) {
            input.select();
            document.execCommand('copy');
            showNotification('Referral link copied to clipboard!', 'success');
        }
    },

    /**
     * Render performance statistics
     */
    renderPerformanceStats(performance) {
        const container = document.getElementById('performanceStats');
        if (!container) return;

        container.innerHTML = `
            <div class="performance-grid">
                <div class="performance-item">
                    <span class="label">This Month:</span>
                    <span class="value">${formatCurrency(performance.this_month_earnings)}</span>
                </div>
                <div class="performance-item">
                    <span class="label">Last Month:</span>
                    <span class="value">${formatCurrency(performance.last_month_earnings)}</span>
                </div>
                <div class="performance-item">
                    <span class="label">This Week:</span>
                    <span class="value">${formatCurrency(performance.this_week_earnings)}</span>
                </div>
            </div>
        `;
    },

    /**
     * Render commission statistics
     */
    renderCommissionStats(commissions) {
        const container = document.getElementById('commissionStats');
        if (!container) return;

        container.innerHTML = `
            <div class="commission-grid">
                <div class="commission-item">
                    <span class="label">Total Commissions:</span>
                    <span class="value">${formatCurrency(commissions.total)}</span>
                </div>
                <div class="commission-item pending">
                    <span class="label">Pending:</span>
                    <span class="value">${formatCurrency(commissions.pending)}</span>
                </div>
                <div class="commission-item approved">
                    <span class="label">Approved:</span>
                    <span class="value">${formatCurrency(commissions.approved)}</span>
                </div>
                <div class="commission-item paid">
                    <span class="label">Paid:</span>
                    <span class="value">${formatCurrency(commissions.paid)}</span>
                </div>
            </div>
        `;
    },

    /**
     * Load and render earnings chart
     */
    async loadEarningsChart(days = 30) {
        try {
            const response = await api.get(`/affiliate/earnings-chart?days=${days}`);

            if (response.success) {
                this.renderEarningsChart(response.data);
            }
        } catch (error) {
            console.error('Failed to load earnings chart:', error);
        }
    },

    /**
     * Render earnings chart
     */
    renderEarningsChart(data) {
        const canvas = document.getElementById('earningsChart');
        if (!canvas) return;

        if (this.charts.earnings) {
            this.charts.earnings.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.earnings = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Earnings',
                    data: data.values,
                    borderColor: 'rgb(52, 211, 153)',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
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
                        text: `Earnings - Last ${data.labels.length} Days`
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
        const summaryContainer = document.getElementById('earningsChartSummary');
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
     * Load downline tree (MLM structure)
     */
    async loadDownlineTree(levels = 3) {
        try {
            showLoading('Loading downline tree...');
            const response = await api.get(`/affiliate/downline-tree?levels=${levels}`);
            hideLoading();

            if (response.success) {
                this.renderDownlineTree(response.data);
            }
        } catch (error) {
            hideLoading();
            console.error('Failed to load downline tree:', error);
            showNotification('Failed to load downline tree', 'error');
        }
    },

    /**
     * Render downline tree
     */
    renderDownlineTree(tree) {
        const container = document.getElementById('downlineTree');
        if (!container) return;

        container.innerHTML = this.buildTreeHTML(tree);
    },

    /**
     * Build tree HTML recursively
     */
    buildTreeHTML(node, level = 0) {
        const hasChildren = node.children && node.children.length > 0;
        const statusClass = node.status === 'active' ? 'active' : 'inactive';

        let html = `
            <div class="tree-node level-${level} ${statusClass}">
                <div class="node-card">
                    <div class="node-header">
                        <i class="fas fa-user-circle"></i>
                        <div class="node-info">
                            <strong>${node.name}</strong>
                            <span class="email">${node.email}</span>
                        </div>
                        ${level > 0 ? `<span class="level-badge">L${level}</span>` : `<span class="level-badge root">YOU</span>`}
                    </div>
                    <div class="node-stats">
                        <div class="stat">
                            <i class="fas fa-coins"></i>
                            <span>${formatCurrency(node.total_earnings)}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-users"></i>
                            <span>${node.total_referrals}</span>
                        </div>
                    </div>
                </div>
        `;

        if (hasChildren) {
            html += '<div class="tree-children">';
            node.children.forEach(child => {
                html += this.buildTreeHTML(child, level + 1);
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    /**
     * Load referrals list
     */
    async loadReferrals(page = 1) {
        try {
            const response = await api.get(`/affiliate/referrals?page=${page}&per_page=20`);

            if (response.success) {
                this.renderReferralsList(response.data, response.pagination);
            }
        } catch (error) {
            console.error('Failed to load referrals:', error);
            showNotification('Failed to load referrals', 'error');
        }
    },

    /**
     * Render referrals list
     */
    renderReferralsList(referrals, pagination) {
        const container = document.getElementById('referralsList');
        if (!container) return;

        if (!referrals || referrals.length === 0) {
            container.innerHTML = '<p class="no-data">No referrals yet. Share your referral link to get started!</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Status</th>
                        <th>Referrals</th>
                        <th>Earnings</th>
                    </tr>
                </thead>
                <tbody>
                    ${referrals.map(referral => `
                        <tr>
                            <td>${referral.user.first_name} ${referral.user.last_name}</td>
                            <td>${referral.user.email}</td>
                            <td>${formatDate(referral.created_at)}</td>
                            <td><span class="badge ${referral.status}">${referral.status}</span></td>
                            <td>${referral.total_referrals}</td>
                            <td>${formatCurrency(referral.total_earnings)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${this.renderPagination(pagination)}
        `;
    },

    /**
     * Load commission history
     */
    async loadCommissions(filters = {}) {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await api.get(`/affiliate/commission-history?${params}`);

            if (response.success) {
                this.renderCommissionsTable(response.data, response.pagination, response.summary);
            }
        } catch (error) {
            console.error('Failed to load commissions:', error);
            showNotification('Failed to load commission history', 'error');
        }
    },

    /**
     * Render commissions table
     */
    renderCommissionsTable(commissions, pagination, summary) {
        const container = document.getElementById('commissionsTable');
        if (!container) return;

        if (!commissions || commissions.length === 0) {
            container.innerHTML = '<p class="no-data">No commissions yet</p>';
            return;
        }

        container.innerHTML = `
            <div class="commission-summary">
                <div class="summary-item">
                    <span>Total:</span>
                    <strong>${formatCurrency(summary.total_amount)}</strong>
                </div>
                <div class="summary-item">
                    <span>Pending:</span>
                    <strong>${formatCurrency(summary.pending_amount)}</strong>
                </div>
                <div class="summary-item">
                    <span>Approved:</span>
                    <strong>${formatCurrency(summary.approved_amount)}</strong>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Order</th>
                        <th>Amount</th>
                        <th>Rate</th>
                        <th>Level</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${commissions.map(commission => `
                        <tr>
                            <td>${formatDate(commission.created_at)}</td>
                            <td>#${commission.order_id}</td>
                            <td><strong>${formatCurrency(commission.amount)}</strong></td>
                            <td>${commission.commission_rate}%</td>
                            <td>L${commission.level}</td>
                            <td><span class="badge ${commission.status}">${commission.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${this.renderPagination(pagination)}
        `;
    },

    /**
     * Load recent commissions
     */
    async loadRecentCommissions() {
        try {
            const response = await api.get('/affiliate/commission-history?per_page=5');

            if (response.success && response.data) {
                this.renderRecentCommissions(response.data);
            }
        } catch (error) {
            console.error('Failed to load recent commissions:', error);
        }
    },

    /**
     * Render recent commissions
     */
    renderRecentCommissions(commissions) {
        const container = document.getElementById('recentCommissions');
        if (!container) return;

        if (!commissions || commissions.length === 0) {
            container.innerHTML = '<p class="no-data">No recent commissions</p>';
            return;
        }

        container.innerHTML = `
            <div class="recent-list">
                ${commissions.map(commission => `
                    <div class="recent-item">
                        <div class="item-icon ${commission.status}">
                            <i class="fas fa-coins"></i>
                        </div>
                        <div class="item-info">
                            <p>Commission from Order #${commission.order_id}</p>
                            <span class="time">${formatDate(commission.created_at)}</span>
                        </div>
                        <div class="item-amount">
                            <strong>${formatCurrency(commission.amount)}</strong>
                            <span class="badge ${commission.status}">${commission.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Load withdrawal limits
     */
    async loadWithdrawalLimits() {
        try {
            const response = await api.get('/affiliate/withdrawal-limits');

            if (response.success) {
                this.renderWithdrawalLimits(response.data);
            }
        } catch (error) {
            console.error('Failed to load withdrawal limits:', error);
        }
    },

    /**
     * Render withdrawal limits
     */
    renderWithdrawalLimits(limits) {
        const container = document.getElementById('withdrawalLimits');
        if (!container) return;

        container.innerHTML = `
            <div class="limits-info">
                <p><strong>Available Balance:</strong> ${formatCurrency(limits.available_balance)}</p>
                <p><strong>Minimum Withdrawal:</strong> ${formatCurrency(limits.min_withdrawal)}</p>
                <p><strong>Maximum Withdrawal:</strong> ${formatCurrency(limits.max_withdrawal)}</p>
                ${limits.pending_withdrawals > 0 ? `
                    <p class="warning"><strong>Pending Withdrawals:</strong> ${formatCurrency(limits.pending_withdrawals)}</p>
                ` : ''}
                ${!limits.can_withdraw ? `
                    <p class="error">Minimum balance not reached for withdrawal</p>
                ` : ''}
            </div>
        `;
    },

    /**
     * Request withdrawal
     */
    async requestWithdrawal(data) {
        try {
            showLoading('Processing withdrawal request...');
            const response = await api.post('/affiliate/withdrawal/request', data);
            hideLoading();

            if (response.success) {
                showNotification('Withdrawal request submitted successfully', 'success');
                await this.loadStats();
                await this.loadWithdrawals();
                this.closeWithdrawalModal();
            }
        } catch (error) {
            hideLoading();
            console.error('Failed to request withdrawal:', error);
            showNotification(error.message || 'Failed to process withdrawal request', 'error');
        }
    },

    /**
     * Load withdrawal history
     */
    async loadWithdrawals(filters = {}) {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await api.get(`/affiliate/withdrawal-history?${params}`);

            if (response.success) {
                this.renderWithdrawalsTable(response.data, response.pagination, response.summary);
            }
        } catch (error) {
            console.error('Failed to load withdrawals:', error);
            showNotification('Failed to load withdrawal history', 'error');
        }
    },

    /**
     * Render withdrawals table
     */
    renderWithdrawalsTable(withdrawals, pagination, summary) {
        const container = document.getElementById('withdrawalsTable');
        if (!container) return;

        if (!withdrawals || withdrawals.length === 0) {
            container.innerHTML = '<p class="no-data">No withdrawals yet</p>';
            return;
        }

        container.innerHTML = `
            <div class="withdrawal-summary">
                <div class="summary-item">
                    <span>Total Requested:</span>
                    <strong>${formatCurrency(summary.total_requested)}</strong>
                </div>
                <div class="summary-item">
                    <span>Completed:</span>
                    <strong>${formatCurrency(summary.total_completed)}</strong>
                </div>
                <div class="summary-item">
                    <span>Pending:</span>
                    <strong>${formatCurrency(summary.total_pending)}</strong>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${withdrawals.map(withdrawal => `
                        <tr>
                            <td>${formatDate(withdrawal.request_date)}</td>
                            <td><strong>${formatCurrency(withdrawal.amount)}</strong></td>
                            <td>${withdrawal.payment_method}</td>
                            <td><span class="badge ${withdrawal.status}">${withdrawal.status}</span></td>
                            <td>
                                ${withdrawal.status === 'pending' ? `
                                    <button class="btn-sm btn-danger" onclick="AffiliateDashboard.cancelWithdrawal(${withdrawal.id})">
                                        Cancel
                                    </button>
                                ` : '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${this.renderPagination(pagination)}
        `;
    },

    /**
     * Load recent withdrawals
     */
    async loadRecentWithdrawals() {
        try {
            const response = await api.get('/affiliate/withdrawal-history?per_page=5');

            if (response.success && response.data) {
                this.renderRecentWithdrawals(response.data);
            }
        } catch (error) {
            console.error('Failed to load recent withdrawals:', error);
        }
    },

    /**
     * Render recent withdrawals
     */
    renderRecentWithdrawals(withdrawals) {
        const container = document.getElementById('recentWithdrawals');
        if (!container) return;

        if (!withdrawals || withdrawals.length === 0) {
            container.innerHTML = '<p class="no-data">No recent withdrawals</p>';
            return;
        }

        container.innerHTML = `
            <div class="recent-list">
                ${withdrawals.map(withdrawal => `
                    <div class="recent-item">
                        <div class="item-icon ${withdrawal.status}">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                        <div class="item-info">
                            <p>Withdrawal Request</p>
                            <span class="time">${formatDate(withdrawal.request_date)}</span>
                        </div>
                        <div class="item-amount">
                            <strong>${formatCurrency(withdrawal.amount)}</strong>
                            <span class="badge ${withdrawal.status}">${withdrawal.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Cancel withdrawal
     */
    async cancelWithdrawal(withdrawalId) {
        if (!confirm('Are you sure you want to cancel this withdrawal request?')) {
            return;
        }

        try {
            showLoading('Cancelling withdrawal...');
            const response = await api.post(`/affiliate/withdrawals/${withdrawalId}/cancel`);
            hideLoading();

            if (response.success) {
                showNotification('Withdrawal cancelled successfully', 'success');
                await this.loadStats();
                await this.loadWithdrawals();
            }
        } catch (error) {
            hideLoading();
            console.error('Failed to cancel withdrawal:', error);
            showNotification(error.message || 'Failed to cancel withdrawal', 'error');
        }
    },

    /**
     * Render pagination
     */
    renderPagination(pagination) {
        if (pagination.last_page <= 1) return '';

        let html = '<div class="pagination">';
        
        // Previous button
        if (pagination.current_page > 1) {
            html += `<button class="page-btn" onclick="AffiliateDashboard.goToPage(${pagination.current_page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>`;
        }

        // Page numbers
        for (let i = 1; i <= pagination.last_page; i++) {
            if (i === pagination.current_page) {
                html += `<span class="page-current">${i}</span>`;
            } else if (i === 1 || i === pagination.last_page || Math.abs(i - pagination.current_page) <= 2) {
                html += `<button class="page-btn" onclick="AffiliateDashboard.goToPage(${i})">${i}</button>`;
            } else if (Math.abs(i - pagination.current_page) === 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }

        // Next button
        if (pagination.current_page < pagination.last_page) {
            html += `<button class="page-btn" onclick="AffiliateDashboard.goToPage(${pagination.current_page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        html += '</div>';
        return html;
    },

    /**
     * Go to page
     */
    goToPage(page) {
        // Implement page navigation based on current view
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        
        if (activeTab === 'referrals') {
            this.loadReferrals(page);
        } else if (activeTab === 'commissions') {
            this.loadCommissions({ page });
        } else if (activeTab === 'withdrawals') {
            this.loadWithdrawals({ page });
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Withdrawal request button
        const withdrawBtn = document.getElementById('requestWithdrawalBtn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => this.showWithdrawalModal());
        }

        // Withdrawal form submission
        const withdrawalForm = document.getElementById('withdrawalForm');
        if (withdrawalForm) {
            withdrawalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                this.requestWithdrawal(data);
            });
        }

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Chart period selector
        document.querySelectorAll('[data-chart-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.chartPeriod);
                this.loadEarningsChart(days);
                
                // Update active state
                document.querySelectorAll('[data-chart-period]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    },

    /**
     * Switch tab
     */
    switchTab(tab) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}Tab`);
        });

        // Load tab data
        switch (tab) {
            case 'referrals':
                this.loadReferrals();
                break;
            case 'commissions':
                this.loadCommissions();
                break;
            case 'withdrawals':
                this.loadWithdrawals();
                break;
            case 'tree':
                this.loadDownlineTree();
                break;
        }
    },

    /**
     * Show withdrawal modal
     */
    showWithdrawalModal() {
        const modal = document.getElementById('withdrawalModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadWithdrawalLimits();
        }
    },

    /**
     * Close withdrawal modal
     */
    closeWithdrawalModal() {
        const modal = document.getElementById('withdrawalModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('withdrawalForm')?.reset();
        }
    },

    /**
     * Setup auto-refresh
     */
    setupRefreshInterval(minutes = 5) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            this.loadStats();
        }, minutes * 60 * 1000);
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

// Auto-initialize on affiliate pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('affiliateDashboard')) {
            AffiliateDashboard.initialize();
        }
    });
} else {
    if (document.getElementById('affiliateDashboard')) {
        AffiliateDashboard.initialize();
    }
}

// Make globally accessible for inline onclick handlers
window.AffiliateDashboard = AffiliateDashboard;

export default AffiliateDashboard;
