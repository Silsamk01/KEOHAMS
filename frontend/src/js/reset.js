const API_BASE = 'http://localhost:4000/api';

const form = document.getElementById('resetForm');
const np = document.getElementById('newPassword');
const cp = document.getElementById('confirmPassword');
const btn = document.getElementById('resetBtn');
const ok = document.getElementById('resetSuccess');
const err = document.getElementById('resetError');

function getTokenFromQuery() {
  const u = new URL(window.location.href);
  return u.searchParams.get('token');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.classList.add('d-none');
  ok.classList.add('d-none');
  const token = getTokenFromQuery();
  if (!token) { err.textContent = 'Missing token.'; err.classList.remove('d-none'); return; }
  if (np.value !== cp.value) { err.textContent = 'Passwords do not match'; err.classList.remove('d-none'); return; }
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: np.value })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { throw new Error(data.message || 'Failed to reset password'); }
    ok.classList.remove('d-none');
    form.reset();
    // Redirect to sign-in after a short delay
    setTimeout(() => { window.location.href = '/#signin'; }, 1500);
  } catch (e) {
    err.textContent = e.message || 'Failed to reset password';
    err.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
});
