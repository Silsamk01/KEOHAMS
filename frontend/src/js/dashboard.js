const API_BASE = 'http://localhost:4000/api';
let kycApproved = false;

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

function switchPane(id) {
  document.querySelectorAll('.pane').forEach(p => p.classList.add('d-none'));
  document.querySelector(id)?.classList.remove('d-none');
  document.querySelectorAll('#dashNav .nav-link').forEach(a => a.classList.remove('active'));
  document.querySelector(`#dashNav .nav-link[data-target="${id}"]`)?.classList.add('active');
}

function showKycModal() {
  const el = document.getElementById('kycRequiredModal');
  if (!el) return;
  if (window.bootstrap?.Modal) {
    new window.bootstrap.Modal(el).show();
  } else {
    el.classList.add('show');
    el.style.display = 'block';
  }
}

function hideKycModal() {
  const el = document.getElementById('kycRequiredModal');
  if (!el) return;
  if (window.bootstrap?.Modal) {
    const inst = window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el);
    inst.hide();
  } else {
    el.classList.remove('show');
    el.style.display = 'none';
  }
}

function updateNavGating() {
  document.querySelectorAll('#dashNav .nav-link').forEach(a => {
    const target = a.getAttribute('data-target');
    const isGatable = target && target !== '#pane-kyc' && target !== '#pane-overview';
    if (isGatable) {
      if (!kycApproved) {
        a.setAttribute('data-gated', 'true');
        a.classList.add('text-muted');
      } else {
        a.removeAttribute('data-gated');
        a.classList.remove('text-muted');
      }
    }
  });
}

async function loadKycStatus() {
  try {
    const row = await fetchJSON(`${API_BASE}/kyc/me`);
    const banner = document.getElementById('kycBanner');
    const statusEl = document.getElementById('kycStatus');
    if (!row) {
      kycApproved = false;
      banner.style.display = 'block';
      banner.className = 'alert alert-warning';
      banner.textContent = 'Your account is not verified. Please complete KYC to access all features.';
      statusEl.innerHTML = '<div class="alert alert-info">No submission yet. Please submit your documents.</div>';
      updateNavGating();
      return;
    }
    const status = row.status;
    if (status === 'APPROVED') {
      kycApproved = true;
      banner.style.display = 'none';
      statusEl.innerHTML = '<div class="alert alert-success">KYC approved. You have full access.</div>';
      document.getElementById('kycForm')?.classList.add('d-none');
    } else if (status === 'REJECTED') {
      kycApproved = false;
      banner.style.display = 'block';
      banner.className = 'alert alert-danger';
      banner.textContent = 'KYC rejected. Please resubmit your documents.';
      statusEl.innerHTML = `<div class="alert alert-danger">Rejected${row.review_notes?': '+row.review_notes:''}</div>`;
      document.getElementById('kycForm')?.classList.remove('d-none');
    } else {
      kycApproved = false;
      banner.style.display = 'block';
      banner.className = 'alert alert-warning';
      banner.textContent = 'KYC pending review by admin.';
      statusEl.innerHTML = '<div class="alert alert-warning">Pending review.</div>';
      document.getElementById('kycForm')?.classList.add('d-none');
    }
    updateNavGating();
  } catch (e) {
    console.error('kyc status failed', e);
  }
}

function wireNav() {
  document.querySelectorAll('#dashNav .nav-link').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.getAttribute('data-target');
      if (a.getAttribute('data-gated') === 'true') {
        showKycModal();
        return;
      }
      if (target) switchPane(target);
    });
  });
  const goto = document.querySelector('[data-goto-kyc]');
  if (goto) goto.addEventListener('click', () => { hideKycModal(); switchPane('#pane-kyc'); });
  document.getElementById('dashSignOut').addEventListener('click', (e)=>{ e.preventDefault(); localStorage.removeItem('token'); window.location.href='/'; });
}

