import { API_BASE } from './config.js';
import '../js/toast.js';

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
      await ensureSecurityCaptcha('twofa');
      const captcha = getSecurityCaptchaValues('twofa');
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
    await ensureSecurityCaptcha('twofa');
    const captcha = getSecurityCaptchaValues('twofa');
    try {
      const resp = await fetchJSON(`${API_BASE}/user/profile/2fa/enable`, { method:'POST', body: JSON.stringify({ base32, token, captchaToken: captcha.token, captchaAnswer: captcha.answer }) });
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
    await ensureSecurityCaptcha('twofa');
    const captcha = getSecurityCaptchaValues('twofa');
  try { await fetchJSON(`${API_BASE}/user/profile/2fa/disable`, { method:'POST', body: JSON.stringify({}) }); renderTwofa(false); window.showToast ? showToast('Two-Factor Authentication disabled', { type:'warning' }) : alert('2FA disabled'); }
  catch(e){ window.showToast ? showToast(e.message || 'Failed', { type:'error' }) : alert(e.message || 'Failed'); }
    finally { busy=false; setLoading(disableBtn,false); }
  });

  guard(cancelBtn, ()=>{ if (setup) setup.classList.add('d-none'); if (beginBtn) beginBtn.classList.remove('d-none'); });

  guard(recBtn, async ()=>{
    if (!confirm('Generate a NEW set of recovery codes? Old unused codes become invalid. Continue?')) return;
    if (busy) return; busy=true; setLoading(recBtn,true);
    await ensureSecurityCaptcha('twofa');
    const captcha = getSecurityCaptchaValues('twofa');
    try {
      const resp = await fetchJSON(`${API_BASE}/user/profile/2fa/recovery/regenerate`, { method:'POST', body: JSON.stringify({ captchaToken: captcha.token, captchaAnswer: captcha.answer }) });
      if (resp.recovery_codes && recoveryList){
        recoveryList.textContent = resp.recovery_codes.join('\n');
        recoveryModal && recoveryModal.show();
        window.showToast && showToast('New recovery codes generated', { type:'info' });
      } else { window.showToast ? showToast('Recovery codes regenerated', { type:'info' }) : alert('Regenerated'); }
    } catch(e){ window.showToast ? showToast(e.message || 'Failed to regenerate', { type:'error' }) : alert(e.message || 'Failed to regenerate'); }
    finally { busy=false; setLoading(recBtn,false); }
  });
}

// ---------- Email 2FA ----------
function renderEmail2fa(enabled){
  const status = document.getElementById('email2faStatus');
  const setup = document.getElementById('email2faSetup');
  const disBtn = document.getElementById('email2faDisableBtn');
  const enBtn = document.getElementById('email2faEnableBtn');
  
  if (enabled){
    status.textContent = '✅ Email Two-Factor Authentication is enabled.';
    status.className = 'mb-2 small text-success';
    setup.classList.add('d-none');
    disBtn.classList.remove('d-none');
    enBtn.classList.add('d-none');
  } else {
    status.textContent = 'Email 2FA is currently disabled. Enable it for additional security.';
    status.className = 'mb-2 small text-muted';
    setup.classList.add('d-none');
    disBtn.classList.add('d-none');
    enBtn.classList.remove('d-none');
  }
}

