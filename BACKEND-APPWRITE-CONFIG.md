# Appwrite configuration — 360° deployment contract

## Important: changing GitHub files does NOT mean rebuilding the Appwrite database

The 360° source is written against the existing database/table/column names. You do **not** need to recreate `orders`, `order_files`, `order_events`, `messages`, or `offers` just because the repository was replaced.

## Existing project

- Project ID: `6aafadcb003593fec22c`
- Region: Singapore
- API endpoint used by these functions: `https://sgp.cloud.appwrite.io`
- Database ID: `6aafb3630024cecf2eae`
- Storage bucket: `order-files`

## Order API environment

Required:

- `APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io`  ← **without `/v1`** because the code appends `/v1`
- `APPWRITE_PROJECT_ID=6aafadcb003593fec22c`
- `APPWRITE_API_KEY=<existing server API key>`
- `APPWRITE_DATABASE_ID=6aafb3630024cecf2eae`
- `APPWRITE_ORDERS_TABLE=orders`
- `APPWRITE_FILES_TABLE=order_files`
- `APPWRITE_EVENTS_TABLE=order_events`
- `APPWRITE_MESSAGES_TABLE=messages`
- `APPWRITE_STORAGE_BUCKET=order-files`
- `RAZORPAY_KEY_ID=<existing live/test public key ID>`
- `RAZORPAY_KEY_SECRET=<existing secret>`
- `SITE_URL=https://songs.racharlagpt.in`
- `NORMAL_PRICE=499`
- `CAMPAIGN_PRICE=99`
- `CAMPAIGN_NAME=Vinayaka Chavithi Special`
- `CAMPAIGN_START=<configured start>`
- `CAMPAIGN_END=<configured end>`


## Admin API additional environment

Same Appwrite variables as above, plus:

- `ADMIN_TOKEN=<long random private token>`

`ADMIN_TOKEN` is server-only. Never put it in `js/config.js`.

## Razorpay webhook additional environment

Same Appwrite variables as above, plus:

- `RAZORPAY_WEBHOOK_SECRET=<the exact secret configured in Razorpay webhook settings>`

## Public frontend

`js/config.js` may contain only public Function URLs:

- `PUBLIC_API_BASE=https://racharlagpt-music-b.sgp.appwrite.run`
- `ADMIN_API_BASE=<actual generated admin-api Function URL>`

Do not put any Appwrite API key, Razorpay secret, webhook secret, or admin token in the frontend.

## Function deployment roots

- `backend/functions/order-api`
- `backend/functions/admin-api`
- `backend/functions/razorpay-webhook`

Node.js 26 / ES module source.

## No schema migration required

This build deliberately does not require a new payment column, customer-account table, or history table. The private order token + order events + messages provide the customer history model.
