// api/send-sms.js — Vercel Serverless Function
// Twilio SMS für Famulor Mid-Call-Tool (Frau Wagner)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: 'Missing phone number' });
  }

  // Nummer bereinigen
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

  const body = `Büro Linhart: Online-Terminbuchung unter https://telefon-termin.com/beratung`;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: phone, Body: body }).toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return res.status(500).json({ error: data.message || 'SMS failed' });
    }

    return res.status(200).json({ success: true, sid: data.sid });
  } catch (err) {
    console.error('SMS error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
