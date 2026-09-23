import crypto from 'node:crypto';

const env = (n, f = '') => process.env[n] || f;
const ENDPOINT = env('APPWRITE_ENDPOINT');
const PROJECT = env('APPWRITE_PROJECT_ID');
const KEY = env('APPWRITE_API_KEY');
const DB = env('APPWRITE_DATABASE_ID');
const ORDERS = env('APPWRITE_ORDERS_TABLE', 'orders');
const FILES = env('APPWRITE_FILES_TABLE', 'order_files');
const EVENTS = env('APPWRITE_EVENTS_TABLE', 'order_events');
const MESSAGES = env('APPWRITE_MESSAGES_TABLE', 'messages');
const OFFERS = env('APPWRITE_OFFERS_TABLE', 'offers');
const BUCKET = env('APPWRITE_STORAGE_BUCKET', 'order-files');
const ADMIN = env('ADMIN_TOKEN');
const SITE = env('SITE_URL', 'https://songs.racharlagpt.in');
const RESEND_API_KEY = env('RESEND_API_KEY');
const EMAIL_FROM = env('EMAIL_FROM');

const cors = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-File-Name',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Cache-Control': 'no-store'
};
const json = (res, data, status = 200) => res.json(data, status, cors);
const bad = (res, message, status = 400) => json(res, { error: message }, status);