function wireKycForm() {
  const form = document.getElementById('kycForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const portrait = document.getElementById('kycPortrait').files[0];
      const selfie = document.getElementById('kycSelfieVideo').files[0];
      const idFront = document.getElementById('kycIdFront').files[0];
      const idBack = document.getElementById('kycIdBack').files[0];
      if (!portrait || !selfie || !idFront) return alert('Portrait, selfie video and ID front are required');
      const fd = new FormData();
      fd.set('portrait', portrait);
      fd.set('selfie_video', selfie);
      fd.set('id_front', idFront);
      if (idBack) fd.set('id_back', idBack);
      const notes = document.getElementById('kycNotes').value.trim();
      if (notes) fd.set('notes', notes);
      const res = await fetch(`${API_BASE}/kyc/submit`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      alert('KYC submitted');
      await loadKycStatus();
    } catch (e) { alert(e.message || 'Submit failed'); }
  });
}

(function init(){
  wireNav();
  wireKycForm();
  switchPane('#pane-overview');
  loadKycStatus();
  setupKycCamera();
})();

// =============================
// KYC Camera Capture (photo/video)
// =============================
function setupKycCamera() {
  const btnPhoto = document.getElementById('btnUseCameraPhoto');
  const btnVideo = document.getElementById('btnUseCameraVideo');
  if (!btnPhoto && !btnVideo) return;

  let photoStream = null;
  let videoStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];

  const photoModalEl = document.getElementById('photoCaptureModal');
  const videoModalEl = document.getElementById('videoCaptureModal');
  const photoVideo = document.getElementById('photoPreview');
  const videoVideo = document.getElementById('videoPreview');

  async function startStream(forVideo=false) {
    const constraints = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: forVideo };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  }

  function stopTracks(stream) {
    try { stream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  }

  // Photo capture
  btnPhoto?.addEventListener('click', async ()=>{
    try {
      photoStream = await startStream(false);
      photoVideo.srcObject = photoStream;
      new bootstrap.Modal(photoModalEl).show();
    } catch (e) {
      alert('Could not access camera. Please allow camera permissions or use file upload.');
    }
  });

  photoModalEl?.addEventListener('hidden.bs.modal', ()=>{ stopTracks(photoStream); photoStream=null; });
  document.getElementById('btnCapturePhoto')?.addEventListener('click', ()=>{
    if (!photoStream) return;
    const trackSettings = photoStream.getVideoTracks()[0]?.getSettings?.() || {};
    const w = trackSettings.width || 1280; const h = trackSettings.height || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(photoVideo, 0, 0, w, h);
    canvas.toBlob((blob)=>{
      if (!blob) return;
      const file = new File([blob], 'portrait.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.getElementById('kycPortrait');
      if (input) input.files = dt.files;
      bootstrap.Modal.getInstance(photoModalEl)?.hide();
    }, 'image/jpeg', 0.92);
  });

  // Video capture
  btnVideo?.addEventListener('click', async ()=>{
    try {
      videoStream = await startStream(true);
      mediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      recordedChunks = [];
      mediaRecorder.ondataavailable = (e)=>{ if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = ()=>{
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const file = new File([blob], 'selfie.webm', { type: 'video/webm' });
        const dt = new DataTransfer(); dt.items.add(file);
        const input = document.getElementById('kycSelfieVideo');
        if (input) input.files = dt.files;
        stopTracks(videoStream); videoStream=null;
        const stopBtn = document.getElementById('btnStopVideo');
        const startBtn = document.getElementById('btnStartVideo');
        startBtn?.classList.remove('d-none');
        stopBtn?.classList.add('d-none');
        bootstrap.Modal.getInstance(videoModalEl)?.hide();
      };
      videoVideo.srcObject = videoStream;
      const startBtn = document.getElementById('btnStartVideo');
      const stopBtn = document.getElementById('btnStopVideo');
      startBtn?.classList.remove('d-none');
      stopBtn?.classList.add('d-none');
      new bootstrap.Modal(videoModalEl).show();
    } catch (e) {
      alert('Could not access camera/microphone. Please allow permissions or use file upload.');
    }
  });

  document.getElementById('btnStartVideo')?.addEventListener('click', ()=>{
    if (!mediaRecorder) return;
    recordedChunks = [];
    mediaRecorder.start();
    document.getElementById('btnStartVideo')?.classList.add('d-none');
    document.getElementById('btnStopVideo')?.classList.remove('d-none');
  });
  document.getElementById('btnStopVideo')?.addEventListener('click', ()=>{
    if (!mediaRecorder) return;
    mediaRecorder.stop();
  });
  videoModalEl?.addEventListener('hidden.bs.modal', ()=>{ try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch(_){ } stopTracks(videoStream); videoStream=null; });
}
