// ============================================================
// Click & Cook — Conversions API Relay (Netlify Function)
// ------------------------------------------------------------
// ฉบับ JavaScript ของ capi.php สำหรับ Netlify (static host
// รัน PHP ไม่ได้) — logic เดียวกัน: validate input, attach
// client ip/ua/fbp/fbc, ส่งต่อเข้า Graph API
//
// Access Token: ตั้งใน Netlify UI → Site settings →
// Environment variables → key = FB_ACCESS_TOKEN
// ============================================================

const PIXEL_ID = '1052233364217187';
const GRAPH_VERSION = 'v21.0';

const json = (body, status = 200) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const eventName = typeof data.event_name === 'string' ? data.event_name : '';
  if (!/^[A-Za-z0-9_]{1,80}$/.test(eventName)) {
    return json({ ok: false, error: 'invalid_event_name' }, 400);
  }

  const eventId =
    typeof data.event_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(data.event_id)
      ? data.event_id
      : [...crypto.getRandomValues(new Uint8Array(8))]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

  /* ---- user_data ---- */
  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['x-forwarded-for']?.split(',')[0].trim() || '';
  const userData = {};
  if (/^[\d.:a-fA-F]+$/.test(ip)) userData.client_ip_address = ip;
  if (h['user-agent']) userData.client_user_agent = h['user-agent'];
  if (typeof data.fbp === 'string' && data.fbp) userData.fbp = data.fbp.slice(0, 255);
  if (typeof data.fbc === 'string' && data.fbc) userData.fbc = data.fbc.slice(0, 255);

  /* ---- custom_data ---- */
  const customData = {};
  if (data.event_params && typeof data.event_params === 'object') {
    for (const [k, v] of Object.entries(data.event_params)) {
      if ((typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
          && k.length > 0 && k.length <= 60) {
        customData[k] = String(v);
      }
    }
  }

  const ev = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    user_data: userData,
  };
  if (typeof data.page_url === 'string' && /^https?:\/\//.test(data.page_url.slice(0, 500))) {
    ev.event_source_url = data.page_url.slice(0, 500);
  }
  if (Object.keys(customData).length > 0) ev.custom_data = customData;

  const params = new URLSearchParams({
    access_token: process.env.FB_ACCESS_TOKEN || '',
    data: JSON.stringify([ev]),
  });
  if (process.env.TEST_EVENT_CODE) params.set('test_event_code', process.env.TEST_EVENT_CODE);

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(10000),
    });
    return json({ ok: res.ok }, res.ok ? 200 : 502);
  } catch {
    return json({ ok: false, error: 'relay_failed' }, 502);
  }
};
