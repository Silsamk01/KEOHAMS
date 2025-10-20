/**
 * Enhanced KYC Verification Form
 * Handles document upload, preview, validation, and webcam capture
 */

const API_BASE = 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// File upload handlers with preview
function setupFileUpload(inputId, cardId, previewId, infoId) {
  const input = document.getElementById(inputId);
  const card = document.getElementById(cardId);
  const preview = document.getElementById(previewId);
  const info = document.getElementById(infoId);

  if (!input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      card.classList.add('error');
      info.textContent = 'File too large (max 10MB)';
      info.style.color = '#dc3545';
      input.value = '';
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      card.classList.add('error');
      info.textContent = 'Invalid file type. Use JPG, PNG, or PDF';
      info.style.color = '#dc3545';
      input.value = '';
      return;
    }

    // Show preview for images
    card.classList.remove('error');
    card.classList.add('has-file');
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('d-none');
      };
      reader.readAsDataURL(file);
    } else {
      preview.classList.add('d-none');
    }

    // Show file info
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    info.textContent = `${file.name} (${sizeMB} MB)`;
    info.style.color = '#28a745';
  });

  // Drag and drop
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.style.borderColor = '#2f5337';
    card.style.background = 'rgba(47, 83, 55, 0.1)';
  });

  card.addEventListener('dragleave', (e) => {
    card.style.borderColor = '';
    card.style.background = '';
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.style.borderColor = '';
    card.style.background = '';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      input.files = files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// Webcam capture
let stream = null;
let capturedBlob = null;

document.getElementById('captureWebcamBtn')?.addEventListener('click', async () => {
  const modal = new bootstrap.Modal(document.getElementById('webcamModal'));
  modal.show();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: 'user' } 
    });
    document.getElementById('webcam').srcObject = stream;
  } catch (error) {
    alert('Could not access webcam: ' + error.message);
    modal.hide();
  }
});

document.getElementById('captureBtn')?.addEventListener('click', () => {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    capturedBlob = blob;
    
    // Show preview
    const preview = document.getElementById('selfiePreview');
    preview.src = canvas.toDataURL('image/jpeg');
    preview.classList.remove('d-none');

    // Update card
    const card = document.getElementById('selfieCard');
    card.classList.add('has-file');
    
    const info = document.getElementById('selfieInfo');
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    info.textContent = `Captured photo (${sizeMB} MB)`;
    info.style.color = '#28a745';

    // Show retake button
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'inline-block';
  }, 'image/jpeg', 0.9);
});

document.getElementById('retakeBtn')?.addEventListener('click', () => {
  document.getElementById('captureBtn').style.display = 'inline-block';
  document.getElementById('retakeBtn').style.display = 'none';
  capturedBlob = null;
});

