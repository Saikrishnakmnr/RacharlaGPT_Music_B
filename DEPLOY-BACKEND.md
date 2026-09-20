# RacharlaGPT Music backend layer

This layer uses Appwrite Functions as the HTTPS backend and Razorpay for server-created payment orders. Appwrite Functions can expose HTTPS endpoints and receive binary request bodies, and Appwrite's server API keys must stay server-side. Razorpay recommends server-side signature verification plus webhooks for payment automation. See the official docs linked in the project README.

## Functions

1. `order-api` — create an order + Razorpay order, read a private order by order number/token, and receive customer files as binary uploads.
2. `razorpay-webhook` — validates `X-Razorpay-Signature` using the raw webhook body and updates payment status.

## Important

Do not put `APPWRITE_API_KEY`, `RAZORPAY_KEY_SECRET`, or `RAZORPAY_WEBHOOK_SECRET` into GitHub Pages or any browser JavaScript.

## Setup order

1. Create Appwrite project.
2. Create TablesDB database and tables using `schema/SCHEMA.md`.
3. Create private storage bucket `order-files` with file security enabled.
4. Create two Node.js Appwrite Functions and deploy the two folders.
5. Add environment variables from `.env.example` to each function. Give only the required Appwrite scopes.
6. Configure Razorpay webhook to the webhook function URL and subscribe to `order.paid`, `payment.captured`, and `payment.failed`.
7. Set the webhook secret in the function variables.
8. Put the public `order-api` function URL into the frontend config. Only the function URL and Razorpay Key ID are public; secrets are not.
9. Run test-mode payments before switching to live mode.

The current frontend remains intentionally un-deployed until these values are supplied and end-to-end tests pass.