function wireEmail2fa(){
  const enBtn = document.getElementById('email2faEnableBtn');
  const disBtn = document.getElementById('email2faDisableBtn');
  const verifyBtn = document.getElementById('email2faVerifyBtn');
  const cancelBtn = document.getElementById('email2faCancelBtn');
  const setup = document.getElementById('email2faSetup');
  const codeInput = document.getElementById('email2faCode');
  let busy = false;
  
  function setLoading(btn, on){ 
    if(!btn) return; 
    if(on){ 
      btn.disabled = true; 
      btn.dataset.origText = btn.textContent; 
      btn.textContent = 'Please wait…'; 
    } else { 
      btn.disabled = false; 
      if(btn.dataset.origText) btn.textContent = btn.dataset.origText; 
    } 
  }
  
  // Enable email 2FA - sends verification code
  enBtn?.addEventListener('click', async ()=>{
    if (busy) return; 
    busy = true; 
    setLoading(enBtn, true);
    await ensureSecurityCaptcha('email');
    const captcha = getSecurityCaptchaValues('email');
    
    try {
      await fetchJSON(`${API_BASE}/user/profile/email-2fa/enable`, { 
        method:'POST', 
        body: JSON.stringify({ captchaToken: captcha.token, captchaAnswer: captcha.answer }) 
      });
      
      // Show setup form
      if (setup) setup.classList.remove('d-none');
      if (enBtn) enBtn.classList.add('d-none');
      if (codeInput) codeInput.value = '';
      
      window.showToast && showToast('Verification code sent to your email', { type:'info' });
    } catch(e){ 
      window.showToast ? showToast(e.message || 'Failed to send code', { type:'error' }) : alert(e.message || 'Failed'); 
    } finally { 
      busy = false; 
      setLoading(enBtn, false); 
    }
  });
  
  // Verify code and complete enablement
  verifyBtn?.addEventListener('click', async ()=>{
    if (busy) return; 
    busy = true; 
    setLoading(verifyBtn, true);
    
    const code = codeInput?.value?.trim();
    if (!code || code.length !== 6){ 
      alert('Please enter the 6-digit code from your email.'); 
      busy=false; 
      setLoading(verifyBtn,false); 
      return; 
    }
    
    try {
      await ensureSecurityCaptcha('email');
      const captcha = getSecurityCaptchaValues('email');
      await fetchJSON(`${API_BASE}/user/profile/email-2fa/verify`, { 
        method:'POST', 
        body: JSON.stringify({ code, captchaToken: captcha.token, captchaAnswer: captcha.answer }) 
      });
      
      renderEmail2fa(true);
      if (setup) setup.classList.add('d-none');
      
      window.showToast ? showToast('Email 2FA enabled successfully', { type:'success' }) : alert('Email 2FA enabled');
    } catch(e){ 
      window.showToast ? showToast(e.message || 'Invalid code', { type:'error' }) : alert(e.message || 'Invalid code'); 
    } finally { 
      busy=false; 
      setLoading(verifyBtn,false); 
    }
  });
  
  // Disable email 2FA
  disBtn?.addEventListener('click', async ()=>{
    if (!confirm('Disable Email 2FA? You will no longer receive email codes when signing in.')) return;
    if (busy) return; 
    busy=true; 
    setLoading(disBtn,true);
    await ensureSecurityCaptcha('email');
    const captcha = getSecurityCaptchaValues('email');
    
    try { 
      await fetchJSON(`${API_BASE}/user/profile/email-2fa/disable`, { 
        method:'POST', 
        body: JSON.stringify({ captchaToken: captcha.token, captchaAnswer: captcha.answer }) 
      }); 
      
      renderEmail2fa(false); 
      window.showToast ? showToast('Email 2FA disabled', { type:'warning' }) : alert('Email 2FA disabled'); 
    } catch(e){ 
      window.showToast ? showToast(e.message || 'Failed', { type:'error' }) : alert(e.message || 'Failed'); 
    } finally { 
      busy=false; 
      setLoading(disBtn,false); 
    }
  });
  
  // Cancel setup
  cancelBtn?.addEventListener('click', ()=>{ 
    if (setup) setup.classList.add('d-none'); 
    if (enBtn) enBtn.classList.remove('d-none'); 
    if (codeInput) codeInput.value = '';
  });
}

