import crypto from 'node:crypto';

const env = (n, f = '') => process.env[n] || f;
const ENDPOINT = env('APPWRITE_ENDPOINT');
const PROJECT = env('APPWRITE_PROJECT_ID');
const KEY = env('APPWRITE_API_KEY');
const DB = env('APPWRITE_DATABASE_ID', 'music');
const ORDERS = env('APPWRITE_ORDERS_TABLE', 'orders');
const FILES = env('APPWRITE_FILES_TABLE', 'order_files');
const EVENTS = env('APPWRITE_EVENTS_TABLE', 'order_events');
const MESSAGES = env('APPWRITE_MESSAGES_TABLE', 'messages');
const BUCKET = env('APPWRITE_STORAGE_BUCKET', 'order-files');
const RZP_ID = env('RAZORPAY_KEY_ID');
const RZP_SECRET = env('RAZORPAY_KEY_SECRET');
const SITE = env('SITE_URL', 'https://songs.racharlagpt.in');
const NORMAL = Number(env('NORMAL_PRICE', '499'));
const CAMPAIGN = Number(env('CAMPAIGN_PRICE', '99'));
const CAMPAIGN_NAME = env('CAMPAIGN_NAME', 'Vinayaka Chavithi Special');
const START = env('CAMPAIGN_START');
const END = env('CAMPAIGN_END');

const cors = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'Content-Type,X-Access-Token,X-File-Type,X-File-Name',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store'
};
const json = (res, d, s = 200) => res.json(d, s, cors);
const bad = (res, m, s = 400) => json(res, { error: m }, s);

