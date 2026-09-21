# Ad scripts installed

The requested advertising scripts are installed in the public root page `index.html`, immediately after the opening `<head>` tag.

- Push/banner zone: 11853518 (`https://nap5k.com/tag.min.js`)
- Vignette zone: 11853521 (`https://n6wxm.com/vignette.min.js`)

The private customer/admin pages were intentionally left without these scripts so private order data and the studio UI are not unnecessarily exposed to ad scripts.

The existing root `sw.js` Monetag service-worker integration remains unchanged.