async function loadEmail2faStatus(){
  try {
    const p = await fetchJSON(`${API_BASE}/user/profile`);
    renderEmail2fa(p.email_2fa_enabled);
  } catch(e){ 
    console.warn('Email 2FA status load failed', e); 
  }
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
  wireEmail2fa();
  wireSignOut();
  wireAvatar();
  wirePhoneSave();
  loadProfile();
  loadEmail2faStatus();
  initialiseSecurityCaptchaLazy();
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

// ===== Captcha Integration for Security Actions =====
let securityCaptchaState = { twofa: null, email: null };

async function fetchCaptcha() {
  const res = await fetch(`${API_BASE}/auth/captcha`);
  if (!res.ok) throw new Error('Failed to load captcha');
  return res.json(); // { token, code, question, expiresAt, ttl }
}

function drawCaptcha(canvas, code){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f5f7fa'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.font='28px monospace'; ctx.textBaseline='middle'; ctx.textAlign='center';
  for (let i=0;i<code.length;i++){
    const ch = code[i];
    const x = (i+0.5)*(canvas.width/code.length);
    const y = canvas.height/2;
    const rot = (Math.random()-0.5)*0.4;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.fillStyle = `hsl(${Math.random()*360},70%,30%)`;
    ctx.fillText(ch,0,2);
    ctx.restore();
  }
  // Noise lines
  for (let j=0;j<4;j++){
    ctx.beginPath();
    ctx.moveTo(Math.random()*canvas.width, Math.random()*canvas.height);
    ctx.lineTo(Math.random()*canvas.width, Math.random()*canvas.height);
    ctx.strokeStyle='rgba(0,0,0,0.15)';
    ctx.lineWidth=1;
    ctx.stroke();
  }
}

async function ensureSecurityCaptcha(scope){
  const state = securityCaptchaState[scope];
  const now = Date.now();
  if (state && state.expiresAt && now < state.expiresAt - 5000) return; // still valid
  await loadSecurityCaptcha(scope);
}

async function loadSecurityCaptcha(scope){
  const wrapId = scope === 'twofa' ? 'securityCaptchaWrap' : 'emailSecurityCaptchaWrap';
  const canvasId = scope === 'twofa' ? 'securityCaptchaCanvas' : 'emailSecurityCaptchaCanvas';
  const refreshId = scope === 'twofa' ? 'securityCaptchaRefresh' : 'emailSecurityCaptchaRefresh';
  const answerId = scope === 'twofa' ? 'securityCaptchaAnswer' : 'emailSecurityCaptchaAnswer';
  const errorId = scope === 'twofa' ? 'securityCaptchaError' : 'emailSecurityCaptchaError';
  const wrap = document.getElementById(wrapId);
  const canvas = document.getElementById(canvasId);
  const answer = document.getElementById(answerId);
  const errorEl = document.getElementById(errorId);
  if (!wrap) return;
  try {
    const data = await fetchCaptcha();
    const code = data.code.toUpperCase();
    drawCaptcha(canvas, code);
    wrap.classList.remove('d-none');
    if (answer) answer.value='';
    if (errorEl) { errorEl.style.display='none'; errorEl.textContent=''; }
    securityCaptchaState[scope] = { token: data.token, code, expiresAt: Date.parse(data.expiresAt) };
  } catch(e){ if(errorEl){ errorEl.style.display='block'; errorEl.textContent='Failed to load captcha'; } }
}

function getSecurityCaptchaValues(scope){
  const answerId = scope === 'twofa' ? 'securityCaptchaAnswer' : 'emailSecurityCaptchaAnswer';
  const errorId = scope === 'twofa' ? 'securityCaptchaError' : 'emailSecurityCaptchaError';
  const st = securityCaptchaState[scope];
  const answerEl = document.getElementById(answerId);
  const errorEl = document.getElementById(errorId);
  const answer = (answerEl?.value || '').trim();
  if (!st){ throw new Error('Captcha not loaded'); }
  if (!/^[A-Za-z0-9]{6}$/.test(answer)){
    if (errorEl){ errorEl.textContent='Enter the 6 character code'; errorEl.style.display='block'; }
    throw new Error('Invalid captcha answer');
  }
  if (errorEl){ errorEl.style.display='none'; }
  return { token: st.token, answer };
}

function initialiseSecurityCaptchaLazy(){
  const refreshTwofa = document.getElementById('securityCaptchaRefresh');
  const refreshEmail = document.getElementById('emailSecurityCaptchaRefresh');
  refreshTwofa?.addEventListener('click', ()=> loadSecurityCaptcha('twofa'));
  refreshEmail?.addEventListener('click', ()=> loadSecurityCaptcha('email'));
  // Lazy load on first interaction with any security button
  const triggers = [
    document.getElementById('twofaBeginSetup'),
    document.getElementById('twofaEnableBtn'),
    document.getElementById('twofaDisableBtn'),
    document.getElementById('twofaShowRecoveryBtn'),
    document.getElementById('email2faEnableBtn'),
    document.getElementById('email2faVerifyBtn'),
    document.getElementById('email2faDisableBtn')
  ].filter(Boolean);
  triggers.forEach(btn => btn.addEventListener('click', ()=> {
    const scope = btn.id.startsWith('email') ? 'email' : 'twofa';
    ensureSecurityCaptcha(scope).catch(()=>{});
  }, { once: true }));
}