function active() {
  if (!START || !END) return false;
  const s = new Date(START), e = new Date(END), now = new Date();
  return Number.isFinite(s.getTime()) && Number.isFinite(e.getTime()) && now >= s && now <= e;
}
function price() { return active() ? CAMPAIGN : NORMAL; }
function orderNo() {
  return `RM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function token() { return crypto.randomBytes(24).toString('base64url'); }
function hash(t) { return crypto.createHash('sha256').update(t).digest('hex'); }
function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function aw(path, opt = {}) {
  if (!ENDPOINT || !PROJECT || !KEY) throw Error('Appwrite environment is not configured');
  const r = await fetch(ENDPOINT.replace(/\/$/, '') + '/v1' + path, {
    ...opt,
    headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY, ...(opt.headers || {}) }
  });
  const t = await r.text();
  let d = {};
  try { d = t ? JSON.parse(t) : {}; } catch { d = { raw: t }; }
  if (!r.ok) throw Error(`Appwrite ${r.status}: ${d.message || t}`);
  return d;
}

// The project previously hit a TablesDB "Attribute not found in schema" error when
// using queries[]. Keep the trusted server-side lookup, but paginate so it continues
// to work after the order count grows beyond 100 rows.
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
async function findRow(table, column, value) {
  const wanted = String(value);
  return (await rows(table)).find(r => String(r?.[column] ?? '') === wanted) || null;
}
async function create(table, data) {
  return aw(`/tablesdb/${DB}/tables/${encodeURIComponent(table)}/rows`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowId: 'unique()', data })
  });
}
async function update(table, id, data) {
  return aw(`/tablesdb/${DB}/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data })
  });
}
async function orderByNo(no, access) {
  const r = await findRow(ORDERS, 'order_number', no);
  if (!r || !same(hash(access || ''), r.access_token_hash || '')) return null;
  return r;
}
async function rzpOrder(receipt, amount) {
  if (!RZP_ID || !RZP_SECRET) throw Error('Razorpay is not configured');
  const auth = 'Basic ' + Buffer.from(`${RZP_ID}:${RZP_SECRET}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt, notes: { source: 'RacharlaGPT Music', order_number: receipt } })
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error?.description || 'Payment order creation failed');
  return d;
}
async function rzpPayment(paymentId) {
  if (!RZP_ID || !RZP_SECRET) throw Error('Razorpay is not configured');
  const auth = 'Basic ' + Buffer.from(`${RZP_ID}:${RZP_SECRET}`).toString('base64');
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: auth }
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error?.description || 'Could not verify payment status');
  return d;
}
function verifyRazorpayPayment(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', RZP_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  return !!signature && signature.length === expected.length && same(signature, expected);
}

function verifyWebhookSignature(raw, signature) {
  const expected = crypto.createHmac('sha256', env('RAZORPAY_WEBHOOK_SECRET')).update(raw).digest('hex');
  return !!signature && signature.length === expected.length && same(signature, expected);
}
async function markPaymentPaid(order, paymentId, razorpayOrderId, source = 'razorpay') {
  const now = new Date().toISOString();
  const wasPaid = order.payment_status === 'PAID';
  await update(ORDERS, order.$id, {
    payment_status: 'PAID',
    status: order.status === 'ORDER_RECEIVED' ? 'PAYMENT_VERIFIED' : order.status,
    paid_at: order.paid_at || now
  });
  if (!wasPaid) {
    await event(order.order_number, 'PAYMENT_SUCCESS', 'Payment verified and captured by Razorpay.', source, {
      payment_id: paymentId || null,
      razorpay_order_id: razorpayOrderId || order.razorpay_order_id
    });
  }
  return now;
}
async function fileToken(fileId) {
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const d = await aw(`/tokens/buckets/${encodeURIComponent(BUCKET)}/files/${encodeURIComponent(fileId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expire: exp })
  });
  return `${ENDPOINT.replace(/\/$/, '')}/v1/storage/buckets/${encodeURIComponent(BUCKET)}/files/${encodeURIComponent(fileId)}/download?project=${encodeURIComponent(PROJECT)}&token=${encodeURIComponent(d.secret)}`;
}
async function event(order, eventType, message = null, createdBy = null, metadata = null) {
  try {
    await create(EVENTS, {
      order_number: order,
      event_type: eventType,
      message,
      created_at: new Date().toISOString(),
      ...(createdBy ? { created_by: createdBy } : {}),
      ...(metadata ? { metadata: JSON.stringify(metadata) } : {})
    });
  } catch { /* audit logging must not break the customer path */ }
}
function safe(o, messages = [], events = [], files = []) {
  return {
    order_number: o.order_number,
    customer_name: o.customer_name,
    email: o.email,
    occasion: o.occasion,
    input_method: o.input_method,
    description: o.description,
    status: o.status,
    payment_status: o.payment_status,
    price: o.price,
    campaign: o.campaign,
    razorpay_order_id: o.razorpay_order_id,
    created_at: o.created_at,
    paid_at: o.paid_at || null,
    revision_count: o.revision_count || 0,
    download_count: o.download_count || 0,
    last_download_at: o.last_download_at || null,
    song_ready: o.status === 'READY' || o.status === 'DELIVERED',
    files,
    messages,
    events
  };
}

