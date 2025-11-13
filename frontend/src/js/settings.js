import { API_BASE } from './config.js';

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
  const qrEl = document.getElementById('twofaQR');
  const keyEl = document.getElementById('twofaKey');
  const tokenEl = document.getElementById('twofaToken');
  const recoveryModalEl = document.getElementById('recoveryCodesModal');
  const recoveryList = document.getElementById('recoveryCodesList');
  let busy = false;
  let recoveryModal;
  if (recoveryModalEl && window.bootstrap) recoveryModal = new bootstrap.Modal(recoveryModalEl);

  function guard(el, handler){ if(!el) return; el.addEventListener('click', handler); }
  function setLoading(btn, on){ if(!btn) return; if(on){ btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = 'Please wait…'; } else { btn.disabled = false; if(btn.dataset.origText) btn.textContent = btn.dataset.origText; } }

  guard(beginBtn, async ()=>{
    if (busy) return; busy = true; setLoading(beginBtn, true);
    try {
      const s = await fetchJSON(`${API_BASE}/user/profile/2fa/setup`, { method:'POST', body: JSON.stringify({}) });
      if (setup) setup.classList.remove('d-none');
      if (qrEl) qrEl.src = s.qr;
      if (keyEl) keyEl.textContent = s.base32;
      if (tokenEl) tokenEl.value = '';
      // Hide initial button while in setup stage
      beginBtn.classList.add('d-none');
      window.showToast && showToast('2FA setup initialized. Scan the QR and enter a code.', { type:'info' });
    } catch(e){ window.showToast ? showToast(e.message || 'Setup failed', { type:'error' }) : alert(e.message || 'Setup failed'); }
    finally { busy = false; setLoading(beginBtn, false); }
  });

  guard(enableBtn, async ()=>{
    if (busy) return; busy = true; setLoading(enableBtn, true);
    const base32 = (keyEl?.textContent || '').trim();
    const token = (tokenEl?.value || '').trim();
    if (!token){ alert('Enter the 6-digit code from your authenticator app.'); busy=false; setLoading(enableBtn,false); return; }
    try {
      const resp = await fetchJSON(`${API_BASE}/user/profile/2fa/enable`, { method:'POST', body: JSON.stringify({ base32, token }) });
      renderTwofa(true);
      if (setup) setup.classList.add('d-none');
      if (resp.recovery_codes && recoveryList){
        recoveryList.textContent = resp.recovery_codes.join('\n');
        recoveryModal && recoveryModal.show();
      }
      window.showToast ? showToast('Two-Factor Authentication enabled', { type:'success' }) : alert('2FA enabled');
    } catch(e){ window.showToast ? showToast(e.message || 'Invalid code', { type:'error' }) : alert(e.message || 'Invalid code'); }
    finally { busy=false; setLoading(enableBtn,false); }
  });

  guard(disableBtn, async ()=>{
    if (!confirm('Disable 2FA?')) return;
    if (busy) return; busy=true; setLoading(disableBtn,true);
  try { await fetchJSON(`${API_BASE}/user/profile/2fa/disable`, { method:'POST', body: JSON.stringify({}) }); renderTwofa(false); window.showToast ? showToast('Two-Factor Authentication disabled', { type:'warning' }) : alert('2FA disabled'); }
  catch(e){ window.showToast ? showToast(e.message || 'Failed', { type:'error' }) : alert(e.message || 'Failed'); }
    finally { busy=false; setLoading(disableBtn,false); }
  });

  guard(cancelBtn, ()=>{ if (setup) setup.classList.add('d-none'); if (beginBtn) beginBtn.classList.remove('d-none'); });

  guard(recBtn, async ()=>{
    if (!confirm('Generate a NEW set of recovery codes? Old unused codes become invalid. Continue?')) return;
    if (busy) return; busy=true; setLoading(recBtn,true);
    try {
      const resp = await fetchJSON(`${API_BASE}/user/profile/2fa/recovery/regenerate`, { method:'POST', body: JSON.stringify({}) });
      if (resp.recovery_codes && recoveryList){
        recoveryList.textContent = resp.recovery_codes.join('\n');
        recoveryModal && recoveryModal.show();
        window.showToast && showToast('New recovery codes generated', { type:'info' });
      } else { window.showToast ? showToast('Recovery codes regenerated', { type:'info' }) : alert('Regenerated'); }
    } catch(e){ window.showToast ? showToast(e.message || 'Failed to regenerate', { type:'error' }) : alert(e.message || 'Failed to regenerate'); }
    finally { busy=false; setLoading(recBtn,false); }
  });
}

// ---------- Sign out ----------
function wireSignOut(){
  const buttons = [document.getElementById('signOutBtn'), document.getElementById('signOutBtn2')].filter(Boolean);
  buttons.forEach(btn=> btn.addEventListener('click', ()=>{ localStorage.removeItem('token'); window.location.href='/'; }));
}

// ---------- Avatar Upload ----------
// (Removed duplicate wireAvatar definition - consolidated earlier implementation handles avatar upload.)

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

// Recovery codes UX enhancements (copy / download / acknowledge)
document.addEventListener('DOMContentLoaded', ()=>{
  const listEl = document.getElementById('recoveryCodesList');
  const copyBtn = document.getElementById('copyRecoveryCodesBtn');
  const dlBtn = document.getElementById('downloadRecoveryCodesBtn');
  const ackChk = document.getElementById('ackRecoveryCodesChk');
  const doneBtn = document.getElementById('closeRecoveryCodesBtn');
  function updateDone(){ if(doneBtn) doneBtn.disabled = !ackChk?.checked; }
  ackChk?.addEventListener('change', updateDone);
  copyBtn?.addEventListener('click', ()=>{ try { navigator.clipboard.writeText((listEl?.textContent||'').trim()); copyBtn.textContent='Copied'; setTimeout(()=> copyBtn.textContent='Copy', 1500);} catch(_){ } });
  dlBtn?.addEventListener('click', ()=>{ try { const blob=new Blob([(listEl?.textContent||'').trim()+"\n"], { type:'text/plain' }); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='keohams_recovery_codes.txt'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1500);} catch(_){ } });
  updateDone();
});
