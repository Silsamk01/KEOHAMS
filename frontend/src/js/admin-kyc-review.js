/**
 * Admin KYC Review Dashboard JavaScript
 */

const API_BASE = 'http://localhost:4000/api';

function token() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...authHeaders()
    }
  });
  const text = await res.text();
  if (!res.ok) {
    const message = text || res.statusText || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

let currentPage = 1;
const pageSize = 20;
let currentFilter = 'ALL';

// Load KYC submissions list
async function loadKYCList() {
  try {
    const params = new URLSearchParams({
      page: currentPage,
      pageSize: pageSize
    });

    if (currentFilter && currentFilter !== 'ALL') {
      params.append('status', currentFilter);
    }

    const data = await fetchJSON(`${API_BASE}/kyc/enhanced/admin/list?${params}`);
    
    renderKYCList(data.data);
    renderPagination(data.total, data.page, data.pageSize);
    updateStats(data.data);
  } catch (error) {
    console.error('Failed to load KYC list:', error);
    if (error.status === 401) {
      alert('Your session has expired or you are not signed in. Please sign in again.');
      window.location.href = '/#signin';
      return;
    }
    if (error.status === 403) {
      alert('Access denied: Admin role required to review KYC. Please log in with an admin account.');
      return;
    }
    alert('Failed to load KYC submissions: ' + (error.message || 'Unknown error'));
  }
}

// Render KYC submissions table
function renderKYCList(submissions) {
  const tbody = document.getElementById('kycTableBody');
  if (!tbody) return;

  if (submissions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No submissions found</td></tr>';
    return;
  }

  tbody.innerHTML = submissions.map(sub => {
    const statusClass = {
      'PENDING': 'badge bg-warning text-dark',
      'UNDER_REVIEW': 'badge bg-info',
      'APPROVED': 'badge bg-success',
      'REJECTED': 'badge bg-danger',
      'RESUBMIT_REQUIRED': 'badge bg-warning'
    }[sub.status] || 'badge bg-secondary';

    const submitted = sub?.created_at ? new Date(sub.created_at).toLocaleString() : '-';
    const similarity = (typeof sub?.face_match_score === 'number' || (typeof sub?.face_match_score === 'string' && sub.face_match_score !== ''))
      ? `${sub.face_match_score}%` : 'N/A';
    const autoDecision = [
      (sub.face_match_status ? `Face: ${sub.face_match_status}` : null),
      (typeof sub.liveness_check_passed === 'boolean' ? `Live: ${sub.liveness_check_passed ? 'PASS' : 'FAIL'}` : null),
      (sub.ocr_status ? `OCR: ${sub.ocr_status}` : null)
    ].filter(Boolean).join(' · ');

    return `
      <tr>
        <td>#${sub.id}</td>
        <td>
          <strong>${sub.user_name || 'N/A'}</strong><br>
          <small class="text-muted">${sub.user_email || ''}</small>
        </td>
        <td>${submitted}</td>
        <td><span class="${statusClass}">${sub.status}</span></td>
        <td>${autoDecision || '-'}</td>
        <td>${similarity}</td>
        <td>
          <button class="btn btn-sm btn-primary kyc-review-btn" data-id="${sub.id}">
            <i class="fas fa-eye"></i> Review
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Wire review buttons
  wireKYCRowActions();
}

function wireKYCRowActions() {
  const buttons = document.querySelectorAll('.kyc-review-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      if (!id) return;
      viewKYCDetail(id);
    });
  });
}

// Render pagination
function renderPagination(total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize);
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '<ul class="pagination justify-content-center">';
  
  // Previous
  html += `<li class="page-item ${page <= 1 ? 'disabled' : ''}">
    <a class="page-link" href="#" onclick="changePage(${page - 1}); return false;">Previous</a>
  </li>`;

  // Pages
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<li class="page-item ${i === page ? 'active' : ''}">
      <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
    </li>`;
  }

  // Next
  html += `<li class="page-item ${page >= totalPages ? 'disabled' : ''}">
    <a class="page-link" href="#" onclick="changePage(${page + 1}); return false;">Next</a>
  </li>`;

  html += '</ul>';
  pagination.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  loadKYCList();
}

// Update stats
function updateStats(submissions) {
  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'PENDING' || s.status === 'UNDER_REVIEW').length,
    approved: submissions.filter(s => s.status === 'APPROVED').length,
    rejected: submissions.filter(s => s.status === 'REJECTED').length
  };

  const elTotal = document.getElementById('statTotal');
  if (elTotal) elTotal.textContent = String(stats.total);
  const elPending = document.getElementById('statPending');
  if (elPending) elPending.textContent = String(stats.pending);
  const elApproved = document.getElementById('statApproved');
  if (elApproved) elApproved.textContent = String(stats.approved);
  const elRejected = document.getElementById('statRejected');
  if (elRejected) elRejected.textContent = String(stats.rejected);

  // Update sidebar badge
  const badge = document.getElementById('kycPendingBadge');
  if (badge) {
    if (stats.pending > 0) {
      badge.textContent = stats.pending;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

// View detailed KYC submission
async function viewKYCDetail(id) {
  try {
    const data = await fetchJSON(`${API_BASE}/kyc/enhanced/admin/${id}`);
    
    // Populate modal with data
    renderDetailModal(data);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('kycDetailModal'));
    modal.show();
  } catch (error) {
    console.error('Failed to load KYC detail:', error);
    if (error.status === 401) {
      alert('Your session has expired or you are not signed in. Please sign in again.');
      window.location.href = '/#signin';
      return;
    }
    if (error.status === 403) {
      alert('Access denied: Admin role required to review KYC. Please log in with an admin account.');
      return;
    }
    alert('Failed to load KYC details: ' + (error.message || 'Unknown error'));
  }
}

// Render detail modal
function renderDetailModal(data) {
  const { submission, ocrResults, faceMatch, auditLog } = data;
  
  document.getElementById('detailUserName').textContent = submission.user_name || 'N/A';
  document.getElementById('detailUserEmail').textContent = submission.user_email || 'N/A';
  document.getElementById('detailIDType').textContent = submission.id_type?.replace('_', ' ') || 'N/A';
  document.getElementById('detailIDNumber').textContent = submission.id_number || 'N/A';
  document.getElementById('detailAddress').textContent = submission.residential_address || 'N/A';
  
  // Face match info
  document.getElementById('detailFaceScore').textContent = submission.face_match_score ? submission.face_match_score + '%' : 'N/A';
  document.getElementById('detailLiveness').textContent = submission.liveness_check_passed ? '✅ Passed' : '❌ Failed';
  
  // OCR info (guard against already-parsed JSON)
  try {
    if (ocrResults && ocrResults.length > 0) {
      const idOCR = ocrResults.find(r => r.document_type === 'ID');
      if (idOCR && idOCR.parsed_fields) {
        let parsed = idOCR.parsed_fields;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { /* leave as string */ }
        }
        document.getElementById('detailOCRData').textContent = typeof parsed === 'string'
          ? parsed
          : JSON.stringify(parsed, null, 2);
      } else {
        document.getElementById('detailOCRData').textContent = '—';
      }
    } else {
      document.getElementById('detailOCRData').textContent = '—';
    }
  } catch (e) {
    console.warn('Failed to render OCR info', e);
    document.getElementById('detailOCRData').textContent = '—';
  }
  
  // Document images (fetch with Authorization and use object URLs)
  const baseURL = `${API_BASE}/kyc/enhanced/admin/${submission.id}/document`;
  const idImg = document.getElementById('detailIDImage');
  const selfieImg = document.getElementById('detailSelfieImage');
  const addrImg = document.getElementById('detailAddressImage');

  async function fetchDocObjectURL(url) {
    const res = await fetch(url, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    const contentType = res.headers.get('Content-Type') || '';
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { objectUrl, contentType };
  }

  function bindImage(el, promise, fallbackAlt) {
    if (!el) return;
    // Reset
    el.removeAttribute('src');
    el.alt = 'Loading…';
    el.style.cursor = 'default';
    el.onclick = null;
    promise.then(({ objectUrl, contentType }) => {
      // If it's an image, display it. Otherwise, show open-in-new-tab ability.
      const isImage = contentType.startsWith('image/');
      if (isImage) {
        el.src = objectUrl;
        el.title = 'Click to open in new tab';
        el.style.cursor = 'zoom-in';
        el.onclick = () => window.open(objectUrl, '_blank');
      } else {
        // Likely a PDF; keep a placeholder and enable click to open
        el.alt = fallbackAlt;
        el.title = 'Click to open in new tab';
        el.style.cursor = 'pointer';
        el.onclick = () => window.open(objectUrl, '_blank');
      }
    }).catch(() => {
      el.alt = fallbackAlt;
      el.style.cursor = 'default';
    });
  }

  // Only attempt fetch if paths exist on submission
  if (submission.id_document_path && idImg) {
    bindImage(idImg, fetchDocObjectURL(`${baseURL}/id`), 'Open ID document');
  } else if (idImg) {
    idImg.alt = 'No ID document uploaded';
  }
  if (submission.live_photo_path && selfieImg) {
    bindImage(selfieImg, fetchDocObjectURL(`${baseURL}/selfie`), 'Open selfie');
  } else if (selfieImg) {
    selfieImg.alt = 'No selfie uploaded';
  }
  if (submission.address_proof_path && addrImg) {
    bindImage(addrImg, fetchDocObjectURL(`${baseURL}/address`), 'Open address proof');
  } else if (addrImg) {
    addrImg.alt = 'No address proof uploaded';
  }
  
  // Store submission ID for actions
  document.getElementById('kycDetailModal').dataset.submissionId = submission.id;
  
  // Audit log
  renderAuditLog(auditLog);
}

// Render audit log
function renderAuditLog(auditLog) {
  const container = document.getElementById('auditLogContainer');
  if (!container) return;

  if (!auditLog || auditLog.length === 0) {
    container.innerHTML = '<p class="text-muted">No audit entries</p>';
    return;
  }

  container.innerHTML = auditLog.map(entry => `
    <div class="border-bottom pb-2 mb-2">
      <div class="d-flex justify-content-between">
        <strong>${entry.action}</strong>
        <small class="text-muted">${new Date(entry.created_at).toLocaleString()}</small>
      </div>
      ${entry.admin_name ? `<small>By: ${entry.admin_name}</small><br>` : ''}
      ${entry.remarks ? `<small class="text-muted">${entry.remarks}</small>` : ''}
    </div>
  `).join('');
}

// Approve KYC
async function approveKYC() {
  const modalEl = document.getElementById('kycDetailModal');
  const submissionId = modalEl.dataset.submissionId;
  const remarks = document.getElementById('adminRemarks').value;

  if (!confirm('Approve this KYC submission?')) return;

  try {
    await fetchJSON(`${API_BASE}/kyc/enhanced/admin/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'APPROVE',
        remarks
      })
    });

    alert('✅ KYC Approved successfully');
    bootstrap.Modal.getInstance(modalEl).hide();
    loadKYCList();
  } catch (error) {
    console.error('Approve failed:', error);
    if (error.status === 401) {
      alert('Session expired. Please sign in again.');
      window.location.href = '/#signin';
      return;
    }
    if (error.status === 403) {
      alert('Access denied. Admin role required.');
      return;
    }
    alert('❌ Failed to approve: ' + (error.message || 'Unknown error'));
  }
}

// Reject KYC
async function rejectKYC() {
  const modalEl = document.getElementById('kycDetailModal');
  const submissionId = modalEl.dataset.submissionId;
  const remarks = document.getElementById('adminRemarks').value;

  if (!remarks.trim()) {
    alert('Please provide a reason for rejection');
    return;
  }

  if (!confirm('Reject this KYC submission?')) return;

  try {
    await fetchJSON(`${API_BASE}/kyc/enhanced/admin/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REJECT',
        remarks
      })
    });

    alert('✅ KYC Rejected');
    bootstrap.Modal.getInstance(modalEl).hide();
    loadKYCList();
  } catch (error) {
    console.error('Reject failed:', error);
    if (error.status === 401) {
      alert('Session expired. Please sign in again.');
      window.location.href = '/#signin';
      return;
    }
    if (error.status === 403) {
      alert('Access denied. Admin role required.');
      return;
    }
    alert('❌ Failed to reject: ' + (error.message || 'Unknown error'));
  }
}

