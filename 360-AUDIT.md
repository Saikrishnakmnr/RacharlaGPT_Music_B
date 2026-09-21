# RacharlaGPT Music — 360° audit / production build

Source reviewed: repository `racharlagpt_music_b` plus the Appwrite schema/flow established during the previous work.

## 1. Customer experience

- Public homepage keeps the Radiant Cinematic Music design.
- Creation supports Type / Upload / Voice.
- Upload and voice orders no longer fail merely because the optional text description is empty; the backend records an appropriate requirement placeholder in the existing required `description` column.
- Customer receives an order number, private access token and private tracking URL.
- Payment page exposes the private tracking link so the customer can save/copy it.
- Public navigation now exposes **Track Order** and a discreet **Studio** entry.
- New `track-order.html` lets a customer reopen an order using order number + private token.
- Private tracking shows payment, order data, requirements, uploaded files, timeline, messages, revision count and delivery state.
- Customer can send messages.
- Customer can request a revision after the song is READY/DELIVERED.
- Customer can open the private song and receive an expiring download URL.

## 2. Payment

- Razorpay order is created server-side.
- Checkout callback is not trusted by itself.
- Backend validates Razorpay signature.
- Backend also checks the Razorpay payment object and requires `status=captured` before marking the order PAID.
- Payment ID, payment method and amount are retained in `order_events.metadata`; no new orders column is required.
- Razorpay webhook validates the raw-body signature and acts as a backstop for captured/paid events.
- Failed payments are recorded as `FAILED`.

## 3. Appwrite / schema compatibility

The existing tables remain the contract:

- `orders`
- `order_files`
- `order_events`
- `messages`
- `offers`

No table needs to be recreated and no existing column needs to be renamed because of this source replacement.

The important existing keys remain:

- `orders.order_number`
- `orders.razorpay_order_id`
- `orders.access_token_hash`
- `order_files.file_type`
- `order_files.file_id`
- `order_events.event_type`
- `messages.sender_type`
- `messages.message`

The old TablesDB `queries[]` lookup that produced `Attribute not found in schema: order_number` is not used. Backend functions use cursor pagination and trusted server-side matching.

## 4. Admin experience

The repository already contained `/admin/`, but the public UI did not expose it and the admin API URL was still a placeholder. This build makes the UI discoverable through a discreet **Studio** link while keeping the admin area `noindex,nofollow`.

Admin dashboard now includes:

- total orders
- paid orders
- pending/failed payments
- production count
- ready/delivered count
- revenue total
- search
- status filter
- refresh
- customer/order/payment/status history

Admin order control includes:

- full customer/order details
- requirements
- Razorpay order ID
- timeline
- customer files
- private file opening
- status controls
- revision count
- timeline notes
- customer messages
- final MP3 upload
- automatic READY state after valid final MP3 upload

## 5. Security

- Appwrite API key remains server-side.
- Razorpay secret remains server-side.
- Razorpay webhook secret remains server-side.
- Admin token remains server-side.
- Customer access uses a random bearer token stored only as a SHA-256 hash in `orders.access_token_hash`.
- Appwrite Storage remains private.
- Final MP3 is delivered with an expiring Appwrite file token.
- Customer/admin pages are `noindex,nofollow`.
- Private responses use `Cache-Control: no-store`.

## 6. Appwrite changes actually required

Replacing the GitHub files does **not** require rebuilding the Appwrite database.

After deploying the three functions, confirm only the backend environment values:

### `order-api`
- existing Appwrite variables
- existing Razorpay key ID/secret
- existing pricing/campaign variables

### `admin-api`
- same Appwrite variables
- new/required server-only `ADMIN_TOKEN`

### `razorpay-webhook`
- same Appwrite variables
- new/required server-only `RAZORPAY_WEBHOOK_SECRET`

The only frontend configuration that cannot be safely invented in this package is the generated Appwrite Function URL for `admin-api`. Put that real URL in `js/config.js` as `ADMIN_API_BASE` after the function is deployed.

## 7. Verification performed

Local checks:

- JavaScript syntax: PASS
- JSON parsing: PASS
- static HTML local references: PASS
- public secret-name scan: PASS
- simulated 360° integration: PASS

Simulated flow:

`create order → upload requirement → Razorpay signature + captured verification → customer message → admin login → admin order history → status update → admin message → MP3 upload → customer track → revision request → webhook`

A live Appwrite/Razorpay transaction cannot be claimed from this offline build environment. The final live test must use the real deployed functions and your real Razorpay configuration.
