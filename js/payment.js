// Payment Integration Module for KEOHAMS
// Handles Paystack payment initialization, verification, and callbacks

import { api } from './api.js';
import { showNotification, showLoading, hideLoading } from './utils.js';

export const PaymentModule = {
    /**
     * Initialize order payment
     */
    async initializeOrderPayment(orderId) {
        try {
            showLoading('Initializing payment...');
            
            const response = await api.post('/payments/initialize-order', {
                order_id: orderId
            });

            hideLoading();

            if (response.success) {
                // Redirect to Paystack payment page
                window.location.href = response.data.authorization_url;
                return response.data;
            } else {
                showNotification(response.message || 'Payment initialization failed', 'error');
                return null;
            }
        } catch (error) {
            hideLoading();
            console.error('Order payment initialization error:', error);
            showNotification('Failed to initialize payment. Please try again.', 'error');
            return null;
        }
    },

    /**
     * Initialize wallet top-up
     */
    async initializeWalletTopup(amount) {
        try {
            // Validate amount
            if (!amount || amount < 100) {
                showNotification('Minimum top-up amount is ₦100', 'warning');
                return null;
            }

            if (amount > 1000000) {
                showNotification('Maximum top-up amount is ₦1,000,000', 'warning');
                return null;
            }

            showLoading('Initializing wallet top-up...');
            
            const response = await api.post('/payments/initialize-wallet', {
                amount: parseFloat(amount)
            });

            hideLoading();

            if (response.success) {
                // Redirect to Paystack payment page
                window.location.href = response.data.authorization_url;
                return response.data;
            } else {
                showNotification(response.message || 'Wallet top-up initialization failed', 'error');
                return null;
            }
        } catch (error) {
            hideLoading();
            console.error('Wallet top-up initialization error:', error);
            showNotification('Failed to initialize wallet top-up. Please try again.', 'error');
            return null;
        }
    },

    /**
     * Verify payment after callback
     */
    async verifyPayment(reference) {
        try {
            showLoading('Verifying payment...');
            
            const response = await api.get(`/payments/verify-payment/${reference}`);

            hideLoading();

            if (response.success) {
                showNotification('Payment verified successfully!', 'success');
                return response.data.payment;
            } else {
                showNotification(response.message || 'Payment verification failed', 'error');
                return null;
            }
        } catch (error) {
            hideLoading();
            console.error('Payment verification error:', error);
            showNotification('Failed to verify payment. Please contact support.', 'error');
            return null;
        }
    },

    /**
     * Get payment history
     */
    async getPaymentHistory(page = 1) {
        try {
            const response = await api.get(`/payments/history?page=${page}`);

            if (response.success || response.data) {
                return response.data || response;
            } else {
                console.error('Failed to fetch payment history');
                return null;
            }
        } catch (error) {
            console.error('Get payment history error:', error);
            return null;
        }
    },

    /**
     * Get payment statistics
     */
    async getPaymentStatistics() {
        try {
            const response = await api.get('/payments/statistics');

            if (response.success) {
                return response.data;
            } else {
                console.error('Failed to fetch payment statistics');
                return null;
            }
        } catch (error) {
            console.error('Get payment statistics error:', error);
            return null;
        }
    },

    /**
     * Handle payment callback from Paystack
     */
    handlePaymentCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const reference = urlParams.get('reference');
        const trxref = urlParams.get('trxref');

        if (reference || trxref) {
            const paymentRef = reference || trxref;
            this.verifyPayment(paymentRef).then(payment => {
                if (payment) {
                    // Redirect based on payment type
                    if (payment.order_id) {
                        setTimeout(() => {
                            window.location.href = `/dashboard.html?tab=orders&order_id=${payment.order_id}`;
                        }, 2000);
                    } else {
                        setTimeout(() => {
                            window.location.href = '/dashboard.html?tab=wallet';
                        }, 2000);
                    }
                }
            });
        }
    },

    /**
     * Render payment history table
     */
    renderPaymentHistory(payments, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!payments || payments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>No payment history found</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="table-responsive">
                <table class="payment-history-table">
                    <thead>
                        <tr>
                            <th>Reference</th>
                            <th>Amount</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(payment => `
                            <tr>
                                <td>
                                    <span class="payment-ref">${payment.reference}</span>
                                </td>
                                <td>
                                    <strong>${this.formatAmount(payment.amount, payment.currency)}</strong>
                                </td>
                                <td>
                                    ${payment.order_id ? 
                                        `<span class="badge badge-info">Order Payment</span>` : 
                                        `<span class="badge badge-primary">Wallet Top-up</span>`
                                    }
                                </td>
                                <td>
                                    ${this.getStatusBadge(payment.status)}
                                </td>
                                <td>
                                    ${this.formatDate(payment.created_at)}
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="PaymentModule.viewPaymentDetails(${payment.id})">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    },

    /**
     * View payment details
     */
    async viewPaymentDetails(paymentId) {
        try {
            showLoading('Loading payment details...');
            
            const response = await api.get(`/payments/${paymentId}`);

            hideLoading();

            if (response.success) {
                this.showPaymentDetailsModal(response.data.payment);
            } else {
                showNotification('Failed to load payment details', 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('View payment details error:', error);
            showNotification('Failed to load payment details', 'error');
        }
    },

    /**
     * Show payment details modal
     */
    showPaymentDetailsModal(payment) {
        const modalHTML = `
            <div class="modal-overlay" id="paymentDetailsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Payment Details</h3>
                        <button class="close-btn" onclick="PaymentModule.closeModal('paymentDetailsModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="payment-details">
                            <div class="detail-row">
                                <span class="label">Reference:</span>
                                <span class="value">${payment.reference}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Amount:</span>
                                <span class="value"><strong>${this.formatAmount(payment.amount, payment.currency)}</strong></span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Status:</span>
                                <span class="value">${this.getStatusBadge(payment.status)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Payment Method:</span>
                                <span class="value">${payment.payment_method}</span>
                            </div>
                            ${payment.channel ? `
                                <div class="detail-row">
                                    <span class="label">Channel:</span>
                                    <span class="value">${payment.channel}</span>
                                </div>
                            ` : ''}
                            ${payment.fees ? `
                                <div class="detail-row">
                                    <span class="label">Fees:</span>
                                    <span class="value">${this.formatAmount(payment.fees, payment.currency)}</span>
                                </div>
                            ` : ''}
                            <div class="detail-row">
                                <span class="label">Date:</span>
                                <span class="value">${this.formatDate(payment.created_at)}</span>
                            </div>
                            ${payment.paid_at ? `
                                <div class="detail-row">
                                    <span class="label">Paid At:</span>
                                    <span class="value">${this.formatDate(payment.paid_at)}</span>
                                </div>
                            ` : ''}
                            ${payment.order ? `
                                <div class="detail-row">
                                    <span class="label">Order:</span>
                                    <span class="value">
                                        <a href="/dashboard.html?tab=orders&order_id=${payment.order.id}">
                                            ${payment.order.order_number}
                                        </a>
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="PaymentModule.closeModal('paymentDetailsModal')">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    },

    /**
     * Format amount with currency
     */
    formatAmount(amount, currency = 'NGN') {
        const formatter = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
        });
        return formatter.format(amount);
    },

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    /**
     * Get status badge HTML
     */
    getStatusBadge(status) {
        const badges = {
            'success': '<span class="badge badge-success">Success</span>',
            'pending': '<span class="badge badge-warning">Pending</span>',
            'failed': '<span class="badge badge-danger">Failed</span>',
            'cancelled': '<span class="badge badge-secondary">Cancelled</span>',
        };
        return badges[status.toLowerCase()] || `<span class="badge">${status}</span>`;
    },

    /**
     * Initialize payment buttons on page
     */
    initializePaymentButtons() {
        // Order payment buttons
        document.querySelectorAll('.pay-order-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const orderId = button.dataset.orderId;
                if (orderId) {
                    this.initializeOrderPayment(orderId);
                }
            });
        });

        // Wallet top-up button
        const walletTopupBtn = document.getElementById('walletTopupBtn');
        if (walletTopupBtn) {
            walletTopupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const amountInput = document.getElementById('topupAmount');
                if (amountInput) {
                    const amount = parseFloat(amountInput.value);
                    this.initializeWalletTopup(amount);
                }
            });
        }

        // Check for payment callback on page load
        if (window.location.pathname.includes('payment-callback') || 
            window.location.search.includes('reference=')) {
            this.handlePaymentCallback();
        }
    }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PaymentModule.initializePaymentButtons();
    });
} else {
    PaymentModule.initializePaymentButtons();
}

// Export for use in other modules
export default PaymentModule;