async function aw(path, opt = {}) {
  if (!ENDPOINT || !PROJECT || !KEY) throw Error('Appwrite environment is not configured');
  const r = await fetch(ENDPOINT.replace(/\/$/, '') + '/v1' + path, {
    ...opt,
    headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY, ...(opt.headers || {}) }
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data.message || text);
  return data;
}
async function rows(table, maxPages = 100) {
  const all = [];
  let cursor = '';
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: '100' });
    if (cursor) qs.set('cursorAfter', cursor);
    const d = await aw(`/tablesdb/${DB}/tables/${encodeURIComponent(table)}/rows?${qs.toString()}`);
    const batch = Array.isArray(d.rows) ? d.rows : [];
    all.push(...batch);
    if (batch.length < 100) break;
    const next = batch[batch.length - 1]?.$id;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return all;
}
async function findOrder(orderNumber) { return (await rows(ORDERS)).find(r => String(r?.order_number) === String(orderNumber)) || null; }
async function findServiceRow() { return (await rows(OFFERS)).find(r => String(r?.name || '').toUpperCase() === 'SERVICE_STATUS') || null; }
async function create(table, data) {
  return aw(`/tablesdb/${DB}/tables/${encodeURIComponent(table)}/rows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowId: 'unique()', data }) });
}
async function update(table, id, data) {
  return aw(`/tablesdb/${DB}/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
}
async function fileToken(fileId) {
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const d = await aw(`/tokens/buckets/${encodeURIComponent(BUCKET)}/files/${encodeURIComponent(fileId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expire: exp })
  });
  return `${ENDPOINT.replace(/\/$/, '')}/v1/storage/buckets/${encodeURIComponent(BUCKET)}/files/${encodeURIComponent(fileId)}/download?project=${encodeURIComponent(PROJECT)}&token=${encodeURIComponent(d.secret)}`;
}
function auth(req) { return !!ADMIN && req.headers.authorization === `Bearer ${ADMIN}`; }
function hashToken(t) { return crypto.createHash('sha256').update(t).digest('hex'); }
function newAccessToken() { return crypto.randomBytes(24).toString('base64url'); }
function safe(order) { const copy = { ...order }; delete copy.access_token_hash; return copy; }
const ALLOWED = ['ORDER_RECEIVED','PAYMENT_VERIFIED','REQUIREMENTS_RECEIVED','IN_PRODUCTION','QUALITY_CHECK','READY','DELIVERED','NEEDS_MORE_INFORMATION','REVISION_REQUESTED'];
async function sendOrderConfirmationEmail(order) {
  if (!RESEND_API_KEY || !EMAIL_FROM) throw Error('Email service is not configured in admin-api');
  if (!order?.email) throw Error('Customer email is missing');
  const subject = `RacharlaGPT Music — Order ${order.order_number} confirmed`;
  const name = String(order.customer_name || 'Customer');
  const amount = Number(order.price || 0).toLocaleString('en-IN');
  const text = [
    `Hello ${name},`,
    '',
    'Your personalized song order has been confirmed.',
    '',
    `Order Number: ${order.order_number}`,
    `Occasion: ${order.occasion || 'Personalized song'}`,
    `Amount Paid: ₹${amount}`,
    'Payment: Confirmed',
    '',
    'Your song is now in our production process.',
    '',
    'To check your order anytime:',
    `${SITE}/track-order.html`,
    '',
    'Enter your RM Order Number and the email address used for your order.',
    '',
    'Please keep your RM number for future reference.',
    '',
    'Thank you for choosing RacharlaGPT Music.',
    'Your Idea. Your Song. Your World.'
  ].join('\\n');
  const html = text
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('\\n','<br>');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [order.email], subject, text, html })
  });
  const body = await r.text();
  if (!r.ok) throw Error(`Email provider ${r.status}: ${body}`);
  return true;
}


export default async ({ req, res, error }) => {
  try {
    if (req.method === 'OPTIONS') return json(res, {});

    if (req.path === '/login' && req.method === 'POST') {
      if (!ADMIN) return bad(res, 'Admin token is not configured', 500);
      const password = String((req.bodyJson || {}).password || '');
      if (!password || password.length !== ADMIN.length || !crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN))) return bad(res, 'Invalid credentials', 401);
      return json(res, { ok: true, token: ADMIN });
    }
    if (!auth(req)) return bad(res, 'Unauthorized', 401);

    if (req.method === 'GET' && req.path === '/service-status') {
      const row = await findServiceRow();
      return json(res, {
        enabled: row ? row.active !== false && String(row.code || 'ENABLED').toUpperCase() === 'ENABLED' : true,
        message: 'We are currently unable to accept new song orders. Please come back later.'
      });
    }

    if (req.method === 'POST' && req.path === '/service-status') {
      const body = req.bodyJson || {};
      const enabled = body.enabled !== false;
      const message = 'We are currently unable to accept new song orders. Please come back later.';
      const existing = await findServiceRow();
      const data = { name: 'SERVICE_STATUS', code: enabled ? 'ENABLED' : 'DISABLED', price: 0, normal_price: 0, active: enabled, start_at: null, end_at: null, created_at: existing?.created_at || new Date().toISOString() };
      if (existing) await update(OFFERS, existing.$id, data);
      else await create(OFFERS, data);
      return json(res, { ok: true, enabled, message });
    }

    if (req.method === 'GET' && req.path === '/orders') {
      const result = await rows(ORDERS);
      result.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
      const orders = result.map(safe);
      const paid = orders.filter(o => o.payment_status === 'PAID');
      return json(res, {
        orders,
        summary: {
          total: orders.length,
          paid: paid.length,
          pending_payment: orders.filter(o => o.payment_status === 'PENDING').length,
          failed_payment: orders.filter(o => o.payment_status === 'FAILED').length,
          in_production: orders.filter(o => ['IN_PRODUCTION','QUALITY_CHECK'].includes(o.status)).length,
          ready: orders.filter(o => ['READY','DELIVERED'].includes(o.status)).length,
          delivered: orders.filter(o => o.status === 'DELIVERED').length,
          revenue: paid.reduce((sum,o) => sum + Number(o.price || 0), 0)
        }
      });
    }

    let match = req.path.match(/^\/orders\/([^/]+)$/);
    if (req.method === 'GET' && match) {
      const orderNumber = decodeURIComponent(match[1]);
      const order = await findOrder(orderNumber);
      if (!order) return bad(res, 'Order not found', 404);
      const allFiles = await rows(FILES), allMessages = await rows(MESSAGES), allEvents = await rows(EVENTS);
      const files = allFiles.filter(x => String(x?.order_number) === orderNumber).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)));
      return json(res, {
        order: safe(order),
        files,
        messages: allMessages.filter(x => String(x?.order_number) === orderNumber).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at))),
        events: allEvents.filter(x => String(x?.order_number) === orderNumber).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)))
      });
    }


    if (req.method === 'POST' && req.path.match(/^\/orders\/[^/]+\/send-confirmation-email$/)) {
      const emailMatch = req.path.match(/^\/orders\/([^/]+)\/send-confirmation-email$/);
      const orderNumber = decodeURIComponent(emailMatch[1]);
      const order = await findOrder(orderNumber);
      if (!order) return bad(res, 'Order not found', 404);
      if (order.payment_status !== 'PAID') return bad(res, 'Confirmation email can only be sent after payment is PAID', 409);
      await sendOrderConfirmationEmail(order);
      await create(EVENTS, {
        order_number: orderNumber,
        event_type: 'CUSTOMER_EMAIL_RESENT',
        message: 'Studio resent the order confirmation email to the customer.',
        created_at: new Date().toISOString(),
        created_by: 'admin'
      });
      return json(res, { ok: true, email: order.email });
    }

    if (req.method === 'PATCH' && match) {
      const orderNumber = decodeURIComponent(match[1]);
      const order = await findOrder(orderNumber);
      if (!order) return bad(res, 'Order not found', 404);
      const body = req.bodyJson || {};
      if (body.status && !ALLOWED.includes(body.status)) return bad(res, 'Invalid status');
      if (body.status === 'PAYMENT_VERIFIED' && order.payment_status !== 'PAID') return bad(res, 'Cannot mark payment verified until payment is PAID');
      if (body.status === 'READY' && order.payment_status !== 'PAID') return bad(res, 'Cannot mark an unpaid order READY');
      if (body.status === 'DELIVERED' && !['READY','DELIVERED'].includes(order.status)) return bad(res, 'Order must be READY before it can be delivered');
      const data = {};
      if (body.status) data.status = body.status;
      if (typeof body.revision_count === 'number' && body.revision_count >= 0) data.revision_count = Math.floor(body.revision_count);
      if (Object.keys(data).length) await update(ORDERS, order.$id, data);
      await create(EVENTS, { order_number: orderNumber, event_type: body.status || 'ORDER_UPDATED', message: body.admin_note ? String(body.admin_note).slice(0,2000) : null, created_at: new Date().toISOString(), created_by: 'admin' });
      return json(res, { ok: true });
    }

    match = req.path.match(/^\/orders\/([^/]+)\/access-link$/);
    if (req.method === 'POST' && match) {
      const orderNumber = decodeURIComponent(match[1]);
      const order = await findOrder(orderNumber);
      if (!order) return bad(res, 'Order not found', 404);

      const accessToken = newAccessToken();
      await update(ORDERS, order.$id, { access_token_hash: hashToken(accessToken) });
      await create(EVENTS, {
        order_number: orderNumber,
        event_type: 'ACCESS_LINK_RESET_BY_ADMIN',
        message: 'Studio generated a fresh private customer access link.',
        created_at: new Date().toISOString(),
        created_by: 'admin'
      });

      return json(res, {
        ok: true,
        order_number: orderNumber,
        track_url: `${SITE}/track.html?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(accessToken)}`
      });
    }

    match = req.path.match(/^\/orders\/([^/]+)\/messages$/);
    if (req.method === 'POST' && match) {
      const orderNumber = decodeURIComponent(match[1]);
      if (!(await findOrder(orderNumber))) return bad(res, 'Order not found', 404);
      const body = String((req.bodyJson || {}).body || '').trim();
      if (!body || body.length > 2000) return bad(res, 'Message is empty or too long');
      await create(MESSAGES, { order_number: orderNumber, sender_type: 'admin', message: body, created_at: new Date().toISOString(), read_at: new Date().toISOString() });
      await create(EVENTS, { order_number: orderNumber, event_type: 'ADMIN_MESSAGE', message: 'Studio sent a message.', created_at: new Date().toISOString(), created_by: 'admin' });
      return json(res, { ok: true });
    }

    match = req.path.match(/^\/orders\/([^/]+)\/mp3$/);
    if (req.method === 'POST' && match) {
      const orderNumber = decodeURIComponent(match[1]);
      const order = await findOrder(orderNumber);
      if (!order) return bad(res, 'Order not found', 404);
      if (order.payment_status !== 'PAID') return bad(res, 'Payment must be PAID before final delivery');
      const bytes = req.bodyBinary;
      if (!bytes?.length || bytes.length > 30 * 1024 * 1024) return bad(res, 'MP3 is empty or too large');
      const name = (req.headers['x-file-name'] || `${orderNumber}-final.mp3`).replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/\.mp3$/i.test(name)) return bad(res, 'Final file must be an MP3');
      const form = new FormData();
      form.append('fileId', 'unique()');
      form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), name);
      const uploaded = await aw(`/storage/buckets/${encodeURIComponent(BUCKET)}/files`, { method: 'POST', body: form });
      await create(FILES, { order_number: orderNumber, file_type: 'mp3', file_name: name, file_id: uploaded.$id, mime_type: 'audio/mpeg', created_at: new Date().toISOString() });
      await update(ORDERS, order.$id, { status: 'READY' });
      await create(EVENTS, { order_number: orderNumber, event_type: 'SONG_READY', message: 'Final MP3 uploaded and order marked READY.', created_at: new Date().toISOString(), created_by: 'admin' });
      return json(res, { ok: true, file_id: uploaded.$id, status: 'READY' });
    }

    match = req.path.match(/^\/files\/([^/]+)\/url$/);
    if (req.method === 'GET' && match) {
      const fileId = decodeURIComponent(match[1]);
      const allFiles = await rows(FILES);
      if (!allFiles.some(x => String(x?.file_id) === fileId)) return bad(res, 'File not found', 404);
      return json(res, { ok: true, url: await fileToken(fileId) });
    }

    return bad(res, 'Route not found', 404);
  } catch (e) {
    error(e?.stack || String(e));
    return bad(res, 'Server error', 500);
  }
};
