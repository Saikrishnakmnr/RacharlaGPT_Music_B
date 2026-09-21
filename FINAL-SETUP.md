# RacharlaGPT Music — 360° final setup

## Important answer to the Appwrite question

You can replace the GitHub repository files without recreating the Appwrite database.

This build was written against the existing Appwrite tables and columns. Do **not** rename `order_number`, `order_files.file_type`, `messages.message`, etc.

You only need to deploy the corrected backend functions and confirm their environment variables.

## Frontend

GitHub Pages:

`https://songs.racharlagpt.in`

Public Function URL already known:

`https://racharlagpt-music-b.sgp.appwrite.run`

Set the real `admin-api` Function URL in:

`js/config.js`

## Backend functions

Deploy these three directories as separate Appwrite Functions:

- `backend/functions/order-api`
- `backend/functions/admin-api`
- `backend/functions/razorpay-webhook`

Node.js 26 / ES module source.

## Server-only variables

Never put these in GitHub Pages files:

- `APPWRITE_API_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ADMIN_TOKEN`

## Customer history model

There are intentionally no customer accounts/passwords.

Each order has its own private bearer token and private URL. The new **Track Order** page lets a customer reopen an order by entering:

- order number
- private access token

The private order page contains the complete order history/timeline, payment state, messages, requirements and delivery state.

A true multi-order account history would require customer authentication (for example email OTP or customer accounts). It is intentionally not introduced here because it would change the current architecture and require additional security/storage design.

## Admin history model

`/admin/` is the private studio area.

It provides the complete order list, search, filters, payment state, production status, revenue summary, timeline, messages, customer files and final MP3 delivery.

## Final live test

After deployment:

`Create → Upload → Pay ₹99 → payment becomes PAID → customer tracking → admin sees order → admin changes status → admin uploads MP3 → customer sees READY → customer plays/downloads → revision request → timeline updates`
