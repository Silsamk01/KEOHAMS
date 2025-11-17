// Admin Newsletter Management
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

// Load newsletter stats
async function loadNewsletterStats() {
  try {
    const stats = await fetchJSON(`${API_BASE}/newsletter/admin/stats`);
    
    document.getElementById('newsletterStatsActive').textContent = stats.activeSubscribers || 0;
    document.getElementById('newsletterStatsCampaigns').textContent = stats.totalCampaigns || 0;
    document.getElementById('newsletterStatsSent').textContent = stats.sentCampaigns || 0;
    document.getElementById('newsletterStatsUnsubscribed').textContent = stats.unsubscribed || 0;
  } catch (error) {
    console.error('Failed to load newsletter stats:', error);
  }
}

// Load subscribers
async function loadSubscribers() {
  const tbody = document.getElementById('subscribersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  try {
    const search = document.getElementById('subscribersSearch')?.value || '';
    const params = new URLSearchParams({ status: 'ALL' });
    if (search) params.set('search', search);
    
    const data = await fetchJSON(`${API_BASE}/newsletter/admin/subscribers?${params}`);
    const subscribers = data.subscribers || [];
    
    if (subscribers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No subscribers found</td></tr>';
      return;
    }
    
    tbody.innerHTML = subscribers.map(s => {
      const statusBadge = s.status === 'ACTIVE' ? 'success' : s.status === 'UNSUBSCRIBED' ? 'warning' : 'danger';
      
      return `
        <tr>
          <td>${s.email}</td>
          <td>${s.name || '—'}</td>
          <td><span class="badge bg-${statusBadge}">${s.status}</span></td>
          <td>${new Date(s.subscribed_at).toLocaleDateString()}</td>
          <td>${s.source || '—'}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteSubscriber(${s.id})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Failed to load subscribers:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load subscribers</td></tr>';
  }
}

// Delete subscriber
async function deleteSubscriber(id) {
  if (!confirm('Delete this subscriber permanently?')) return;
  
  try {
    await fetchJSON(`${API_BASE}/newsletter/admin/subscribers/${id}`, {
      method: 'DELETE'
    });
    
    alert('Subscriber deleted');
    await loadSubscribers();
    await loadNewsletterStats();
  } catch (error) {
    alert('Failed to delete subscriber: ' + error.message);
  }
}

// Load campaigns
async function loadCampaigns() {
  const tbody = document.getElementById('campaignsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  try {
    const data = await fetchJSON(`${API_BASE}/newsletter/admin/campaigns`);
    const campaigns = data.campaigns || [];
    
    if (campaigns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No campaigns found</td></tr>';
      return;
    }
    
    tbody.innerHTML = campaigns.map(c => {
      const statusBadge = {
        'DRAFT': 'secondary',
        'SCHEDULED': 'info',
        'SENDING': 'warning',
        'SENT': 'success',
        'FAILED': 'danger'
      }[c.status] || 'secondary';
      
      return `
        <tr>
          <td>
            <div>${c.subject}</div>
            <small class="text-muted">By ${c.admin_name || 'Admin'}</small>
          </td>
          <td><span class="badge bg-${statusBadge}">${c.status}</span></td>
          <td>${c.total_recipients || 0}</td>
          <td>
            ${c.sent_count || 0} / ${c.failed_count || 0}
            ${c.failed_count > 0 ? '<span class="text-danger"><i class="fas fa-exclamation-triangle"></i></span>' : ''}
          </td>
          <td>${new Date(c.created_at).toLocaleDateString()}</td>
          <td>
            ${c.status === 'DRAFT' ? `
              <button class="btn btn-sm btn-success" onclick="sendCampaignById(${c.id})">
                <i class="fas fa-paper-plane"></i> Send
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCampaign(${c.id})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Failed to load campaigns:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load campaigns</td></tr>';
  }
}

// Send campaign by ID
async function sendCampaignById(id) {
  if (!confirm('Send this campaign to all active subscribers?')) return;
  
  const btn = event.target.closest('button');
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;
  
  try {
    const result = await fetchJSON(`${API_BASE}/newsletter/admin/campaigns/${id}/send`, {
      method: 'POST'
    });
    
    alert(`Campaign sent!\nSent: ${result.sent}\nFailed: ${result.failed}\nTotal: ${result.total}`);
    await loadCampaigns();
    await loadNewsletterStats();
  } catch (error) {
    alert('Failed to send campaign: ' + error.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// Delete campaign
async function deleteCampaign(id) {
  if (!confirm('Delete this campaign permanently?')) return;
  
  try {
    await fetchJSON(`${API_BASE}/newsletter/admin/campaigns/${id}`, {
      method: 'DELETE'
    });
    
    alert('Campaign deleted');
    await loadCampaigns();
    await loadNewsletterStats();
  } catch (error) {
    alert('Failed to delete campaign: ' + error.message);
  }
}

// Save draft campaign
async function saveDraftCampaign() {
  const subject = document.getElementById('campaignSubject').value.trim();
  const content = document.getElementById('campaignContent').value.trim();
  
  if (!subject || !content) {
    alert('Please fill in subject and content');
    return;
  }
  
  try {
    await fetchJSON(`${API_BASE}/newsletter/admin/campaigns`, {
      method: 'POST',
      body: JSON.stringify({ subject, content })
    });
    
    alert('Campaign saved as draft');
    document.getElementById('createCampaignForm').reset();
    
    // Switch to campaigns tab
    document.getElementById('newsletter-campaigns-tab').click();
    await loadCampaigns();
  } catch (error) {
    alert('Failed to save campaign: ' + error.message);
  }
}

// Send campaign now
async function sendCampaignNow() {
  const subject = document.getElementById('campaignSubject').value.trim();
  const content = document.getElementById('campaignContent').value.trim();
  
  if (!subject || !content) {
    alert('Please fill in subject and content');
    return;
  }
  
  if (!confirm('Send this campaign immediately to all active subscribers?')) return;
  
  const statusDiv = document.getElementById('campaignCreateStatus');
  statusDiv.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin"></i> Creating and sending campaign...</div>';
  
  try {
    // Create campaign
    const campaign = await fetchJSON(`${API_BASE}/newsletter/admin/campaigns`, {
      method: 'POST',
      body: JSON.stringify({ subject, content })
    });
    
    // Send campaign
    const result = await fetchJSON(`${API_BASE}/newsletter/admin/campaigns/${campaign.id}/send`, {
      method: 'POST'
    });
    
    statusDiv.innerHTML = `
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i> Campaign sent successfully!<br>
        Sent: ${result.sent} | Failed: ${result.failed} | Total: ${result.total}
      </div>
    `;
    
    document.getElementById('createCampaignForm').reset();
    
    setTimeout(() => {
      statusDiv.innerHTML = '';
      document.getElementById('newsletter-campaigns-tab').click();
      loadCampaigns();
    }, 3000);
  } catch (error) {
    statusDiv.innerHTML = `<div class="alert alert-danger">Failed: ${error.message}</div>`;
  }
}

// Preview campaign
function previewCampaign() {
  const content = document.getElementById('campaignContent').value;
  const previewWindow = window.open('', 'Newsletter Preview', 'width=600,height=800');
  
  previewWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Newsletter Preview</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; }
      </style>
    </head>
    <body>
      ${content}
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">
        <a href="#">Unsubscribe</a> (placeholder)
      </p>
    </body>
    </html>
  `);
}

// Initialize on tab show
document.getElementById('tab-newsletter')?.addEventListener('shown.bs.tab', () => {
  loadNewsletterStats();
  loadSubscribers();
  loadCampaigns();
});

// Search subscribers
document.getElementById('subscribersSearch')?.addEventListener('input', debounce(() => {
  loadSubscribers();
}, 500));

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Make functions global
window.loadSubscribers = loadSubscribers;
window.deleteSubscriber = deleteSubscriber;
window.loadCampaigns = loadCampaigns;
window.sendCampaignById = sendCampaignById;
window.deleteCampaign = deleteCampaign;
window.saveDraftCampaign = saveDraftCampaign;
window.sendCampaignNow = sendCampaignNow;
window.previewCampaign = previewCampaign;
