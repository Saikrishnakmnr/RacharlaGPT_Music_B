# RacharlaGPT Music — Final Production Handover

## What is included

- GitHub Pages-ready frontend for `songs.racharlagpt.in`
- PWA/service worker
- Public SEO landing pages, sitemap and robots.txt
- GA4 (`G-1W86QW7J5Y`)
- AdSense publisher integration (`ca-pub-1188239058737040`)
- Monetag verification/service-worker configuration at root `sw.js`
- Customer creation flow: type, paper/photo/PDF upload, voice recording
- Razorpay server-created payment order flow with UPI/card checkout support
- Appwrite TablesDB + private Storage backend functions
- Razorpay webhook verification foundation
- Private order number + access-token tracking
- Customer order tracking and messages
- Expiring Appwrite file-token delivery for final MP3
- Private admin login/dashboard/order workflow
- Campaign pricing configuration (`NORMAL_PRICE`, `CAMPAIGN_PRICE`, dates)

## Required production configuration

1. Create the Appwrite project, TablesDB database/tables and private storage bucket using `backend/schema/SCHEMA.md`.
2. Deploy `backend/functions/order-api`.
3. Deploy `backend/functions/razorpay-webhook`.
4. Deploy `backend/functions/admin-api`.
5. Set each function's required environment variables from `backend/.env.example`.
6. Generate a long random `ADMIN_TOKEN`. Never put it in frontend files.
7. Configure the Razorpay webhook URL and webhook secret.
8. Copy `js/config.example.js` to `js/config.js` and replace only the two public Appwrite Function URLs.
9. Test Razorpay in test mode first.
10. Configure the custom domain `songs.racharlagpt.in` on GitHub Pages.
11. Keep root `sw.js` unchanged until Monetag verification is complete.
12. Submit the sitemap in Google Search Console after the public site is live.

## Important security rules

Never commit:

- `APPWRITE_API_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ADMIN_TOKEN`
- any SMTP/email password
- any storage secret

Only the Razorpay public key and Appwrite Function URLs may be exposed to the browser.

## Payment sequence

Customer details → secure order created → Razorpay order created server-side → customer opens Razorpay Checkout → payment is captured → Razorpay webhook reaches the webhook function → signature is verified → order becomes `PAYMENT_VERIFIED` → admin produces the song → admin uploads MP3 → order becomes `READY` → customer private page receives an expiring Appwrite file-token URL.

## Live-test requirement

The package has been checked locally for file placement, local HTML references, JavaScript syntax, JSON syntax, integration markers, and required workflow routes. A real payment, Appwrite project, GitHub Pages deployment, Monetag verification, or production webhook cannot be truthfully marked live-tested until your real service credentials/domains are configured.
