const nodemailer = require('nodemailer');

const port = Number(process.env.SMTP_PORT || 587);
const enableDebug = String(process.env.SMTP_DEBUG || '').toLowerCase() === 'true' || process.env.SMTP_DEBUG === '1';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465, // true for 465, false for other ports (STARTTLS)
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: enableDebug,
  debug: enableDebug,
});

async function sendMail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || 'KEOHAMS <noreply@example.com>';
  return transporter.sendMail({ from, to, subject, html });
}

async function verifyTransport() {
  return transporter.verify();
}

module.exports = { sendMail, verifyTransport };
