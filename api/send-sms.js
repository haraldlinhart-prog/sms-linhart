// api/send-sms.js v2 — Vercel Serverless Function (Node.js runtime)
export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: 'Missing phone number' });
  }

  let phone = to.toString().trim().replace(/\s/g, '');
  if (!phone.startsWith('+')) {
    if (phone.startsWith('00')) {
      phone = '+' + phone.slice(2);
    } else {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from) {
    return res.status(500).json({ error: 'Missing config', vars: { accountSid: !!accountSid, authToken: !!authToken, from: !!from } });
  }

  const smsBody = 'Büro Linhart: Online-Terminbuchung unter https://telefon-termin.com/beratung';
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: phone, Body: smsBody }).toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', JSON.stringify(data));
      return res.status(500).json({ error: data.message || 'SMS failed', code: data.code });
    }

    return res.status(200).json({ success: true, sid: data.sid });
  } catch (err) {
    console.error('SMS error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
