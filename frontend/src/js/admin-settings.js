// Admin Settings Management
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Load Paystack settings from backend
async function loadPaystackSettings() {
  const statusDiv = document.getElementById('settingsSaveStatus');
  statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Loading...';
  
  try {
    const data = await fetchJSON(`${API_BASE}/settings`);
    const settings = data.settings || [];
    
    // Find Paystack settings
    const publicKey = settings.find(s => s.setting_key === 'paystack_public_key');
    const secretKey = settings.find(s => s.setting_key === 'paystack_secret_key');
    const enabled = settings.find(s => s.setting_key === 'paystack_enabled');
    
    // Populate form
    if (publicKey) document.getElementById('paystackPublicKey').value = publicKey.setting_value || '';
    if (secretKey) document.getElementById('paystackSecretKey').value = secretKey.setting_value || '';
    if (enabled) document.getElementById('paystackEnabled').checked = enabled.setting_value === 'true';
    
    statusDiv.innerHTML = '<div class="alert alert-success">Settings loaded successfully</div>';
    setTimeout(() => statusDiv.innerHTML = '', 2000);
  } catch (error) {
    console.error('Load settings error:', error);
    statusDiv.innerHTML = '<div class="alert alert-danger">Failed to load settings: ' + error.message + '</div>';
  }
}

// Save Paystack settings
async function savePaystackSettings(e) {
  e.preventDefault();
  
  const publicKey = document.getElementById('paystackPublicKey').value.trim();
  const secretKey = document.getElementById('paystackSecretKey').value.trim();
  const enabled = document.getElementById('paystackEnabled').checked;
  
  const statusDiv = document.getElementById('settingsSaveStatus');
  statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Saving...';
  
  try {
    // Batch update settings
    await fetchJSON(`${API_BASE}/settings/batch`, {
      method: 'POST',
      body: JSON.stringify({
        settings: [
          { key: 'paystack_public_key', value: publicKey },
          { key: 'paystack_secret_key', value: secretKey },
          { key: 'paystack_enabled', value: enabled.toString() }
        ]
      })
    });
    
    statusDiv.innerHTML = `
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i> Settings saved successfully!
        ${enabled ? '<div class="small mt-1">✓ Paystack is now enabled</div>' : ''}
      </div>
    `;
    
    setTimeout(() => statusDiv.innerHTML = '', 4000);
  } catch (error) {
    console.error('Save settings error:', error);
    statusDiv.innerHTML = '<div class="alert alert-danger">Failed to save: ' + error.message + '</div>';
  }
}

// Test Paystack connection
async function testPaystackConnection() {
  const publicKey = document.getElementById('paystackPublicKey').value.trim();
  const secretKey = document.getElementById('paystackSecretKey').value.trim();
  
  if (!publicKey || !secretKey) {
    alert('Please enter both public and secret keys before testing');
    return;
  }
  
  const statusDiv = document.getElementById('settingsSaveStatus');
  statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Testing connection...';
  
  try {
    // Simple test: verify keys format
    const isTestMode = publicKey.startsWith('pk_test_') && secretKey.startsWith('sk_test_');
    const isLiveMode = publicKey.startsWith('pk_live_') && secretKey.startsWith('sk_live_');
    
    if (!isTestMode && !isLiveMode) {
      throw new Error('Invalid key format. Keys should start with pk_test_/sk_test_ or pk_live_/sk_live_');
    }
    
    if ((publicKey.startsWith('pk_test_') && !secretKey.startsWith('sk_test_')) ||
        (publicKey.startsWith('pk_live_') && !secretKey.startsWith('sk_live_'))) {
      throw new Error('Key mismatch: Public and Secret keys must both be test or both be live');
    }
    
    // Make a test API call to Paystack to verify secret key
    const response = await fetch('https://api.paystack.co/transaction/verify/invalid_ref_test', {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // If we get a structured response (even if error), the key is valid
    const data = await response.json();
    
    if (response.status === 404 && data.message) {
      // Expected response for invalid reference - means API key is valid
      statusDiv.innerHTML = `
        <div class="alert alert-success">
          <i class="fas fa-check-circle"></i> Connection successful!
          <div class="small mt-1">Mode: ${isTestMode ? 'Test' : 'Live'}</div>
          <div class="small">Keys are valid and Paystack API is accessible</div>
        </div>
      `;
    } else if (response.status === 401) {
      throw new Error('Invalid secret key - authentication failed');
    } else {
      statusDiv.innerHTML = `
        <div class="alert alert-success">
          <i class="fas fa-check-circle"></i> Connection verified!
          <div class="small mt-1">Mode: ${isTestMode ? 'Test' : 'Live'}</div>
        </div>
      `;
    }
    
    setTimeout(() => statusDiv.innerHTML = '', 5000);
  } catch (error) {
    console.error('Test connection error:', error);
    statusDiv.innerHTML = '<div class="alert alert-danger">Connection test failed: ' + error.message + '</div>';
  }
}

// Toggle secret key visibility
function toggleSecretKeyVisibility() {
  const input = document.getElementById('paystackSecretKey');
  const icon = document.querySelector('#toggleSecretKey i');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// Initialize settings tab
document.getElementById('tab-settings')?.addEventListener('shown.bs.tab', () => {
  loadPaystackSettings();
});

// Wire up form
document.getElementById('paystackSettingsForm')?.addEventListener('submit', savePaystackSettings);
document.getElementById('loadPaystackSettings')?.addEventListener('click', loadPaystackSettings);
document.getElementById('testPaystackConnection')?.addEventListener('click', testPaystackConnection);
document.getElementById('toggleSecretKey')?.addEventListener('click', toggleSecretKeyVisibility);

// Refresh all settings
async function refreshAllSettings() {
  const btn = document.getElementById('refreshAllSettings');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
  
  try {
    await loadPaystackSettings();
    btn.innerHTML = '<i class="fas fa-check"></i> Refreshed!';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 2000);
  } catch (error) {
    btn.innerHTML = '<i class="fas fa-times"></i> Failed';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 2000);
  }
}

document.getElementById('refreshAllSettings')?.addEventListener('click', refreshAllSettings);

// Expose functions globally
window.loadPaystackSettings = loadPaystackSettings;
window.savePaystackSettings = savePaystackSettings;
window.testPaystackConnection = testPaystackConnection;
window.refreshAllSettings = refreshAllSettings;