// Request resubmission
async function requestResubmit() {
  const modalEl = document.getElementById('kycDetailModal');
  const submissionId = modalEl.dataset.submissionId;
  const remarks = document.getElementById('adminRemarks').value;

  if (!remarks.trim()) {
    alert('Please provide instructions for resubmission');
    return;
  }

  try {
    await fetchJSON(`${API_BASE}/kyc/enhanced/admin/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REQUEST_RESUBMIT',
        remarks
      })
    });

    alert('✅ Resubmission requested');
    bootstrap.Modal.getInstance(modalEl).hide();
    loadKYCList();
  } catch (error) {
    console.error('Request resubmit failed:', error);
    if (error.status === 401) {
      alert('Session expired. Please sign in again.');
      window.location.href = '/#signin';
      return;
    }
    if (error.status === 403) {
      alert('Access denied. Admin role required.');
      return;
    }
    alert('❌ Failed: ' + (error.message || 'Unknown error'));
  }
}

// Filter change
function filterChange(status) {
  currentFilter = status;
  currentPage = 1;
  loadKYCList();
}

// Export to global scope for onclick handlers
window.viewKYCDetail = viewKYCDetail;
window.changePage = changePage;
window.approveKYC = approveKYC;
window.rejectKYC = rejectKYC;
window.requestResubmit = requestResubmit;
window.filterChange = filterChange;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadKYCList();
  
  // Refresh every 30 seconds
  setInterval(loadKYCList, 30000);

  // Wire filter buttons
  const btnAll = document.getElementById('kycFilterAll');
  const btnPending = document.getElementById('kycFilterPending');
  const btnApproved = document.getElementById('kycFilterApproved');
  const btnRejected = document.getElementById('kycFilterRejected');

  function setActive(btn) {
    [btnAll, btnPending, btnApproved, btnRejected].forEach(b => b && b.classList.remove('active'));
    btn && btn.classList.add('active');
  }

  btnAll?.addEventListener('click', () => { setActive(btnAll); filterChange('ALL'); });
  btnPending?.addEventListener('click', () => { setActive(btnPending); filterChange('PENDING'); });
  btnApproved?.addEventListener('click', () => { setActive(btnApproved); filterChange('APPROVED'); });
  btnRejected?.addEventListener('click', () => { setActive(btnRejected); filterChange('REJECTED'); });
});
