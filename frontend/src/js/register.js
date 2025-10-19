const API_BASE = 'http://localhost:4000/api';
let captchaToken = null;
let captchaTimer = null;
let captchaCode = null; // not shown in DOM; used only for drawing

async function loadCaptcha() {
  try {
    document.getElementById('captchaQuestion').textContent = 'Loading…';
    const res = await fetch(`${API_BASE}/auth/captcha`);
    if (!res.ok) throw new Error('Failed to load captcha');
    const data = await res.json();
    captchaToken = data.token;
    const code = (data.question || '').replace('Enter code: ', '').trim();
    captchaCode = code.toUpperCase();
    // Keep for screen readers only
    document.getElementById('captchaQuestion').textContent = `Captcha code ${captchaCode.split('').join(' ')}`;
    drawCaptcha(captchaCode);
    if (captchaTimer) clearTimeout(captchaTimer);
    // refresh 10s before expiry
    if (data.ttl) {
      const refreshMs = Math.max(0, (data.ttl - 10) * 1000);
      captchaTimer = setTimeout(loadCaptcha, refreshMs);
    }
  } catch (e) {
    // Fallback text for accessibility if draw fails
    document.getElementById('captchaQuestion').textContent = 'Error loading captcha. Try refresh.';
    captchaToken = null;
    // Clear canvas
    const c = document.getElementById('captchaCanvas');
    if (c && c.getContext) { const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); }
  }
}

document.getElementById('refreshCaptcha').addEventListener('click', loadCaptcha);

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const dob = document.getElementById('dob').value;
  const gender = document.getElementById('gender').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const captchaAnswer = document.getElementById('captchaAnswer').value.trim();

  if (password !== confirmPassword) { alert('Passwords do not match'); submitBtn.disabled = false; return; }
  if (!dob) { alert('Please provide your date of birth'); submitBtn.disabled = false; return; }
  try {
    const birth = new Date(dob);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear() - ((now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) ? 1 : 0);
    if (age < 18) { alert('You must be at least 18 years old to register'); submitBtn.disabled = false; return; }
  } catch (_) {}
  if (!captchaToken) { await loadCaptcha(); }
  if (!/^[a-zA-Z0-9]{6}$/.test(captchaAnswer)) {
    const ce = document.getElementById('captchaError');
    ce.textContent = 'Enter a 6-character code (letters/numbers).';
    document.getElementById('captchaAnswer').classList.add('is-invalid');
    submitBtn.disabled = false;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, dob, gender: gender || undefined, password, phone, address, captchaToken, captchaAnswer })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || 'Registration failed';
      if (/captcha|expired|invalid/i.test(msg)) {
        const ce = document.getElementById('captchaError');
        ce.textContent = msg;
        document.getElementById('captchaAnswer').classList.add('is-invalid');
      } else {
        alert(msg);
      }
      await loadCaptcha();
      submitBtn.disabled = false;
      return;
    }
  document.getElementById('captchaAnswer').classList.remove('is-invalid');
  document.getElementById('successAlert').classList.remove('d-none');
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(_) { window.scrollTo(0,0); }
    (document.getElementById('registerForm')).reset();
    await loadCaptcha();
  } catch (e) {
    alert(e.message || 'Network error');
  } finally {
    submitBtn.disabled = false;
  }
});

loadCaptcha();

document.getElementById('captchaCanvas').addEventListener('click', loadCaptcha);

function drawCaptcha(code) {
  const canvas = document.getElementById('captchaCanvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const bgGradient = ctx.createLinearGradient(0, 0, W, H);
  bgGradient.addColorStop(0, '#f8fbff');
  bgGradient.addColorStop(1, '#e9f0ff');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(${rand(50,150)},${rand(50,150)},${rand(50,150)},0.6)`;
    ctx.lineWidth = rand(1, 2);
    ctx.beginPath();
    ctx.moveTo(rand(0, W/2), rand(0, H));
    ctx.bezierCurveTo(rand(0, W), rand(0, H), rand(0, W), rand(0, H), rand(W/2, W), rand(0, H));
    ctx.stroke();
  }
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(${rand(100,200)},${rand(100,200)},${rand(100,200)},0.5)`;
    ctx.fillRect(rand(0, W), rand(0, H), 1, 1);
  }
  const chars = code.split('');
  const baseX = 20; const stepX = Math.floor((W - 40) / chars.length);
  chars.forEach((ch, idx) => {
    const x = baseX + idx * stepX + rand(-2, 2);
    const y = rand(Math.floor(H*0.55), Math.floor(H*0.7));
    const angle = (rand(-20, 20) * Math.PI) / 180;
    const fontSize = rand(26, 34);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = `${fontSize}px Verdana, Tahoma, Arial`;
    ctx.fillStyle = `rgb(${rand(20,80)},${rand(20,80)},${rand(20,80)})`;
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 2;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.strokeStyle = '#cfe2ff';
  ctx.strokeRect(0.5, 0.5, W-1, H-1);
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
}
