import crypto from 'node:crypto';
const env = n => process.env[n] || '';
const ENDPOINT=env('APPWRITE_ENDPOINT'), PROJECT=env('APPWRITE_PROJECT_ID'), KEY=env('APPWRITE_API_KEY');
const DB=env('APPWRITE_DATABASE_ID','music'), ORDERS=env('APPWRITE_ORDERS_TABLE','orders'), EVENTS=env('APPWRITE_EVENTS_TABLE','order_events');
const SECRET=env('RAZORPAY_WEBHOOK_SECRET');
function json(res,d,s=200){return res.json(d,s)}
async function aw(path, options={}){const r=await fetch(ENDPOINT.replace(/\/$/,'')+'/v1'+path,{...options,headers:{'X-Appwrite-Project':PROJECT,'X-Appwrite-Key':KEY,...(options.headers||{})}});const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}if(!r.ok)throw new Error(d.message||t);return d}
async function listOrder(orderNo){const q=encodeURIComponent(`equal(\"order_number\",${JSON.stringify([String(orderNo)])})`);const r=await aw(`/tablesdb/${DB}/tables/${ORDERS}/rows?queries[]=${q}&limit=1`);return r.rows?.[0]}
async function update(id,data){return aw(`/tablesdb/${DB}/tables/${ORDERS}/rows/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({data})})}
async function event(data){return aw(`/tablesdb/${DB}/tables/${EVENTS}/rows`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rowId:'unique()',data})})}
export default async ({req,res,error})=>{try{if(req.method!=='POST')return json(res,{error:'POST only'},405);if(!SECRET)return json(res,{error:'Webhook secret not configured'},500);const raw=req.bodyText||'';const sig=req.headers['x-razorpay-signature']||'';const expected=crypto.createHmac('sha256',SECRET).update(raw).digest('hex');if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return json(res,{error:'Invalid signature'},401);const eventId=req.headers['x-razorpay-event-id']||'';const body=JSON.parse(raw);if(eventId){try{await event({event_id:eventId,event:body.event,created_at:new Date().toISOString()})}catch(e){if(!String(e).includes('duplicate')) throw e;}}
const p=body.payload?.payment?.entity;const o=body.payload?.order?.entity;const orderNo=p?.notes?.order_number||p?.notes?.receipt||o?.receipt; if(!orderNo)return json(res,{ok:true,ignored:true});const row=await listOrder(orderNo);if(!row)return json(res,{ok:true,ignored:true});
if(body.event==='order.paid'||body.event==='payment.captured'){await update(row.$id,{payment_status:'PAID',status:row.status==='ORDER_RECEIVED'?'PAYMENT_VERIFIED':row.status,payment_id:p?.id||row.payment_id,paid_at:new Date().toISOString()});await event({order_number:orderNo,event:'PAYMENT_SUCCESS',created_at:new Date().toISOString()})}
if(body.event==='payment.failed'){await update(row.$id,{payment_status:'FAILED',payment_id:p?.id||row.payment_id})}
return json(res,{ok:true});}catch(e){error(e?.stack||String(e));return json(res,{error:'Server error'},500)}};
