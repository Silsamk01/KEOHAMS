/**
 * Admin Affiliate Management JavaScript
 * Handles affiliate system administration
 */

let affiliateSystemStats = null;
let pendingSales = [];
let unpaidCommissions = [];
let affiliatesList = [];
let selectedCommissions = new Set();

// Initialize affiliate management when tab is shown
document.addEventListener('DOMContentLoaded', function() {
    const affiliateTab = document.getElementById('tab-affiliate');
    if (affiliateTab) {
        affiliateTab.addEventListener('shown.bs.tab', function() {
            loadAffiliateSystem();
        });
    }
    
    // Initialize sub-tab handlers
    const affiliateSubTabs = document.getElementById('affiliateSubTabs');
    if (affiliateSubTabs) {
        affiliateSubTabs.addEventListener('shown.bs.tab', function(event) {
            const targetId = event.target.getAttribute('data-bs-target');
            handleAffiliateSubTab(targetId);
        });
    }
    
    // Initialize event handlers
    initializeAffiliateHandlers();
});

// Load affiliate system data
async function loadAffiliateSystem() {
    try {
        // Load main stats
        await loadAffiliateStats();
        
        // Load overview data (default tab)
        await loadAffiliateOverview();
        
        // Update pending sales badge
        const pendingSalesResponse = await fetchWithAuth('/api/admin/affiliate/sales/pending');
        if (pendingSalesResponse.ok) {
            const pendingSalesData = await pendingSalesResponse.json();
            updatePendingSalesBadge(pendingSalesData.length);
        }
        
    } catch (error) {
        console.error('Failed to load affiliate system:', error);
        showAffiliateError('Failed to load affiliate system data');
    }
}

// Load affiliate statistics
async function loadAffiliateStats() {
    try {
        const response = await fetchWithAuth('/api/admin/affiliate/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        affiliateSystemStats = await response.json();
        
        // Update stat cards
        document.getElementById('affiliateStatsTotal').textContent = affiliateSystemStats.affiliates.total;
        document.getElementById('affiliateStatsPending').textContent = affiliateSystemStats.sales.pending_sales;
        document.getElementById('affiliateStatsVerified').textContent = affiliateSystemStats.sales.verified_sales;
        document.getElementById('affiliateStatsCommissions').textContent = `$${affiliateSystemStats.commissions.total_amount.toFixed(2)}`;
        
    } catch (error) {
        console.error('Failed to load affiliate stats:', error);
    }
}

// Handle affiliate sub-tab changes
async function handleAffiliateSubTab(targetId) {
    switch (targetId) {
        case '#affiliate-overview':
            await loadAffiliateOverview();
            break;
        case '#affiliate-sales':
            await loadPendingSales();
            break;
        case '#affiliate-commissions':
            await loadUnpaidCommissions();
            break;
        case '#affiliate-list':
            await loadAffiliatesList();
            break;
        case '#affiliate-settings':
            await loadAffiliateSettings();
            break;
    }
}

// Load affiliate overview
async function loadAffiliateOverview() {
    try {
        // Load recent sales activity
        const salesResponse = await fetchWithAuth('/api/admin/affiliate/sales/pending');
        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            renderRecentSalesActivity(salesData.slice(0, 5)); // Show last 5
        }
        
        // Load commission statistics
        if (affiliateSystemStats) {
            renderCommissionStatistics(affiliateSystemStats.commissions);
        }
        
    } catch (error) {
        console.error('Failed to load affiliate overview:', error);
    }
}

// Load pending sales for verification
async function loadPendingSales() {
    try {
        showLoading('pendingSalesList');
        
        const response = await fetchWithAuth('/api/admin/affiliate/sales/pending');
        if (!response.ok) throw new Error('Failed to fetch pending sales');
        
        pendingSales = await response.json();
        renderPendingSales(pendingSales);
        updatePendingSalesBadge(pendingSales.length);
        
    } catch (error) {
        console.error('Failed to load pending sales:', error);
        showError('pendingSalesList', 'Failed to load pending sales');
    }
}

// Load unpaid commissions
async function loadUnpaidCommissions() {
    try {
        showLoading('unpaidCommissionsList');
        
        const response = await fetchWithAuth('/api/admin/affiliate/commissions/unpaid');
        if (!response.ok) throw new Error('Failed to fetch unpaid commissions');
        
        unpaidCommissions = await response.json();
        renderUnpaidCommissions(unpaidCommissions);
        
    } catch (error) {
        console.error('Failed to load unpaid commissions:', error);
        showError('unpaidCommissionsList', 'Failed to load unpaid commissions');
    }
}

