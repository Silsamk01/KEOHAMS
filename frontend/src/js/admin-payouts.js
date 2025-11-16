// Admin Payouts Management
const API_BASE = window.location.origin + '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

let currentPayoutFilter = 'PENDING';

// Load payout stats
async function loadPayoutStats() {
  try {
    // Get withdrawal stats from affiliate stats endpoint
    const stats = await fetchJSON(`${API_BASE}/admin/affiliate/stats`);
    
    // Update stat cards
    document.getElementById('payoutStatsPending').textContent = stats.pendingWithdrawals || 0;
    document.getElementById('payoutStatsPaid').textContent = `₦${(stats.totalPaidOut || 0).toLocaleString('en-NG')}`;
    
    // Update badge
    const badge = document.getElementById('payoutsPendingBadge');
    if (stats.pendingWithdrawals > 0) {
      badge.textContent = stats.pendingWithdrawals;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  } catch (error) {
    console.error('Failed to load payout stats:', error);
  }
}

// Filter payouts by status
async function filterPayouts(status) {
  currentPayoutFilter = status;
  await loadPayouts();
}

// Load payouts list
async function loadPayouts() {
  const tbody = document.getElementById('payoutsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  try {
    const params = new URLSearchParams();
    if (currentPayoutFilter !== 'ALL') {
      params.set('status', currentPayoutFilter);
    }
    
    const data = await fetchJSON(`${API_BASE}/admin/affiliate/withdrawals?${params}`);
    const withdrawals = data.withdrawals || [];
    
    if (withdrawals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No payout requests found</td></tr>';
      return;
    }
    
    tbody.innerHTML = withdrawals.map(w => {
      const statusBadge = {
        'PENDING': 'warning',
        'APPROVED': 'success',
        'PROCESSING': 'info',
        'COMPLETED': 'secondary',
        'REJECTED': 'danger',
        'CANCELLED': 'dark'
      }[w.status] || 'secondary';
      
      return `
        <tr>
          <td>${new Date(w.created_at).toLocaleDateString()}</td>
          <td>
            <div>${w.affiliate_name || 'N/A'}</div>
            <small class="text-muted">${w.affiliate_email || ''}</small>
          </td>
          <td><strong>₦${Number(w.amount || 0).toLocaleString('en-NG', {minimumFractionDigits: 2})}</strong></td>
          <td>
            <span class="badge bg-light text-dark">${w.method || 'N/A'}</span>
          </td>
          <td>
            <span class="badge bg-${statusBadge}">${w.status}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="viewPayoutDetails(${w.id})">
              <i class="fas fa-eye"></i> View
            </button>
            ${w.status === 'PENDING' ? `
              <button class="btn btn-sm btn-success" onclick="approvePayout(${w.id})">
                <i class="fas fa-check"></i> Approve
              </button>
              <button class="btn btn-sm btn-danger" onclick="rejectPayout(${w.id})">
                <i class="fas fa-times"></i> Reject
              </button>
            ` : ''}
            ${w.status === 'APPROVED' ? `
              <button class="btn btn-sm btn-info" onclick="markAsProcessing(${w.id})">
                <i class="fas fa-spinner"></i> Processing
              </button>
            ` : ''}
            ${w.status === 'PROCESSING' ? `
              <button class="btn btn-sm btn-success" onclick="markAsPaid(${w.id})">
                <i class="fas fa-check-circle"></i> Mark Paid
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Failed to load payouts:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load payouts</td></tr>';
  }
}

// View payout details
async function viewPayoutDetails(id) {
  try {
    const withdrawal = await fetchJSON(`${API_BASE}/admin/affiliate/withdrawals/${id}`);
    const details = withdrawal.payment_details || {};
    
    let detailsHTML = '<div class="row">';
    detailsHTML += `<div class="col-md-6">`;
    detailsHTML += `<p><strong>Affiliate:</strong> ${withdrawal.affiliate_name}</p>`;
    detailsHTML += `<p><strong>Email:</strong> ${withdrawal.affiliate_email}</p>`;
    detailsHTML += `<p><strong>Amount:</strong> ₦${Number(withdrawal.amount).toLocaleString('en-NG', {minimumFractionDigits: 2})}</p>`;
    detailsHTML += `<p><strong>Method:</strong> ${withdrawal.method}</p>`;
    detailsHTML += `<p><strong>Status:</strong> <span class="badge bg-primary">${withdrawal.status}</span></p>`;
    detailsHTML += `<p><strong>Requested:</strong> ${new Date(withdrawal.created_at).toLocaleString()}</p>`;
    detailsHTML += `</div><div class="col-md-6">`;
    detailsHTML += `<h6>Payment Details:</h6>`;
    
    if (withdrawal.method === 'BANK_TRANSFER') {
      detailsHTML += `<p><strong>Bank:</strong> ${details.bank_name || 'N/A'}</p>`;
      detailsHTML += `<p><strong>Account Name:</strong> ${details.account_name || 'N/A'}</p>`;
      detailsHTML += `<p><strong>Account Number:</strong> ${details.account_number || 'N/A'}</p>`;
    } else if (withdrawal.method === 'MOBILE_MONEY') {
      detailsHTML += `<p><strong>Provider:</strong> ${details.provider || 'N/A'}</p>`;
      detailsHTML += `<p><strong>Phone:</strong> ${details.phone_number || 'N/A'}</p>`;
    } else if (withdrawal.method === 'PAYPAL') {
      detailsHTML += `<p><strong>PayPal Email:</strong> ${details.paypal_email || 'N/A'}</p>`;
    } else if (withdrawal.method === 'CRYPTOCURRENCY') {
      detailsHTML += `<p><strong>Currency:</strong> ${details.crypto_currency || 'N/A'}</p>`;
      detailsHTML += `<p><strong>Wallet:</strong> ${details.wallet_address || 'N/A'}</p>`;
    }
    
    detailsHTML += `</div></div>`;
    
    if (withdrawal.admin_notes) {
      detailsHTML += `<hr><p><strong>Admin Notes:</strong> ${withdrawal.admin_notes}</p>`;
    }
    
    // Show in a simple alert for now (could be enhanced with a modal)
    alert(`Payout Details\n\n${detailsHTML.replace(/<[^>]*>/g, '\n')}`);
  } catch (error) {
    alert('Failed to load payout details: ' + error.message);
  }
}

// Approve payout
async function approvePayout(id) {
  if (!confirm('Approve this payout request?')) return;
  
  try {
    await fetchJSON(`${API_BASE}/admin/affiliate/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE' })
    });
    
    alert('Payout approved successfully');
    await loadPayouts();
    await loadPayoutStats();
  } catch (error) {
    alert('Failed to approve payout: ' + error.message);
  }
}

// Reject payout
async function rejectPayout(id) {
  const reason = prompt('Enter rejection reason:');
  if (!reason) return;
  
  try {
    await fetchJSON(`${API_BASE}/admin/affiliate/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'REJECT',
        admin_notes: reason
      })
    });
    
    alert('Payout rejected');
    await loadPayouts();
    await loadPayoutStats();
  } catch (error) {
    alert('Failed to reject payout: ' + error.message);
  }
}

