const contactModel = require('../models/contactMessage');
const { sendMail } = require('../utils/email');

async function submit(req, res){
  const { name, email, subject, message } = req.body || {};
  if(!name || !email || !subject || !message){
    return res.status(400).json({ message:'All fields are required' });
  }
  const user_id = req.user?.sub || null;
  const clean = { name: name.trim(), email: email.trim(), subject: subject.trim(), body: message.trim(), user_id };
  const created = await contactModel.create(clean);

  // Fire-and-forget email notifications (do not block response)
  (async ()=>{
    // Fallback order: explicit contact override, dedicated notify var, ADMIN_EMAIL, SMTP_USER
    const adminTo = process.env.CONTACT_ADMIN_EMAIL || process.env.SMTP_NOTIFY || process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    const siteName = process.env.SITE_NAME || 'KEOHAMS';
    try {
      if (adminTo) {
        await sendMail({
          to: adminTo,
            subject: `[${siteName}] New contact message: ${clean.subject}`,
            html: `<p><strong>From:</strong> ${clean.name} &lt;${clean.email}&gt;</p>
                   <p><strong>Subject:</strong> ${clean.subject}</p>
                   <p><strong>Message:</strong></p>
                   <pre style="font-family:monospace; white-space:pre-wrap; background:#f7f7f7; padding:8px;">${escapeHtmlForEmail(clean.body)}</pre>
                   <p style="font-size:12px;color:#888;">Message ID ${created.id} · ${new Date(created.created_at).toLocaleString()}</p>`
        });
      }
      // Acknowledge user (only if not obviously an internal address)
      if (clean.email && /@/.test(clean.email)) {
        await sendMail({
          to: clean.email,
          subject: `We received your message: ${clean.subject}`,
          html: `<p>Hello ${clean.name.split(' ')[0] || 'there'},</p>
                 <p>Thanks for contacting ${siteName}. We have received your message and a member of our team will respond as soon as possible.</p>
                 <p><em>Your message preview:</em></p>
                 <blockquote style="border-left:4px solid #ccc; margin:0; padding:6px 12px; background:#fafafa;">${escapeHtmlForEmail(clean.body).slice(0,800)}${clean.body.length>800?'…':''}</blockquote>
                 <p style="font-size:12px;color:#666;">Reference ID: ${created.id}. If you did not submit this, you can ignore this email.</p>`
        });
      }
    } catch(e){ console.warn('Contact email send failed:', e.message); }
  })();

  res.status(201).json({ data: created, message: 'Message received' });
}

  function escapeHtmlForEmail(str='') {
    return str.replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch] || ch));
  }

async function list(req, res){
  const { page, pageSize, unread } = req.query;
  const result = await contactModel.list({ page, pageSize, unreadOnly: unread==='true' });
  res.json(result);
}

async function show(req, res){
  const row = await contactModel.findById(req.params.id);
  if(!row) return res.status(404).json({ message:'Not found' });
  res.json({ data: row });
}

async function markRead(req, res){
  const row = await contactModel.markRead(req.params.id);
  if(!row) return res.status(404).json({ message:'Not found' });
  res.json({ data: row });
}

module.exports = { submit, list, show, markRead };