export default async ({ req, res, error }) => {
  try {
    if (req.method === 'OPTIONS') return json(res, {});
    const path = req.path || '/';

    if (req.method === 'GET' && path === '/pricing') {
      return json(res, { price: price(), normal_price: NORMAL, campaign_active: active(), campaign_name: active() ? CAMPAIGN_NAME : null, currency: 'INR' });
    }

    if (req.method === 'POST' && path === '/recover') {
      const b = req.bodyJson || {};
      const email = String(b.email || '').trim().toLowerCase();
      const paymentId = String(b.razorpay_payment_id || b.payment_id || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email) || !paymentId) return bad(res, 'Enter your order email and Razorpay Payment ID');
      const payment = await rzpPayment(paymentId);
      if (String(payment.status || '').toLowerCase() !== 'captured') return bad(res, 'This Razorpay payment is not captured yet', 409);
      const razorpayOrderId = String(payment.order_id || '');
      if (!razorpayOrderId) return bad(res, 'Razorpay order information is missing', 400);
      const o = (await rows(ORDERS)).find(r => String(r?.razorpay_order_id || '') === razorpayOrderId) || null;
      if (!o || String(o.email || '').toLowerCase() !== email) return bad(res, 'We could not verify that payment for this email', 404);
      await markPaymentPaid(o, paymentId, razorpayOrderId, 'customer-recovery');
      const t = token();
      await update(ORDERS, o.$id, { access_token_hash: hash(t) });
      await event(o.order_number, 'ACCESS_LINK_RECOVERED', 'Customer recovered a private order link.', 'customer', { payment_id: paymentId, razorpay_order_id: razorpayOrderId });
      return json(res, { ok: true, order_number: o.order_number, payment_status: 'PAID', track_url: `${SITE}/track.html?order=${encodeURIComponent(o.order_number)}&token=${encodeURIComponent(t)}` });
    }

    if (req.method === 'POST' && path === '/orders') {
      const b = req.bodyJson || {};
      const name = String(b.customer_name || '').trim();
      const email = String(b.email || '').trim().toLowerCase();
      const occasion = String(b.occasion || '').trim();
      const input = String(b.input_method || 'type');
      let description = String(b.description || '').trim();
      if (!name || !email || !occasion) return bad(res, 'Name, email and occasion are required');
      if (!['type', 'upload', 'voice'].includes(input)) return bad(res, 'Invalid input method');
      if (!description) description = input === 'upload' ? 'Requirements provided in the uploaded file.' : input === 'voice' ? 'Requirements provided in the voice recording.' : '';
      if (!description) return bad(res, 'Please enter your song requirements');
      if (name.length > 150 || email.length > 254 || occasion.length > 100 || description.length > 10000) return bad(res, 'One or more fields are too long');
      if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter a valid email');

      const n = orderNo(), t = token(), amount = price();
      const campaign = active() ? CAMPAIGN_NAME : 'Standard';
      const rzp = await rzpOrder(n, amount);
      await create(ORDERS, {
        order_number: n, customer_name: name, email, occasion, input_method: input, description,
        status: 'ORDER_RECEIVED', payment_status: 'PENDING', price: amount, campaign,
        razorpay_order_id: rzp.id, access_token_hash: hash(t), created_at: new Date().toISOString(),
        revision_count: 0, download_count: 0
      });
      await event(n, 'ORDER_CREATED', 'Order received.', 'system');
      return json(res, {
        order_number: n, access_token: t, amount, currency: 'INR', campaign, campaign_active: active(),
        razorpay: { order_id: rzp.id, key_id: RZP_ID },
        track_url: `${SITE}/track.html?order=${encodeURIComponent(n)}&token=${encodeURIComponent(t)}`
      });
    }

    let m = path.match(/^\/orders\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      const no = decodeURIComponent(m[1]);
      const t = req.headers['x-access-token'] || new URLSearchParams(req.queryString || '').get('token');
      const o = await orderByNo(no, t);
      if (!o) return bad(res, 'Order not found', 404);
      const [msR, esR, fsR] = await Promise.allSettled([rows(MESSAGES), rows(EVENTS), rows(FILES)]);
      const ms = (msR.status === 'fulfilled' ? msR.value : []).filter(x => String(x?.order_number) === no).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)));
      const es = (esR.status === 'fulfilled' ? esR.value : []).filter(x => String(x?.order_number) === no).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)));
      const fs = (fsR.status === 'fulfilled' ? fsR.value : []).filter(x => String(x?.order_number) === no).map(x => ({ file_type: x.file_type, file_name: x.file_name, mime_type: x.mime_type || null, created_at: x.created_at }));
      return json(res, safe(o,
        ms.map(x => ({ sender_type: x.sender_type, message: x.message, created_at: x.created_at, read_at: x.read_at || null })),
        es.map(x => ({ event_type: x.event_type, message: x.message || null, created_at: x.created_at, created_by: x.created_by || null })),
        fs
      ));
    }

    if (req.method === 'POST' && path === '/webhooks/razorpay') {
      const raw = req.bodyText || '';
      const signature = req.headers['x-razorpay-signature'] || '';
      if (!env('RAZORPAY_WEBHOOK_SECRET')) return bad(res, 'Webhook secret is not configured', 500);
      if (!verifyWebhookSignature(raw, signature)) return bad(res, 'Invalid webhook signature', 401);
      let body;
      try { body = JSON.parse(raw); } catch { return bad(res, 'Invalid webhook JSON'); }
      const payment = body.payload?.payment?.entity;
      const razorpayOrder = body.payload?.order?.entity;
      const paymentId = String(payment?.id || '');
      const razorpayOrderId = String(payment?.order_id || razorpayOrder?.id || '');
      const orderNumber = payment?.notes?.order_number || payment?.notes?.receipt || razorpayOrder?.notes?.order_number || razorpayOrder?.receipt;
      const o = orderNumber ? await findRow(ORDERS, 'order_number', orderNumber) : (razorpayOrderId ? (await rows(ORDERS)).find(r => String(r?.razorpay_order_id || '') === razorpayOrderId) || null : null);
      if (!o) return json(res, { ok: true, ignored: true });
      if (o.razorpay_order_id && razorpayOrderId && String(o.razorpay_order_id) !== razorpayOrderId) return bad(res, 'Order mismatch', 400);
      if (body.event === 'order.paid' || body.event === 'payment.captured') {
        await markPaymentPaid(o, paymentId, razorpayOrderId, 'razorpay-webhook');
      } else if (body.event === 'payment.failed') {
        await update(ORDERS, o.$id, { payment_status: 'FAILED' });
        await event(o.order_number, 'PAYMENT_FAILED', payment?.error_description || 'Razorpay payment failed.', 'razorpay-webhook', paymentId ? { payment_id: paymentId } : null);
      }
      return json(res, { ok: true });
    }

    m = path.match(/^\/orders\/([^/]+)\/payment\/verify$/);
    if (req.method === 'POST' && m) {
      const no = decodeURIComponent(m[1]);
      const access = req.headers['x-access-token'];
      const o = await orderByNo(no, access);
      if (!o) return bad(res, 'Order not found', 404);
      if (!RZP_SECRET) return bad(res, 'Payment verification is not configured', 500);
      const b = req.bodyJson || {};
      const paymentId = String(b.razorpay_payment_id || '');
      const razorpayOrderId = String(b.razorpay_order_id || '');
      const signature = String(b.razorpay_signature || '');
      if (!paymentId || !razorpayOrderId || !signature) return bad(res, 'Incomplete payment verification data');
      if (razorpayOrderId !== String(o.razorpay_order_id)) return bad(res, 'Payment order mismatch', 400);
      if (!verifyRazorpayPayment(razorpayOrderId, paymentId, signature)) return bad(res, 'Invalid payment signature', 401);
      const payment = await rzpPayment(paymentId);
      if (String(payment.order_id || '') !== razorpayOrderId) return bad(res, 'Payment order mismatch', 400);
      if (String(payment.status || '').toLowerCase() !== 'captured') return bad(res, `Payment status is ${payment.status || 'unknown'}; waiting for capture`, 409);
      const now = await markPaymentPaid(o, paymentId, razorpayOrderId, 'razorpay');
      return json(res, { ok: true, payment_status: 'PAID', paid_at: o.paid_at || now, track_url: `${SITE}/track.html?order=${encodeURIComponent(no)}&token=${encodeURIComponent(access)}` });
    }

    m = path.match(/^\/orders\/([^/]+)\/files$/);
    if (req.method === 'POST' && m) {
      const no = decodeURIComponent(m[1]);
      const o = await orderByNo(no, req.headers['x-access-token']);
      if (!o) return bad(res, 'Order not found', 404);
      const type = String(req.headers['x-file-type'] || '');
      const name = (req.headers['x-file-name'] || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
      const bytes = req.bodyBinary;
      if (!['voice', 'paper'].includes(type)) return bad(res, 'Invalid file type');
      if (!bytes?.length || bytes.length > 12 * 1024 * 1024) return bad(res, 'File is empty or too large');
      const f = new FormData();
      f.append('fileId', 'unique()');
      f.append('file', new Blob([bytes], { type: req.headers['content-type'] || 'application/octet-stream' }), name);
      const up = await aw(`/storage/buckets/${encodeURIComponent(BUCKET)}/files`, { method: 'POST', body: f });
      await create(FILES, { order_number: no, file_type: type, file_id: up.$id, file_name: name, mime_type: req.headers['content-type'] || null, created_at: new Date().toISOString() });
      if (o.status === 'ORDER_RECEIVED' || o.status === 'PAYMENT_VERIFIED') await update(ORDERS, o.$id, { status: 'REQUIREMENTS_RECEIVED' });
      await event(no, 'REQUIREMENTS_RECEIVED', 'Customer requirements file received.', 'customer');
      return json(res, { ok: true, file_id: up.$id });
    }

    m = path.match(/^\/orders\/([^/]+)\/messages$/);
    if (req.method === 'POST' && m) {
      const no = decodeURIComponent(m[1]);
      const o = await orderByNo(no, req.headers['x-access-token']);
      if (!o) return bad(res, 'Order not found', 404);
      const body = String((req.bodyJson || {}).body || '').trim();
      if (!body || body.length > 2000) return bad(res, 'Message is empty or too long');
      await create(MESSAGES, { order_number: no, sender_type: 'customer', message: body, created_at: new Date().toISOString(), read_at: new Date().toISOString() });
      await event(no, 'CUSTOMER_MESSAGE', 'Customer sent a message.', 'customer');
      return json(res, { ok: true });
    }

    m = path.match(/^\/orders\/([^/]+)\/revision$/);
    if (req.method === 'POST' && m) {
      const no = decodeURIComponent(m[1]);
      const o = await orderByNo(no, req.headers['x-access-token']);
      if (!o) return bad(res, 'Order not found', 404);
      if (!['READY', 'DELIVERED'].includes(o.status)) return bad(res, 'Revision requests are available after the song is ready');
      const body = String((req.bodyJson || {}).body || '').trim();
      if (!body || body.length > 2000) return bad(res, 'Please describe the revision you need');
      const next = Number(o.revision_count || 0) + 1;
      await update(ORDERS, o.$id, { revision_count: next, status: 'REVISION_REQUESTED' });
      await create(MESSAGES, { order_number: no, sender_type: 'customer', message: `Revision request: ${body}`, created_at: new Date().toISOString() });
      await event(no, 'REVISION_REQUESTED', body, 'customer', { revision_count: next });
      return json(res, { ok: true, revision_count: next, status: 'REVISION_REQUESTED' });
    }

    m = path.match(/^\/orders\/([^/]+)\/song$/);
    if (req.method === 'GET' && m) {
      const no = decodeURIComponent(m[1]);
      const t = req.headers['x-access-token'] || new URLSearchParams(req.queryString || '').get('token');
      const o = await orderByNo(no, t);
      if (!o || !['READY', 'DELIVERED'].includes(o.status)) return bad(res, 'Song is not ready', 404);
      const fs = (await rows(FILES)).filter(x => String(x?.order_number) === no && x.file_type === 'mp3').sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
      if (!fs[0]) return bad(res, 'Song file not found', 404);
      const url = await fileToken(fs[0].file_id);
      await update(ORDERS, o.$id, { download_count: Number(o.download_count || 0) + 1, last_download_at: new Date().toISOString(), status: o.status === 'READY' ? 'DELIVERED' : o.status });
      await event(no, 'SONG_DOWNLOAD_LINK_OPENED', 'Private song link generated.', 'customer');
      return json(res, { ok: true, file_name: fs[0].file_name, url });
    }

    return bad(res, 'Route not found', 404);
  } catch (e) {
    error(e?.stack || String(e));
    return bad(res, 'Server error', 500);
  }
};