// Mark as processing
async function markAsProcessing(id) {
  if (!confirm('Mark this payout as processing?')) return;
  
  try {
    await fetchJSON(`${API_BASE}/admin/affiliate/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action: 'PROCESSING' })
    });
    
    alert('Marked as processing');
    await loadPayouts();
    await loadPayoutStats();
  } catch (error) {
    alert('Failed to update status: ' + error.message);
  }
}

// Mark as paid
async function markAsPaid(id) {
  const reference = prompt('Enter transaction reference (optional):');
  
  try {
    await fetchJSON(`${API_BASE}/admin/affiliate/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'COMPLETE',
        transaction_reference: reference || null
      })
    });
    
    alert('Payout marked as completed!');
    await loadPayouts();
    await loadPayoutStats();
  } catch (error) {
    alert('Failed to mark as paid: ' + error.message);
  }
}

// Initialize on tab show
document.getElementById('tab-payouts')?.addEventListener('shown.bs.tab', () => {
  loadPayoutStats();
  loadPayouts();
});

// Make functions global
window.filterPayouts = filterPayouts;
window.viewPayoutDetails = viewPayoutDetails;
window.approvePayout = approvePayout;
window.rejectPayout = rejectPayout;
window.markAsProcessing = markAsProcessing;
window.markAsPaid = markAsPaid;
