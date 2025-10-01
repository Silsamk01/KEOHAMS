const { sign, verify } = require('./jwt');

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function createCaptcha() {
  const code = randomCode(6);
  const expiresInSec = 5 * 60;
  const token = sign({ type: 'captcha', code }, { expiresIn: `${expiresInSec}s` });
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  return { token, code, question: `Enter code: ${code}`, expiresAt, ttl: expiresInSec };
}

function verifyCaptcha(captchaToken, answer) {
  if (!captchaToken) throw new Error('Captcha token required');
  let payload;
  try { payload = verify(captchaToken); }
  catch (e) { throw new Error('Captcha expired or invalid'); }
  if (payload.type !== 'captcha') throw new Error('Invalid captcha token');
  const expected = String(payload.code || '').toUpperCase();
  const got = String(answer || '').trim().toUpperCase();
  if (expected.length !== 6 || got.length !== 6) throw new Error('Captcha code must be 6 characters');
  if (got !== expected) throw new Error('Incorrect captcha code');
  return true;
}

module.exports = { createCaptcha, verifyCaptcha };
