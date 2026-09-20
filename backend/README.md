# Backend architecture

**Browser → Appwrite Function → Appwrite TablesDB/Storage**

**Browser → Appwrite Function → Razorpay Orders API**

**Razorpay → Appwrite Function webhook → Appwrite TablesDB**

The browser never receives an Appwrite API key or Razorpay secret.

## Admin

The `admin-api` function and `/admin/` pages provide the private studio workflow. Set a long random `ADMIN_TOKEN` only in the Appwrite Function environment. The browser stores the returned bearer token in `sessionStorage`; no admin credential is committed to the repository.

The admin workflow supports order listing, status changes, customer messages, and final MP3 upload. The customer receives a time-limited Appwrite file-token download link only after the order reaches `READY`/`DELIVERED`. Appwrite file tokens are designed for expiring external file sharing. See the official Appwrite file-token documentation.
