require('dotenv').config();
const { verifyTransport, sendMail } = require('../src/utils/email');

(async () => {
  try {
    console.log('Verifying SMTP transport...');
    const ok = await verifyTransport();
    console.log('SMTP verify:', ok);

    const to = process.env.SMTP_TEST_TO || process.env.SMTP_USER;
    if (!to) {
      console.error('No SMTP_TEST_TO or SMTP_USER set to send test email');
      process.exit(1);
    }

    console.log('Sending test email to', to);
    const info = await sendMail({
      to,
      subject: 'KEOHAMS SMTP test',
      html: '<p>This is a test email from KEOHAMS backend.</p>'
    });
    console.log('Sent:', info.messageId);
    if (info.accepted && info.accepted.length) {
      console.log('Accepted by:', info.accepted.join(', '));
    }
  } catch (e) {
    console.error('Email test failed:', e);
    process.exit(1);
  }
})();
