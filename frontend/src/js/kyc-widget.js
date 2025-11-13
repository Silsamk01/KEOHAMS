/**
 * Customer KYC Status Widget for Dashboard
 * Shows KYC verification status and action buttons
 */

import { API_BASE } from './config.js';

function token() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Render KYC status widget on dashboard
 */
async function renderKYCWidget() {
  const container = document.getElementById('kycWidget');
  if (!container) return;

  try {
    // Get user profile with KYC status
    const response = await fetch(`${API_BASE}/user/profile`, {
      headers: authHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }

    const profile = await response.json();
    const kyc = profile.kyc;

    // Render based on KYC status
    if (!kyc.submitted || kyc.status === 'NOT_SUBMITTED') {
      container.innerHTML = renderNotSubmitted();
    } else if (kyc.status === 'PENDING' || kyc.status === 'UNDER_REVIEW') {
      container.innerHTML = renderPending(kyc);
    } else if (kyc.status === 'APPROVED') {
      // Hide the widget if approved
      container.style.display = 'none';
      unlockPlatformFeatures();
    } else if (kyc.status === 'REJECTED') {
      container.innerHTML = renderRejected(kyc);
    }

  } catch (error) {
    console.error('Error loading KYC status:', error);
    container.innerHTML = `
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Unable to load KYC status. Please refresh the page.
      </div>
    `;
  }
}

function renderNotSubmitted() {
  return `
    <div class="card border-warning">
      <div class="card-body">
        <div class="d-flex align-items-start">
          <div class="flex-shrink-0">
            <i class="fas fa-id-card text-warning" style="font-size: 2.5rem;"></i>
          </div>
          <div class="flex-grow-1 ms-3">
            <h5 class="card-title text-warning mb-2">
              <i class="fas fa-exclamation-circle me-2"></i>
              KYC Verification Required
            </h5>
            <p class="card-text text-muted mb-3">
              To access platform features like shopping, quotations, and orders, you need to complete your KYC verification.
            </p>
            <div class="alert alert-info py-2 mb-3">
              <small>
                <i class="fas fa-info-circle me-1"></i>
                <strong>Required Documents:</strong> Government ID, Live Selfie, Address Proof
              </small>
            </div>
            <a href="/kyc-enhanced.html" class="btn btn-warning">
              <i class="fas fa-upload me-2"></i>Start KYC Verification
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPending(kyc) {
  const submittedDate = new Date(kyc.submittedAt).toLocaleDateString();
  return `
    <div class="card border-info">
      <div class="card-body">
        <div class="d-flex align-items-start">
          <div class="flex-shrink-0">
            <i class="fas fa-clock text-info" style="font-size: 2.5rem;"></i>
          </div>
          <div class="flex-grow-1 ms-3">
            <h5 class="card-title text-info mb-2">
              <i class="fas fa-hourglass-half me-2"></i>
              KYC Under Review
            </h5>
            <p class="card-text text-muted mb-2">
              Your KYC documents are being reviewed by our team. This usually takes 24-48 hours.
            </p>
            <small class="text-muted">
              <i class="fas fa-calendar me-1"></i>
              Submitted on ${submittedDate}
            </small>
            <div class="alert alert-info py-2 mt-3 mb-0">
              <small>
                <i class="fas fa-lock me-1"></i>
                <strong>Access Restricted:</strong> You'll gain full platform access once your KYC is approved.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRejected(kyc) {
  const rejectedDate = kyc.reviewedAt ? new Date(kyc.reviewedAt).toLocaleDateString() : 'Recently';
  return `
    <div class="card border-danger">
      <div class="card-body">
        <div class="d-flex align-items-start">
          <div class="flex-shrink-0">
            <i class="fas fa-times-circle text-danger" style="font-size: 2.5rem;"></i>
          </div>
          <div class="flex-grow-1 ms-3">
            <h5 class="card-title text-danger mb-2">
              <i class="fas fa-exclamation-triangle me-2"></i>
              KYC Verification Rejected
            </h5>
            <p class="card-text text-muted mb-2">
              Your KYC submission was rejected. Please review the remarks below and resubmit.
            </p>
            ${kyc.adminRemarks ? `
              <div class="alert alert-danger py-2 mb-3">
                <small>
                  <strong>Admin Remarks:</strong><br>
                  ${escapeHtml(kyc.adminRemarks)}
                </small>
              </div>
            ` : ''}
            <small class="text-muted d-block mb-3">
              <i class="fas fa-calendar me-1"></i>
              Reviewed on ${rejectedDate}
            </small>
            <a href="/kyc-enhanced.html" class="btn btn-danger">
              <i class="fas fa-redo me-2"></i>Resubmit KYC Documents
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Unlock platform features when KYC is approved
 */
function unlockPlatformFeatures() {
  // Remove disabled states from navigation
  document.querySelectorAll('[data-requires-kyc]').forEach(el => {
    el.classList.remove('disabled');
    el.removeAttribute('data-requires-kyc');
  });

  // Show success notification (optional)
  const successNotif = document.getElementById('kycSuccessNotif');
  if (successNotif) {
    successNotif.style.display = 'block';
    setTimeout(() => successNotif.style.display = 'none', 5000);
  }
}

/**
 * Lock platform features when KYC is not approved
 */
function lockPlatformFeatures() {
  // Add disabled states to navigation
  const shopLink = document.querySelector('a[href="/shop.html"], a[href="shop.html"]');
  const cartLink = document.querySelector('a[href="/cart.html"], a[href="cart.html"]');
  
  if (shopLink) {
    shopLink.setAttribute('data-requires-kyc', 'true');
    shopLink.classList.add('disabled');
    shopLink.addEventListener('click', preventKYCRequired);
  }
  
  if (cartLink) {
    cartLink.setAttribute('data-requires-kyc', 'true');
    cartLink.classList.add('disabled');
    cartLink.addEventListener('click', preventKYCRequired);
  }
}

function preventKYCRequired(e) {
  e.preventDefault();
  alert('KYC verification required. Please complete your KYC to access this feature.');
  window.location.href = '/kyc-enhanced.html';
}

/**
 * Check KYC status and handle feature access
 */
async function checkKYCStatus() {
  try {
    const response = await fetch(`${API_BASE}/user/profile`, {
      headers: authHeaders()
    });

    if (!response.ok) return;

    const profile = await response.json();
    const kyc = profile.kyc;

    if (kyc.status !== 'APPROVED') {
      lockPlatformFeatures();
    } else {
      unlockPlatformFeatures();
    }

    return kyc;
  } catch (error) {
    console.error('Error checking KYC status:', error);
    return null;
  }
}

/**
 * Initialize KYC widget on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  if (token()) {
    renderKYCWidget();
    checkKYCStatus();
  }
});

// Export functions for use in other scripts
window.KYCWidget = {
  render: renderKYCWidget,
  checkStatus: checkKYCStatus,
  lock: lockPlatformFeatures,
  unlock: unlockPlatformFeatures
};
