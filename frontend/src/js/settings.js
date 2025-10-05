const API_BASE = 'http://localhost:4000/api';

function token(){ return localStorage.getItem('token'); }
function authHeaders(){ const t = token(); return t ? { Authorization: `Bearer ${t}` } : {}; }
async function fetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

function requireAuth(){ if (!token()){ window.location.href='/?#signin'; throw new Error('No token'); } }

// ---------- Profile (Display Only) ----------
function computeAge(dob){
  if(!dob) return null; // expecting YYYY-MM-DD
  const parts = dob.split('-'); if(parts.length!==3) return null;
  const [y,m,d] = parts.map(Number);
  const birth = new Date(Date.UTC(y, (m||1)-1, d||1));
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const mDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age < 0 ? null : age;
}

async function loadProfile(){
  try {
    const p = await fetchJSON(`${API_BASE}/user/profile`);
  const nameEl = document.getElementById('pfNameText');
  const phoneInput = document.getElementById('pfPhoneInput');
    const ageEl = document.getElementById('pfAgeText');
    if (nameEl) nameEl.textContent = p.name || '—'; 
  if (phoneInput) phoneInput.value = p.phone || '';
    if (ageEl) {
      const age = computeAge(p.dob);
      ageEl.textContent = age != null ? String(age) : '—';
    }
    // Avatar preview for standalone settings (pfAvatar) and dashboard (optional global loader could reuse this logic)
    if (p.avatar_url) {
      const av = document.getElementById('pfAvatar'); if (av) av.src = p.avatar_url;
    }
    renderTwofa(p.twofa_enabled);
  } catch(e){ console.warn('Profile load failed', e); }
}

function wireProfile(){ /* no-op: profile is read-only */ }
// Phone save button
function wirePhoneSave(){
  const btn = document.getElementById('pfSaveBtn'); if(!btn) return;
  const input = document.getElementById('pfPhoneInput');
  const status = document.getElementById('pfSaveStatus');
  btn.addEventListener('click', async ()=>{
    if(!input) return;
    const phone = input.value.trim();
    status.textContent='Saving...';
    try {
      await fetch(`${API_BASE}/user/profile`, { method:'PATCH', headers:{ 'Content-Type':'application/json', ...authHeaders() }, body: JSON.stringify({ phone }) });
      status.textContent='Saved'; setTimeout(()=> status.textContent='', 1500);
    } catch(e){ status.textContent = (e && e.message) || 'Failed'; }
  });
}

// ---------- Avatar Upload (Standalone Settings) ----------
function wireAvatar(){
  const input = document.getElementById('pfAvatarInput'); if (!input) return;
  const status = document.getElementById('pfAvatarStatus');
  input.addEventListener('change', async ()=>{
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 3 * 1024 * 1024) { status.textContent='File too large (max 3MB)'; return; }
    status.textContent='Uploading...';
    try {
      const fd = new FormData(); fd.append('avatar', file);
      const res = await fetch(`${API_BASE}/user/profile/avatar`, { method:'POST', headers: { ...authHeaders() }, body: fd });
      if(!res.ok) throw new Error(await res.text());
      const j = await res.json();
      const av = document.getElementById('pfAvatar'); if (av && j.avatar_url) av.src = j.avatar_url + '?v=' + Date.now();
      status.textContent='Updated';
      setTimeout(()=> status.textContent='', 2000);
    } catch(err){ status.textContent = err.message || 'Upload failed'; }
  });
}

// ---------- Password ----------
function wirePassword(){
  const form = document.getElementById('pwdForm'); if (!form) return;
  const newInput = document.getElementById('pwdNew');
  const bar = document.getElementById('pwdStrengthBar');
  const txt = document.getElementById('pwdStrengthText');
  function assess(p){
    if (!p) return { score:0, label:'', pct:0, cls:'bg-danger' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const pct = (score/5)*100;
    const labels=['Very Weak','Weak','Fair','Good','Strong','Excellent'];
    const label = labels[score];
    const cls = score < 2 ? 'bg-danger' : score <3 ? 'bg-warning' : score <5 ? 'bg-info' : 'bg-success';
    return { score, label, pct, cls };
  }
  newInput.addEventListener('input', ()=>{
    const { pct, label, cls } = assess(newInput.value);
    bar.style.width = pct+'%';
    bar.className = 'progress-bar '+cls;
    txt.textContent = label;
  });
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const current_password = document.getElementById('pwdCurrent').value;
    const new_password = document.getElementById('pwdNew').value;
    const status = document.getElementById('pwdStatus');
    status.textContent = 'Updating...';
    try { await fetchJSON(`${API_BASE}/user/profile/change-password`, { method:'POST', body: JSON.stringify({ current_password, new_password }) }); status.textContent='Updated'; form.reset(); setTimeout(()=> status.textContent='', 1500); }
    catch(e){ status.textContent = e.message || 'Failed'; }
  });
}