// Stop webcam when modal closes
document.getElementById('webcamModal')?.addEventListener('hidden.bs.modal', () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // If captured, create file object
  if (capturedBlob) {
    const file = new File([capturedBlob], 'selfie.jpg', { type: 'image/jpeg' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('live_photo').files = dataTransfer.files;
  }
});

// Validate date inputs
document.getElementById('address_proof_date')?.addEventListener('change', (e) => {
  const selectedDate = new Date(e.target.value);
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  if (selectedDate < threeMonthsAgo) {
    alert('Address proof must be dated within the last 3 months');
    e.target.value = '';
  }

  if (selectedDate > today) {
    alert('Document date cannot be in the future');
    e.target.value = '';
  }
});

document.getElementById('id_expiry_date')?.addEventListener('change', (e) => {
  const expiryDate = new Date(e.target.value);
  const today = new Date();

  if (expiryDate < today) {
    alert('Warning: Your ID has expired. You may still submit, but it will require additional review.');
  }
});

// Form submission
document.getElementById('kycForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('uploadProgress');
  const progressText = document.getElementById('progressText');

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';
  progressContainer.classList.remove('d-none');

  try {
    // Check if user has valid token
    const token = getToken();
    if (!token) {
      throw new Error('Please log in again to upload documents');
    }

    // Validate form data before upload
    const formData = new FormData(e.target);
    
    // Handle GDPR consent checkbox explicitly
    const gdprCheckbox = document.getElementById('gdpr_consent');
    if (!gdprCheckbox || !gdprCheckbox.checked) {
      throw new Error('You must consent to data processing to proceed');
    }
    // Ensure consent is properly sent to backend
    formData.set('gdpr_consent', 'true');
    
    const requiredFiles = ['id_document', 'live_photo', 'address_proof'];
    
    for (const fieldName of requiredFiles) {
      const file = formData.get(fieldName);
      if (!file || file.size === 0) {
        throw new Error(`Please select ${fieldName.replace('_', ' ')}`);
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`${fieldName.replace('_', ' ')} is too large (max 10MB)`);
      }
    }

    progressText.textContent = 'Starting upload...';

    // Use XMLHttpRequest for progress tracking with timeout
    const xhr = new XMLHttpRequest();
    let uploadTimeout;

    // Set upload timeout (2 minutes)
    uploadTimeout = setTimeout(() => {
      xhr.abort();
      throw new Error('Upload timed out. Please check your connection and try again.');
    }, 120000); // 2 minutes

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressBar.style.width = percentComplete + '%';
        progressText.textContent = `Uploading: ${Math.round(percentComplete)}%`;
      }
    });

    xhr.addEventListener('load', () => {
      clearTimeout(uploadTimeout);
      
      if (xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText);
          
          // Show success
          progressBar.classList.remove('progress-bar-animated');
          progressBar.classList.add('bg-success');
          progressBar.style.width = '100%';
          progressText.textContent = 'Upload complete! Processing documents...';

          setTimeout(() => {
            alert('✅ KYC documents submitted successfully!\n\nYour documents are being processed. You will receive a notification when verification is complete.');
            window.location.reload();
          }, 2000);
        } catch (parseError) {
          throw new Error('Server response error. Please try again.');
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          throw new Error(error.message || `Server error (${xhr.status})`);
        } catch (parseError) {
          throw new Error(`Upload failed with status ${xhr.status}. Please try again.`);
        }
      }
    });

    xhr.addEventListener('error', () => {
      clearTimeout(uploadTimeout);
      throw new Error('Network error during upload. Please check your connection.');
    });

    xhr.addEventListener('abort', () => {
      clearTimeout(uploadTimeout);
      throw new Error('Upload was cancelled or timed out.');
    });

    xhr.open('POST', `${API_BASE}/kyc/enhanced/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    
    progressText.textContent = 'Uploading files...';
    xhr.send(formData);

  } catch (error) {
    console.error('Upload error:', error);
    alert('❌ Upload failed: ' + error.message);
    
    // Re-enable submit
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i> Submit for Verification';
    progressContainer.classList.add('d-none');
  }
});

// Reveal and reset the upload form for resubmission
function showResubmissionForm() {
  const formWrap = document.getElementById('uploadFormContainer');
  const form = document.getElementById('kycForm');
  if (!formWrap || !form) return;

  // Unhide form
  formWrap.classList.remove('d-none');

  // Reset form and UI
  try { form.reset(); } catch(_) {}
  // Clear file cards state
  ['idCard','selfieCard','addressCard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('has-file','error');
  });
  // Hide previews and reset info text
  const previewIds = ['idPreview','selfiePreview','addressPreview'];
  const infoIds = ['idInfo','selfieInfo','addressInfo'];
  previewIds.forEach(pid => { const p = document.getElementById(pid); if (p) { p.src = ''; p.classList.add('d-none'); } });
  infoIds.forEach(iid => { const i = document.getElementById(iid); if (i) { i.textContent = 'No file selected'; i.style.color = ''; } });

  // Reset progress UI
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('uploadProgress');
  const progressText = document.getElementById('progressText');
  if (progressContainer) progressContainer.classList.add('d-none');
  if (progressBar) { progressBar.classList.remove('bg-success'); progressBar.style.width = '0%'; }
  if (progressText) progressText.textContent = '';

  // Ensure submit button is enabled
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i> Submit for Verification'; }

  // Scroll into view
  try { formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
}

// Check and display current KYC status
async function checkKYCStatus() {
  try {
    const response = await fetch(`${API_BASE}/kyc/enhanced/status`, {
      headers: authHeaders()
    });

    if (!response.ok) throw new Error('Failed to check status');

    const data = await response.json();

    if (data.status !== 'NOT_SUBMITTED') {
      
      // Show status
      const statusContainer = document.getElementById('statusContainer');
      statusContainer.classList.remove('d-none');

      const statusDisplay = document.getElementById('statusDisplay');
      const submission = data.submission;

      const allowResubmission = submission.status === 'RESUBMIT_REQUIRED' || submission.status === 'REJECTED';
      if (!allowResubmission) {
        // Hide upload form for non-resubmission states
        document.getElementById('uploadFormContainer').classList.add('d-none');
      }

      let statusClass = 'status-pending';
      let statusText = 'Pending';
      let statusIcon = 'clock';

      switch (submission.status) {
        case 'UNDER_REVIEW':
          statusClass = 'status-under-review';
          statusText = 'Under Review';
          statusIcon = 'search';
          break;
        case 'APPROVED':
          statusClass = 'status-approved';
          statusText = 'Approved';
          statusIcon = 'check-circle';
          break;
        case 'REJECTED':
          statusClass = 'status-rejected';
          statusText = 'Rejected';
          statusIcon = 'times-circle';
          break;
        case 'RESUBMIT_REQUIRED':
          statusClass = 'status-resubmit';
          statusText = 'Resubmission Required';
          statusIcon = 'exclamation-triangle';
          break;
      }

      statusDisplay.innerHTML = `
        <div class="d-flex align-items-center mb-3">
          <span class="status-badge ${statusClass}">
            <i class="fas fa-${statusIcon} me-2"></i>${statusText}
          </span>
        </div>
        
        <div class="row g-3">
          <div class="col-md-6">
            <strong>Submission ID:</strong> #${submission.id}
          </div>
          <div class="col-md-6">
            <strong>Submitted:</strong> ${new Date(submission.created_at).toLocaleString()}
          </div>
          <div class="col-md-6">
            <strong>ID Type:</strong> ${submission.id_type.replace('_', ' ')}
          </div>
          <div class="col-md-6">
            <strong>Face Match:</strong> 
            ${submission.face_match_score ? submission.face_match_score + '%' : 'Processing...'}
          </div>
          <div class="col-md-6">
            <strong>Liveness Check:</strong> 
            ${submission.liveness_check_passed === true ? '✅ Passed' : submission.liveness_check_passed === false ? '❌ Failed' : '⏳ Processing...'}
          </div>
          <div class="col-md-6">
            <strong>OCR Status:</strong> ${submission.ocr_status}
          </div>
          ${submission.document_expired ? '<div class="col-12"><div class="alert alert-danger">⚠️ Document has expired</div></div>' : ''}
          ${submission.admin_remarks ? `<div class="col-12"><strong>Admin Remarks:</strong><br><p class="text-muted">${submission.admin_remarks}</p></div>` : ''}
        </div>

        ${allowResubmission ? `
          <div class="mt-3">
            <button id="btnResubmitDocs" class="btn btn-primary">
              <i class="fas fa-upload me-2"></i> Submit New Documents
            </button>
          </div>
        ` : ''}
      `;

      // Wire resubmission button if present
      const btnResubmit = document.getElementById('btnResubmitDocs');
      if (btnResubmit) {
        btnResubmit.addEventListener('click', (e) => {
          e.preventDefault();
          showResubmissionForm();
        });
      }
    }
  } catch (error) {
    console.error('Status check error:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Setup file uploads
  setupFileUpload('id_document', 'idCard', 'idPreview', 'idInfo');
  setupFileUpload('live_photo', 'selfieCard', 'selfiePreview', 'selfieInfo');
  setupFileUpload('address_proof', 'addressCard', 'addressPreview', 'addressInfo');

  // Check existing status
  checkKYCStatus();
});
