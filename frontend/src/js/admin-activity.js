// Admin Activity Feed
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
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  return res.json();
}

function formatTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getActionIcon(action) {
  const icons = {
    'LOGIN': 'fa-sign-in-alt text-success',
    'LOGOUT': 'fa-sign-out-alt text-muted',
    'CREATE_PRODUCT': 'fa-plus-circle text-primary',
    'UPDATE_PRODUCT': 'fa-edit text-info',
    'DELETE_PRODUCT': 'fa-trash text-danger',
    'CREATE_ORDER': 'fa-shopping-cart text-success',
    'UPDATE_SETTING': 'fa-cog text-warning',
    'APPROVE_KYC': 'fa-check-circle text-success',
    'REJECT_KYC': 'fa-times-circle text-danger'
  };
  return icons[action] || 'fa-circle text-secondary';
}

function getUserTypeBadge(userType) {
  const badges = {
    'ADMIN': 'badge bg-danger',
    'USER': 'badge bg-primary',
    'AFFILIATE': 'badge bg-info'
  };
  return badges[userType] || 'badge bg-secondary';
}

// Load activity statistics
async function loadActivityStats() {
  try {
    const stats = await fetchJSON(`${API_BASE}/activity/stats?hours=24`);
    
    document.getElementById('activityStatsAdmin').textContent = stats.admin_activities || 0;
    document.getElementById('activityStatsUser').textContent = stats.user_activities || 0;
    document.getElementById('activityStatsAffiliate').textContent = stats.affiliate_activities || 0;
    document.getElementById('activityStatsTotal').textContent = stats.total_activities || 0;
  } catch (error) {
    console.error('Failed to load activity stats:', error);
  }
}

// Load recent activities
async function loadRecentActivities(filters = {}) {
  const tbody = document.getElementById('activityTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm"></div> Loading...</td></tr>';
  
  try {
    const params = new URLSearchParams({
      limit: filters.limit || 50,
      offset: filters.offset || 0
    });
    
    if (filters.user_type) params.set('user_type', filters.user_type);
    if (filters.action) params.set('action', filters.action);
    
    const data = await fetchJSON(`${API_BASE}/activity?${params}`);
    const activities = data.activities || [];
    
    if (activities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No activities found</td></tr>';
      return;
    }
    
    tbody.innerHTML = activities.map(a => `
      <tr>
        <td>
          <i class="fas ${getActionIcon(a.action)} me-2"></i>
          <strong>${a.action.replace(/_/g, ' ')}</strong>
        </td>
        <td>
          <span class="${getUserTypeBadge(a.user_type)}">${a.user_type}</span>
        </td>
        <td>
          ${a.user_name || 'System'}
          ${a.user_email ? `<div class="small text-muted">${a.user_email}</div>` : ''}
        </td>
        <td class="small">${a.description || '—'}</td>
        <td class="small text-muted">${formatTimeAgo(a.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" onclick="viewActivityDetails(${a.id})">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load activities:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load activities</td></tr>';
  }
}

// Filter activities
function filterActivitiesByType(type) {
  const filters = type === 'ALL' ? {} : { user_type: type };
  loadRecentActivities(filters);
  
  // Update active button
  document.querySelectorAll('[data-filter-type]').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filterType === type) {
      btn.classList.add('active');
    }
  });
}

// View activity details
async function viewActivityDetails(id) {
  try {
    const params = new URLSearchParams({ limit: 1000 });
    const data = await fetchJSON(`${API_BASE}/activity?${params}`);
    const activity = data.activities.find(a => a.id === id);
    
    if (!activity) {
      alert('Activity not found');
      return;
    }
    
    const metadata = activity.metadata ? JSON.stringify(activity.metadata, null, 2) : 'No additional data';
    
    const modal = new bootstrap.Modal(document.getElementById('activityDetailModal'));
    document.getElementById('activityDetailBody').innerHTML = `
      <div class="mb-3">
        <strong>Action:</strong> ${activity.action.replace(/_/g, ' ')}
      </div>
      <div class="mb-3">
        <strong>User Type:</strong> <span class="${getUserTypeBadge(activity.user_type)}">${activity.user_type}</span>
      </div>
      <div class="mb-3">
        <strong>User:</strong> ${activity.user_name || 'System'} ${activity.user_email ? `(${activity.user_email})` : ''}
      </div>
      <div class="mb-3">
        <strong>Description:</strong> ${activity.description || 'No description'}
      </div>
      <div class="mb-3">
        <strong>Time:</strong> ${new Date(activity.created_at).toLocaleString()}
      </div>
      ${activity.ip_address ? `<div class="mb-3"><strong>IP Address:</strong> ${activity.ip_address}</div>` : ''}
      ${activity.user_agent ? `<div class="mb-3"><strong>User Agent:</strong> <div class="small font-monospace">${activity.user_agent}</div></div>` : ''}
      <div class="mb-3">
        <strong>Metadata:</strong>
        <pre class="bg-light p-2 rounded small" style="max-height: 200px; overflow: auto;">${metadata}</pre>
      </div>
    `;
    modal.show();
  } catch (error) {
    alert('Failed to load activity details: ' + error.message);
  }
}

// Initialize activity tab
document.getElementById('tab-dashboard')?.addEventListener('shown.bs.tab', () => {
  loadActivityStats();
  loadRecentActivities();
});

// Auto-refresh every 30 seconds when on dashboard
let activityRefreshInterval;
document.getElementById('tab-dashboard')?.addEventListener('shown.bs.tab', () => {
  clearInterval(activityRefreshInterval);
  activityRefreshInterval = setInterval(() => {
    loadActivityStats();
    loadRecentActivities();
  }, 30000);
});

document.getElementById('tab-dashboard')?.addEventListener('hidden.bs.tab', () => {
  clearInterval(activityRefreshInterval);
});

// Manual refresh button
document.getElementById('refreshActivitiesBtn')?.addEventListener('click', () => {
  loadRecentActivities();
});

// Expose functions globally
window.loadActivityStats = loadActivityStats;
window.loadRecentActivities = loadRecentActivities;
window.filterActivitiesByType = filterActivitiesByType;
window.viewActivityDetails = viewActivityDetails;
