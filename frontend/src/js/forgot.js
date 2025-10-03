const API_BASE = 'http://localhost:4000/api';

const form = document.getElementById('forgotForm');
const emailInput = document.getElementById('forgotEmail');
const btn = document.getElementById('forgotBtn');
const success = document.getElementById('forgotSuccess');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  try {
    const email = emailInput.value.trim();
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    // Always show success to avoid revealing if email exists
    success.classList.remove('d-none');
  } catch (e) {
    success.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
});