// ---------- 2FA ----------
function renderTwofa(enabled){
  const badge = document.getElementById('twofaBadge');
  const status = document.getElementById('twofaStatus');
  const setup = document.getElementById('twofaSetup');
  const disBtn = document.getElementById('twofaDisableBtn');
  const beginBtn = document.getElementById('twofaBeginSetup');
  const recBtn = document.getElementById('twofaShowRecoveryBtn');
  if (enabled){
    badge.textContent = 'Enabled'; badge.className='badge text-bg-success';
    status.textContent = 'Two-Factor Authentication is enabled.';
    setup.classList.add('d-none');
    disBtn.classList.remove('d-none');
    beginBtn.classList.add('d-none');
    recBtn.classList.remove('d-none');
  } else {
    badge.textContent = 'Disabled'; badge.className='badge text-bg-secondary';
    status.textContent = 'Add an extra layer of security by enabling 2FA.';
    disBtn.classList.add('d-none');
    beginBtn.classList.remove('d-none');
    recBtn.classList.add('d-none');
  }
}

function wireTwofa(){
  const beginBtn = document.getElementById('twofaBeginSetup');
  const enableBtn = document.getElementById('twofaEnableBtn');
  const disableBtn = document.getElementById('twofaDisableBtn');
  const cancelBtn = document.getElementById('twofaCancelBtn');
  const setup = document.getElementById('twofaSetup');
  const recBtn = document.getElementById('twofaShowRecoveryBtn');
  const recoveryModalEl = document.getElementById('recoveryCodesModal');
  const recoveryList = document.getElementById('recoveryCodesList');
  let recoveryModal;
  if (recoveryModalEl && window.bootstrap) recoveryModal = new bootstrap.Modal(recoveryModalEl);

  beginBtn.addEventListener('click', async ()=>{
    try {
      const s = await fetchJSON(`${API_BASE}/user/profile/2fa/setup`, { method:'POST', body: JSON.stringify({}) });
      setup.classList.remove('d-none');
      document.getElementById('twofaQR').src = s.qr;
      document.getElementById('twofaKey').textContent = s.base32;
      document.getElementById('twofaToken').value = '';
    } catch(e){ alert(e.message || 'Setup failed'); }
  });
  enableBtn.addEventListener('click', async ()=>{
    const base32 = document.getElementById('twofaKey').textContent.trim();
    const token = document.getElementById('twofaToken').value.trim();
    if (!token){ alert('Enter the 6-digit code from your authenticator app.'); return; }
    try { 
      const resp = await fetchJSON(`${API_BASE}/user/profile/2fa/enable`, { method:'POST', body: JSON.stringify({ base32, token }) }); 
      renderTwofa(true); 
      if (resp.recovery_codes && recoveryList) { 
        recoveryList.textContent = resp.recovery_codes.join('\n');
        recoveryModal && recoveryModal.show();
      }
      alert('2FA enabled'); 
    }
    catch(e){ alert(e.message || 'Invalid code'); }
  });
  disableBtn.addEventListener('click', async ()=>{
    if (!confirm('Disable 2FA?')) return;
    try { await fetchJSON(`${API_BASE}/user/profile/2fa/disable`, { method:'POST', body: JSON.stringify({}) }); renderTwofa(false); }
    catch(e){ alert(e.message || 'Failed'); }
  });
  cancelBtn.addEventListener('click', ()=>{ setup.classList.add('d-none'); });

  recBtn.addEventListener('click', async ()=>{
    if (!confirm('Generate a NEW set of recovery codes? Old unused codes become invalid. Continue?')) return;
    try {
      const resp = await fetchJSON(`${API_BASE}/user/profile/2fa/recovery/regenerate`, { method:'POST', body: JSON.stringify({}) });
      if (resp.recovery_codes && recoveryList){
        recoveryList.textContent = resp.recovery_codes.join('\n');
        recoveryModal && recoveryModal.show();
      } else alert('Regenerated');
    } catch(e){ alert(e.message || 'Failed to regenerate'); }
  });
}

// ---------- Sign out ----------
function wireSignOut(){
  const buttons = [document.getElementById('signOutBtn'), document.getElementById('signOutBtn2')].filter(Boolean);
  buttons.forEach(btn=> btn.addEventListener('click', ()=>{ localStorage.removeItem('token'); window.location.href='/'; }));
}

// ---------- Avatar Upload ----------
function wireAvatar(){
  const input = document.getElementById('avatarInput'); if (!input) return;
  const preview = document.getElementById('avatarPreview');
  const status = document.getElementById('avatarStatus');
  input.addEventListener('change', async ()=>{
    const file = input.files[0]; if (!file) return;
    // preview
    const reader = new FileReader(); reader.onload = e => { if (preview) preview.src = e.target.result; }; reader.readAsDataURL(file);
    status.textContent = 'Uploading...';
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await fetch(`${API_BASE}/user/profile/avatar`, { method:'POST', headers: { ...(authHeaders()) }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      status.textContent = 'Updated';
      setTimeout(()=> status.textContent='', 2000);
    } catch(e){ status.textContent = e.message || 'Upload failed'; }
  });
}

(function init(){
  try { requireAuth(); } catch { return; }
  wireProfile();
  wirePassword();
  wireTwofa();
  wireSignOut();
  wireAvatar();
  wirePhoneSave();
  loadProfile();
})();
