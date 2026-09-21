import crypto from 'node:crypto';

const env = (n, f = '') => process.env[n] || f;
const ENDPOINT = env('APPWRITE_ENDPOINT');
const PROJECT = env('APPWRITE_PROJECT_ID');
const KEY = env('APPWRITE_API_KEY');
const DB = env('APPWRITE_DATABASE_ID');
const ORDERS = env('APPWRITE_ORDERS_TABLE', 'orders');
const EVENTS = env('APPWRITE_EVENTS_TABLE', 'order_events');
const SECRET = env('RAZORPAY_WEBHOOK_SECRET');

function json(res, data, status = 200) { return res.json(data, status); }
async function aw(path, options = {}) {
  const r = await fetch(ENDPOINT.replace(/\/$/, '') + '/v1' + path, { ...options, headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY, ...(options.headers || {}) } });
  const text = await r.text(); let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!r.ok) throw new Error(data.message || text);
  return data;
}
async function rows(table, maxPages = 100) {
  const all = []; let cursor = '';
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: '100' }); if (cursor) qs.set('cursorAfter', cursor);
    const d = await aw(`/tablesdb/${DB}/tables/${encodeURIComponent(table)}/rows?${qs.toString()}`);
    const batch = Array.isArray(d.rows) ? d.rows : []; all.push(...batch);
    if (batch.length < 100) break;
    const next = batch[batch.length - 1]?.$id; if (!next || next === cursor) break; cursor = next;
  }
  return all;
}
async function findOrder(orderNumber) { return (await rows(ORDERS)).find(r => String(r?.order_number) === String(orderNumber)) || null; }
async function update(id, data) {
  return aw(`/tablesdb/${DB}/tables/${encodeURIComponent(ORDERS)}/rows/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
}
async function event(data) {
  try { return await aw(`/tablesdb/${DB}/tables/${encodeURIComponent(EVENTS)}/rows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowId: 'unique()', data }) }); } catch { return null; }
}
function validSignature(raw, signature) {
  const expected = crypto.createHmac('sha256', SECRET || '').update(raw).digest('hex');
  return !!signature && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export default async ({ req, res, error }) => {
  try {
    if (req.method !== 'POST') return json(res, { error: 'POST only' }, 405);
    if (!SECRET) return json(res, { error: 'Webhook secret not configured' }, 500);
    const raw = req.bodyText || '';
    const signature = req.headers['x-razorpay-signature'] || '';
    if (!validSignature(raw, signature)) return json(res, { error: 'Invalid signature' }, 401);
    let body;
    try { body = JSON.parse(raw); } catch { return json(res, { error: 'Invalid JSON' }, 400); }

    const payment = body.payload?.payment?.entity;
    const razorpayOrder = body.payload?.order?.entity;
    const orderNumber = payment?.notes?.order_number || payment?.notes?.receipt || razorpayOrder?.notes?.order_number || razorpayOrder?.receipt;
    if (!orderNumber) return json(res, { ok: true, ignored: true });
    const row = await findOrder(orderNumber);
    if (!row) return json(res, { ok: true, ignored: true });

    const now = new Date().toISOString();
    if (body.event === 'order.paid' || body.event === 'payment.captured') {
      const wasPaid = row.payment_status === 'PAID';
      const rzpOrderId = payment?.order_id || razorpayOrder?.id || row.razorpay_order_id;
      if (row.razorpay_order_id && rzpOrderId && row.razorpay_order_id !== rzpOrderId) return json(res, { error: 'Order mismatch' }, 400);
      await update(row.$id, { payment_status: 'PAID', status: row.status === 'ORDER_RECEIVED' ? 'PAYMENT_VERIFIED' : row.status, paid_at: row.paid_at || now });
      if (!wasPaid) await event({ order_number: orderNumber, event_type: 'PAYMENT_SUCCESS', message: `Razorpay event: ${body.event}`, created_at: now, created_by: 'razorpay', metadata: payment?.id ? JSON.stringify({ payment_id: payment.id, razorpay_order_id: rzpOrderId }) : null });
    } else if (body.event === 'payment.failed') {
      await update(row.$id, { payment_status: 'FAILED' });
      await event({ order_number: orderNumber, event_type: 'PAYMENT_FAILED', message: payment?.error_description || 'Razorpay payment failed.', created_at: now, created_by: 'razorpay', metadata: payment?.id ? JSON.stringify({ payment_id: payment.id }) : null });
    }
    return json(res, { ok: true });
  } catch (e) {
    error(e?.stack || String(e));
    return json(res, { error: 'Server error' }, 500);
  }
};
