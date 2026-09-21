# RacharlaGPT Music production deployment checklist

1. Use custom domain: https://songs.racharlagpt.in/
2. Keep Monetag `sw.js` at repository root beside `index.html`.
3. GA4 Measurement ID: G-1W86QW7J5Y
4. AdSense publisher ID: ca-pub-1188239058737040
5. Monetag zone ID from supplied verification file: 11844310
6. Do NOT put Appwrite secrets, payment secrets, webhook secrets or admin credentials in frontend files.
7. Connect Appwrite + secure backend before enabling real orders/payment.
8. Add payment gateway webhook verification server-side.
9. Keep creation/payment/private order pages ad-free.
10. Submit the finished public site to Google Search Console and request indexing after deployment.
11. Test mobile microphone, uploads, canonical URLs, robots, sitemap, analytics events and private-order security before launch.
12. Replace placeholder legal wording with the final business/legal policy before launch.
