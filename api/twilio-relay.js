// api/twilio-relay.js — JSON→Twilio-SMS-Relay für Famulor-Mid-Call-Tools.
//
// Famulor 2.0 sendet Tool-Requests nur noch als JSON und ersetzt keine {{Platzhalter}}
// mehr in URL/Headern. Die Twilio Messages API akzeptiert aber nur Formulardaten.
// Dieses Relay nimmt den JSON-Body (From/To/Body) entgegen, setzt bei Bedarf die
// Anrufernummer aus `customer_phone` ein und reicht die Nachricht als Formular an Twilio
// weiter. Die Twilio-Zugangsdaten bleiben im Tool (Authorization-Header) und werden nur
// durchgereicht — hier wird nichts gespeichert. Funktioniert mit Famulor 1.0 und 2.0.
export const runtime = 'nodejs';

const pick = (obj, ...keys) => {
  for (const k of keys) {
    const hit = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && obj[hit] !== undefined && obj[hit] !== null && String(obj[hit]).trim() !== '') return String(obj[hit]).trim();
  }
  return '';
};

function normalizePhone(raw) {
  let p = String(raw || '').trim().replace(/[\s()\-/]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+') && /^\d{8,15}$/.test(p)) p = '+' + p;
  return /^\+\d{7,15}$/.test(p) ? p : '';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return Object.fromEntries(new URLSearchParams(req.body)); }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const sid = String(req.query.sid || '');
  if (!/^AC[0-9a-f]{32}$/i.test(sid)) return res.status(400).json({ ok: false, error: 'Missing or invalid sid' });
  const auth = req.headers.authorization || '';
  if (!/^Basic\s+\S+/i.test(auth)) return res.status(401).json({ ok: false, error: 'Missing Authorization' });

  const b = await readBody(req);
  const body = pick(b, 'Body', 'body', 'message');
  const from = pick(b, 'From', 'from');
  let toRaw = pick(b, 'To', 'to');
  if (!toRaw || toRaw.includes('{{') || toRaw.includes('{')) toRaw = pick(b, 'customer_phone', 'caller_phone', 'phone');
  const to = normalizePhone(toRaw);

  if (!to) return res.status(400).json({ ok: false, error: 'Keine gültige Empfängernummer' });
  if (!from) return res.status(400).json({ ok: false, error: 'Absender fehlt' });
  if (!body) return res.status(400).json({ ok: false, error: 'Text fehlt' });

  const form = new URLSearchParams({ From: from, To: to, Body: body.slice(0, 1500) });
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: j.message || 'Twilio-Fehler', code: j.code });
    return res.status(200).json({ ok: true, sent: true, sid: j.sid, status: j.status });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Twilio nicht erreichbar' });
  }
}