// Load affiliates list
async function loadAffiliatesList() {
    try {
        showLoading('affiliatesList');
        
        const response = await fetchWithAuth('/api/admin/affiliate/list');
        if (!response.ok) throw new Error('Failed to fetch affiliates');
        
        const data = await response.json();
        affiliatesList = data.data;
        renderAffiliatesList(affiliatesList);
        
    } catch (error) {
        console.error('Failed to load affiliates list:', error);
        showError('affiliatesList', 'Failed to load affiliates list');
    }
}

// Load affiliate settings
async function loadAffiliateSettings() {
    try {
        showLoading('commissionSettingsForm');
        showLoading('affiliateSystemStatus');
        
        const response = await fetchWithAuth('/api/admin/affiliate/settings/commission');
        if (!response.ok) throw new Error('Failed to fetch settings');
        
        const data = await response.json();
        renderCommissionSettings(data.settings);
        renderSystemStatus(data.validation);
        
    } catch (error) {
        console.error('Failed to load affiliate settings:', error);
        showError('commissionSettingsForm', 'Failed to load settings');
    }
}

// Render recent sales activity
function renderRecentSalesActivity(sales) {
    const container = document.getElementById('recentSalesActivity');
    
    if (!sales || sales.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-3">No recent sales</div>';
        return;
    }
    
    container.innerHTML = sales.map(sale => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
                <strong>${sale.sale_reference}</strong>
                <br><small class="text-muted">${sale.seller_name}</small>
            </div>
            <div class="text-end">
                <div class="fw-bold">$${parseFloat(sale.sale_amount).toFixed(2)}</div>
                <small class="text-muted">${new Date(sale.created_at).toLocaleDateString()}</small>
            </div>
        </div>
    `).join('');
}

// Render commission statistics
function renderCommissionStatistics(stats) {
    const container = document.getElementById('commissionStatistics');
    
    container.innerHTML = `
        <div class="row text-center">
            <div class="col-6">
                <div class="border-end">
                    <div class="h4 text-success mb-0">$${stats.paid_amount.toFixed(2)}</div>
                    <small class="text-muted">Paid Commissions</small>
                </div>
            </div>
            <div class="col-6">
                <div class="h4 text-warning mb-0">$${stats.pending_amount.toFixed(2)}</div>
                <small class="text-muted">Pending Commissions</small>
            </div>
        </div>
        <hr>
        <div class="row text-center small">
            <div class="col-6">
                <div class="text-muted">${stats.paid_commissions} Paid</div>
            </div>
            <div class="col-6">
                <div class="text-muted">${stats.pending_commissions} Pending</div>
            </div>
        </div>
    `;
}

// Render pending sales
function renderPendingSales(sales) {
    const container = document.getElementById('pendingSalesList');
    
    if (!sales || sales.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">No pending sales to verify</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Sale Reference</th>
                        <th>Affiliate</th>
                        <th>Amount</th>
                        <th>Payment Method</th>
                        <th>Date</th>
                        <th>Potential Commission</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(sale => `
                        <tr>
                            <td><strong>${sale.sale_reference}</strong></td>
                            <td>
                                ${sale.seller_name}
                                <br><small class="text-muted">${sale.referral_code}</small>
                            </td>
                            <td><strong>$${parseFloat(sale.sale_amount).toFixed(2)}</strong></td>
                            <td>
                                <span class="badge bg-info">${sale.payment_method}</span>
                            </td>
                            <td>${new Date(sale.created_at).toLocaleDateString()}</td>
                            <td>
                                <strong>$${sale.commission_preview?.total_commission_amount?.toFixed(2) || '0.00'}</strong>
                                <br><small class="text-muted">${sale.commission_preview?.total_commission_rate || 0}%</small>
                            </td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-success" onclick="verifySale(${sale.id}, 'approve')">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button class="btn btn-danger" onclick="verifySale(${sale.id}, 'reject')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                    <button class="btn btn-info" onclick="viewSaleDetails(${sale.id})">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Render unpaid commissions
function renderUnpaidCommissions(sales) {
    const container = document.getElementById('unpaidCommissionsList');
    
    if (!sales || sales.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">No unpaid commissions</div>';
        document.getElementById('bulkReleaseCommissions').disabled = true;
        return;
    }
    
    container.innerHTML = `
        <div class="mb-3">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="selectAllCommissions" onchange="toggleAllCommissions()">
                <label class="form-check-label" for="selectAllCommissions">
                    Select All
                </label>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th width="40"></th>
                        <th>Sale Reference</th>
                        <th>Affiliate</th>
                        <th>Sale Amount</th>
                        <th>Total Commission</th>
                        <th>Levels</th>
                        <th>Verified Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(sale => {
                        const totalCommission = sale.commissions.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0);
                        return `
                            <tr>
                                <td>
                                    <div class="form-check">
                                        <input class="form-check-input commission-checkbox" type="checkbox" 
                                               value="${sale.id}" onchange="toggleCommissionSelection(${sale.id})">
                                    </div>
                                </td>
                                <td><strong>${sale.sale_reference}</strong></td>
                                <td>
                                    ${sale.referral_code}
                                    <br><small class="text-muted">${sale.commissions[0]?.affiliate_name || 'N/A'}</small>
                                </td>
                                <td><strong>$${parseFloat(sale.sale_amount).toFixed(2)}</strong></td>
                                <td><strong>$${totalCommission.toFixed(2)}</strong></td>
                                <td>
                                    <small class="text-muted">${sale.commissions.length} levels</small>
                                </td>
                                <td>${new Date(sale.verified_at).toLocaleDateString()}</td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-success" onclick="releaseSingleCommission(${sale.id})">
                                            <i class="fas fa-money-bill-wave"></i>
                                        </button>
                                        <button class="btn btn-info" onclick="viewCommissionDetails(${sale.id})">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Render affiliates list
function renderAffiliatesList(affiliates) {
    const container = document.getElementById('affiliatesList');
    
    if (!affiliates || affiliates.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">No affiliates found</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Referral Code</th>
                        <th>Earnings</th>
                        <th>Direct Referrals</th>
                        <th>Total Network</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${affiliates.map(affiliate => `
                        <tr>
                            <td><strong>${affiliate.name}</strong></td>
                            <td>${affiliate.email}</td>
                            <td>
                                <code>${affiliate.referral_code}</code>
                            </td>
                            <td>
                                <strong>$${parseFloat(affiliate.total_earnings).toFixed(2)}</strong>
                                <br><small class="text-muted">Available: $${parseFloat(affiliate.available_balance).toFixed(2)}</small>
                            </td>
                            <td>${affiliate.direct_referrals}</td>
                            <td>${affiliate.total_downline}</td>
                            <td>
                                <span class="badge bg-${affiliate.is_active ? 'success' : 'secondary'}">
                                    ${affiliate.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-info" onclick="viewAffiliateDetails(${affiliate.id})">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-${affiliate.is_active ? 'warning' : 'success'}" 
                                            onclick="toggleAffiliateStatus(${affiliate.id}, ${!affiliate.is_active})">
                                        <i class="fas fa-${affiliate.is_active ? 'pause' : 'play'}"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Render commission settings
function renderCommissionSettings(settings) {
    const container = document.getElementById('commissionSettingsForm');
    
    container.innerHTML = `
        <form id="updateCommissionSettings">
            <div class="mb-3">
                <h6>Commission Levels</h6>
                <div id="commissionLevels">
                    ${settings.map((setting, index) => `
                        <div class="row mb-2 align-items-center">
                            <div class="col-sm-3">
                                <label class="form-label">Level ${setting.level}</label>
                            </div>
                            <div class="col-sm-4">
                                <div class="input-group">
                                    <input type="number" class="form-control" 
                                           value="${setting.rate}" 
                                           min="0" 
                                           max="100" 
                                           step="0.01"
                                           data-level="${setting.level}">
                                    <span class="input-group-text">%</span>
                                </div>
                            </div>
                            <div class="col-sm-5">
                                <small class="text-muted">
                                    ${setting.level === 0 ? 'Direct seller commission' : `Level ${setting.level} upline commission`}
                                </small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="mb-3">
                <label for="maxTotalRate" class="form-label">Maximum Total Commission Rate (%)</label>
                <input type="number" class="form-control" id="maxTotalRate" 
                       value="${settings[0]?.max_total_rate || 25}" 
                       min="0" max="100" step="0.01">
            </div>
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-save me-1"></i>Update Settings
            </button>
        </form>
    `;
    
    // Handle form submission
    document.getElementById('updateCommissionSettings').addEventListener('submit', handleCommissionSettingsUpdate);
}

// Render system status
function renderSystemStatus(validation) {
    const container = document.getElementById('affiliateSystemStatus');
    
    container.innerHTML = `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center">
                <span>Settings Valid:</span>
                <span class="badge bg-${validation.valid ? 'success' : 'danger'}">
                    ${validation.valid ? 'Yes' : 'No'}
                </span>
            </div>
        </div>
        
        ${validation.valid ? `
            <div class="mb-2">
                <small class="text-muted">Total Rate: ${validation.totalRate}%</small>
            </div>
            <div class="mb-2">
                <small class="text-muted">Max Rate: ${validation.maxTotalRate}%</small>
            </div>
            <div class="mb-2">
                <small class="text-muted">Levels: ${validation.levels}</small>
            </div>
        ` : `
            <div class="alert alert-danger">
                ${validation.error}
            </div>
        `}
        
        <hr>
        
        <div class="small">
            <div class="text-muted mb-2">Quick Actions:</div>
            <button class="btn btn-outline-primary btn-sm w-100 mb-2" onclick="exportAffiliateData()">
                <i class="fas fa-download me-1"></i>Export Data
            </button>
            <button class="btn btn-outline-warning btn-sm w-100" onclick="recalculateCommissions()">
                <i class="fas fa-calculator me-1"></i>Recalculate All
            </button>
        </div>
    `;
}

// Initialize event handlers
function initializeAffiliateHandlers() {
    // Refresh buttons
    const refreshButtons = {
        'refreshPendingSales': loadPendingSales,
        'refreshUnpaidCommissions': loadUnpaidCommissions,
        'refreshAffiliates': loadAffiliatesList,
        'searchAffiliates': searchAffiliates
    };
    
    Object.entries(refreshButtons).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        }
    });
    
    // Bulk release commissions
    const bulkReleaseBtn = document.getElementById('bulkReleaseCommissions');
    if (bulkReleaseBtn) {
        bulkReleaseBtn.addEventListener('click', bulkReleaseCommissions);
    }
}

// Verify sale (approve/reject)
async function verifySale(saleId, action) {
    const notes = prompt(`${action === 'approve' ? 'Approve' : 'Reject'} this sale?\n\nOptional notes:`);
    if (notes === null) return; // User cancelled
    
    try {
        const response = await fetchWithAuth(`/api/admin/affiliate/sales/${saleId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, notes })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const result = await response.json();
        showToast(`Sale ${action}d successfully`, 'success');
        
        // Reload pending sales
        await loadPendingSales();
        await loadAffiliateStats();
        
    } catch (error) {
        console.error(`Failed to ${action} sale:`, error);
        showToast(`Failed to ${action} sale: ${error.message}`, 'error');
    }
}

// Release single commission
async function releaseSingleCommission(saleId) {
    if (!confirm('Release commissions for this sale?')) return;
    
    try {
        const response = await fetchWithAuth('/api/admin/affiliate/commissions/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sale_ids: [saleId] })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        showToast('Commission released successfully', 'success');
        await loadUnpaidCommissions();
        await loadAffiliateStats();
        
    } catch (error) {
        console.error('Failed to release commission:', error);
        showToast(`Failed to release commission: ${error.message}`, 'error');
    }
}

// Bulk release commissions
async function bulkReleaseCommissions() {
    if (selectedCommissions.size === 0) {
        showToast('Please select commissions to release', 'warning');
        return;
    }
    
    if (!confirm(`Release commissions for ${selectedCommissions.size} sales?`)) return;
    
    try {
        const response = await fetchWithAuth('/api/admin/affiliate/commissions/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sale_ids: Array.from(selectedCommissions) })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const result = await response.json();
        showToast(`Released ${result.results.filter(r => r.success).length} commissions`, 'success');
        
        selectedCommissions.clear();
        await loadUnpaidCommissions();
        await loadAffiliateStats();
        
    } catch (error) {
        console.error('Failed to release commissions:', error);
        showToast(`Failed to release commissions: ${error.message}`, 'error');
    }
}

// Toggle affiliate status
async function toggleAffiliateStatus(affiliateId, isActive) {
    const action = isActive ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} this affiliate?`)) return;
    
    try {
        const response = await fetchWithAuth(`/api/admin/affiliate/${affiliateId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        showToast(`Affiliate ${action}d successfully`, 'success');
        await loadAffiliatesList();
        
    } catch (error) {
        console.error(`Failed to ${action} affiliate:`, error);
        showToast(`Failed to ${action} affiliate: ${error.message}`, 'error');
    }
}

// Handle commission settings update
async function handleCommissionSettingsUpdate(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const inputs = event.target.querySelectorAll('input[data-level]');
    const settings = [];
    
    inputs.forEach(input => {
        settings.push({
            level: parseInt(input.dataset.level),
            rate: parseFloat(input.value),
            max_total_rate: parseFloat(document.getElementById('maxTotalRate').value)
        });
    });
    
    try {
        const response = await fetchWithAuth('/api/admin/affiliate/settings/commission', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        showToast('Commission settings updated successfully', 'success');
        await loadAffiliateSettings();
        
    } catch (error) {
        console.error('Failed to update settings:', error);
        showToast(`Failed to update settings: ${error.message}`, 'error');
    }
}

// Toggle commission selection
function toggleCommissionSelection(saleId) {
    const checkbox = document.querySelector(`input[value="${saleId}"]`);
    if (checkbox.checked) {
        selectedCommissions.add(saleId);
    } else {
        selectedCommissions.delete(saleId);
    }
    
    // Update bulk release button
    const bulkBtn = document.getElementById('bulkReleaseCommissions');
    bulkBtn.disabled = selectedCommissions.size === 0;
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCommissions');
    const totalCheckboxes = document.querySelectorAll('.commission-checkbox').length;
    selectAllCheckbox.indeterminate = selectedCommissions.size > 0 && selectedCommissions.size < totalCheckboxes;
    selectAllCheckbox.checked = selectedCommissions.size === totalCheckboxes;
}

// Toggle all commissions
function toggleAllCommissions() {
    const selectAllCheckbox = document.getElementById('selectAllCommissions');
    const checkboxes = document.querySelectorAll('.commission-checkbox');
    
    if (selectAllCheckbox.checked) {
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedCommissions.add(parseInt(cb.value));
        });
    } else {
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        selectedCommissions.clear();
    }
    
    // Update bulk release button
    const bulkBtn = document.getElementById('bulkReleaseCommissions');
    bulkBtn.disabled = selectedCommissions.size === 0;
}

// Search affiliates
async function searchAffiliates() {
    const searchTerm = document.getElementById('affiliateSearch').value.trim();
    
    try {
        const url = new URL('/api/admin/affiliate/list', window.location.origin);
        if (searchTerm) {
            url.searchParams.set('search', searchTerm);
        }
        
        const response = await fetchWithAuth(url.toString());
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        renderAffiliatesList(data.data);
        
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed', 'error');
    }
}

// Update pending sales badge
function updatePendingSalesBadge(count) {
    const badge = document.getElementById('pendingSalesBadge');
    const mainBadge = document.getElementById('affiliatePendingBadge');
    
    if (count > 0) {
        if (badge) {
            badge.textContent = count;
            badge.style.display = 'inline';
        }
        if (mainBadge) {
            mainBadge.textContent = count;
            mainBadge.classList.remove('d-none');
        }
    } else {
        if (badge) badge.style.display = 'none';
        if (mainBadge) mainBadge.classList.add('d-none');
    }
}

// Utility functions
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="text-center py-3"><div class="spinner-border" role="status"></div></div>';
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}

function showAffiliateError(message) {
    console.error(message);
    // Could show a toast or alert here
}

function showToast(message, type = 'info') {
    // Simple toast implementation - could be enhanced with Bootstrap toast
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message); // Fallback - should implement proper toast
}

// Fetch with authentication
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    return fetch(url, { ...options, headers });
}

// Export functions for global access
window.verifySale = verifySale;
window.releaseSingleCommission = releaseSingleCommission;
window.bulkReleaseCommissions = bulkReleaseCommissions;
window.toggleAffiliateStatus = toggleAffiliateStatus;
window.toggleCommissionSelection = toggleCommissionSelection;
window.toggleAllCommissions = toggleAllCommissions;
window.searchAffiliates = searchAffiliates;