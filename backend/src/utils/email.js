const nodemailer = require('nodemailer');

const port = Number(process.env.SMTP_PORT || 465);
const enableDebug = String(process.env.SMTP_DEBUG || '').toLowerCase() === 'true' || process.env.SMTP_DEBUG === '1';
const forceSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const secure = forceSecure || port === 465; // SSL on 465, STARTTLS otherwise

const auth = (process.env.SMTP_USER && process.env.SMTP_PASS)
  ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  : undefined;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth,
  authMethod: process.env.SMTP_AUTH_METHOD || undefined, // e.g., 'LOGIN', 'PLAIN'
  logger: enableDebug,
  debug: enableDebug,
  tls: (String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase() === 'false')
    ? { rejectUnauthorized: false }
    : undefined,
});

async function sendMail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || 'KEOHAMS <noreply@example.com>';
  return transporter.sendMail({ from, to, subject, html });
}

async function verifyTransport() {
  return transporter.verify();
}

module.exports = { sendMail, verifyTransport };
